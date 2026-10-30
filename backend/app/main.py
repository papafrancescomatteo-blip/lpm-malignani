"""API del sito LPM Malignani: sito pubblico + portale staff."""
import hmac
import re
import secrets
import time
import uuid
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, Depends, FastAPI, File, Form, Header, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pymongo import ReturnDocument

from .config import settings
from .mailer import MailError, credentials_email, ready_email, send_email
from .models import (
    AssegnazioneIn, AvvisoIn, BadgeIn, CertificatoIn, CertificatoStato, LoginIn, ReinvioIn,
    TecnicoUpdate, UserIn, VerificaIn,
)
from .security import (
    decode_token, hash_badge, hash_key, hash_password, make_token, new_key, verify_password,
)
from .seed import SEED_DOCS, SEED_DIR

ROOT = Path(__file__).resolve().parents[2]
FRONTEND = ROOT / "frontend"

STATO_CERT_LABEL = {
    "in_lavorazione": "In lavorazione",
    "pronto": "Pronto per il ritiro / invio",
    "consegnato": "Consegnato",
}
SETTORE_LABEL = {"meccanica": "Meccanica", "edilizia": "Edilizia", "cicli": "Cicli"}

db = None  # impostato all'avvio


# ------------------------------------------------------------------ utilità

def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def today() -> str:
    return date.today().isoformat()


def new_id() -> str:
    return uuid.uuid4().hex


def out(d: dict | None) -> dict | None:
    """Documento Mongo -> JSON per il client (niente hash)."""
    if d is None:
        return None
    d = dict(d)
    d["id"] = d.pop("_id")
    for k in ("password_hash", "badge_hash", "chiave_hash"):
        d.pop(k, None)
    return d


async def log(user: dict | None, azione: str, dettaglio: str = "") -> None:
    await db.logs.insert_one({
        "_id": new_id(), "quando": now(),
        "utente": user["username"] if user else "-", "ruolo": user["role"] if user else "-",
        "azione": azione, "dettaglio": dettaglio,
    })


async def next_verbale() -> str:
    year = date.today().year
    r = await db.counters.find_one_and_update(
        {"_id": f"verbali-{year}"}, {"$inc": {"n": 1}}, upsert=True, return_document=ReturnDocument.AFTER
    )
    return f"{year}/{r['n']:04d}"


_hits: dict[str, list[float]] = {}


def throttle(key: str, limit: int, window: int = 600) -> None:
    t = time.time()
    arr = [x for x in _hits.get(key, []) if t - x < window]
    if len(arr) >= limit:
        raise HTTPException(429, "Troppi tentativi. Riprova tra qualche minuto.")
    arr.append(t)
    _hits[key] = arr


def client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    return (fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "?"))


async def current_user(authorization: str | None = Header(default=None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Accesso richiesto")
    try:
        payload = decode_token(authorization.split(" ", 1)[1])
    except Exception:
        raise HTTPException(401, "Sessione scaduta")
    user = await db.users.find_one({"_id": payload["sub"]})
    if not user or not user.get("active", True):
        raise HTTPException(401, "Utente non attivo")
    return user


def require(*roles: str):
    async def dep(user: dict = Depends(current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(403, "Non hai i permessi per questa operazione")
        return user
    return dep


ADMIN = require("admin")
SEGRETERIA = require("admin", "segreteria")
STAFF = require("admin", "segreteria", "tecnico")


def regex(q: str) -> dict:
    return {"$regex": re.escape(q.strip()), "$options": "i"}


# ------------------------------------------------------------------ avvio

@asynccontextmanager
async def lifespan(app: FastAPI):
    global db
    if settings.mongodb_uri == "mock":
        from mongomock_motor import AsyncMongoMockClient  # solo sviluppo
        db = AsyncMongoMockClient()[settings.mongodb_db]
        print("ATTENZIONE: database in memoria (MONGODB_URI non impostata)")
    else:
        from motor.motor_asyncio import AsyncIOMotorClient
        db = AsyncIOMotorClient(settings.mongodb_uri, serverSelectionTimeoutMS=8000)[settings.mongodb_db]
    await db.users.create_index("username", unique=True)
    await db.users.create_index("badge_hash", unique=True, partialFilterExpression={"badge_hash": {"$type": "string"}})
    await db.certificati.create_index("numero_verbale", unique=True)
    await db.assegnazioni.create_index("numero_verbale", unique=True)
    await db.logs.create_index([("quando", -1)])
    await seed_admin()
    await seed_settings_and_docs()
    yield


async def seed_admin() -> None:
    if await db.users.count_documents({}) > 0:
        return
    pw = settings.admin_password
    generated = False
    if not pw:
        pw, generated = secrets.token_urlsafe(9), True
    await db.users.insert_one({
        "_id": new_id(), "username": settings.admin_username, "name": settings.admin_name,
        "email": settings.admin_email, "role": "admin", "password_hash": hash_password(pw),
        "active": True, "created": now(),
    })
    if generated:
        print("=" * 60)
        print(f"PRIMO ACCESSO  utente: {settings.admin_username}   password: {pw}")
        print("Cambiala subito da Staff > Utenti. Questo messaggio compare una sola volta.")
        print("=" * 60)


async def seed_settings_and_docs() -> None:
    if not await db.settings.find_one({"_id": "avviso"}):
        await db.settings.insert_one({"_id": "avviso", "attivo": False, "titolo": "", "testo": "", "aggiornato": now()})
    if await db.documents.count_documents({}) == 0:
        for i, d in enumerate(SEED_DOCS):
            files = []
            for fname in d["files"]:
                p = SEED_DIR / fname
                if not p.exists():
                    continue
                fid = new_id()
                await db.files.insert_one({"_id": fid, "data": p.read_bytes()})
                ext = p.suffix.lower().lstrip(".")
                files.append({"file_id": fid, "filename": fname, "formato": ext, "size": p.stat().st_size})
            if files:
                await db.documents.insert_one({
                    "_id": new_id(), "titolo": d["titolo"], "categoria": d["categoria"], "pubblico": True,
                    "ordine": i, "files": files, "creato_da": "sistema", "created": now(),
                })


app = FastAPI(title="LPM Malignani", lifespan=lifespan)
api = APIRouter(prefix="/api")


@api.get("/health")
async def health():
    await db.command("ping") if settings.mongodb_uri != "mock" else None
    return {"ok": True}


# ------------------------------------------------------------------ pubblico

@api.get("/public/avviso")
async def public_avviso():
    a = await db.settings.find_one({"_id": "avviso"}) or {}
    return {"attivo": bool(a.get("attivo")), "titolo": a.get("titolo", ""), "testo": a.get("testo", "")}


def _public_doc(d: dict) -> dict:
    return {
        "id": d["_id"], "titolo": d["titolo"], "categoria": d["categoria"],
        "files": [{"idx": i, "formato": f["formato"], "size": f["size"]} for i, f in enumerate(d["files"])],
    }


@api.get("/public/documenti")
async def public_documenti():
    docs = await db.documents.find({"pubblico": True}).sort("ordine", 1).to_list(500)
    return [_public_doc(d) for d in docs]


async def _file_response(doc: dict | None, idx: int, download: bool = True) -> Response:
    if not doc or idx < 0 or idx >= len(doc["files"]):
        raise HTTPException(404, "File non trovato")
    f = doc["files"][idx]
    blob = await db.files.find_one({"_id": f["file_id"]})
    if not blob:
        raise HTTPException(404, "File non trovato")
    ctype = f.get("content_type") or {
        "pdf": "application/pdf", "doc": "application/msword",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }.get(f["formato"], "application/octet-stream")
    disp = "attachment" if download else "inline"
    return Response(bytes(blob["data"]), media_type=ctype,
                    headers={"Content-Disposition": f"{disp}; filename*=UTF-8''{quote(f['filename'])}"})


@api.get("/public/documenti/{doc_id}/file/{idx}")
async def public_documento_file(doc_id: str, idx: int):
    doc = await db.documents.find_one({"_id": doc_id, "pubblico": True})
    return await _file_response(doc, idx, download=False)


@api.post("/public/verifica")
async def public_verifica(body: VerificaIn, request: Request):
    throttle("verifica:" + client_ip(request), 12)
    numero = body.numero_verbale.strip().replace(" ", "").replace("-", "/")
    c = await db.certificati.find_one({"numero_verbale": numero})
    ok = bool(c) and hmac.compare_digest(c["chiave_hash"], hash_key(body.chiave))
    if not ok:
        raise HTTPException(404, "Nessun certificato trovato con questi dati. Controlla numero di verbale e chiave di ricerca.")
    return {
        "numero_verbale": c["numero_verbale"], "settore": SETTORE_LABEL[c["settore"]],
        "materiali": c["materiali"], "tipo_prove": c.get("tipo_prove", ""),
        "stato": c["stato"], "stato_label": STATO_CERT_LABEL[c["stato"]],
        "formato": c["formato"], "data_registrazione": c["created"][:10],
        "data_aggiornamento": c["aggiornato"][:10], "data_pronto": (c.get("data_pronto") or "")[:10],
        "note": c.get("note_pubbliche", ""),
        "storico": [{"stato": STATO_CERT_LABEL[s["stato"]], "data": s["data"][:10]} for s in c.get("storico", [])],
    }


# ------------------------------------------------------------------ autenticazione

def _login_response(user: dict) -> dict:
    return {"token": make_token(user), "user": out(user)}


@api.post("/auth/login")
async def login(body: LoginIn, request: Request):
    throttle("login:" + client_ip(request), 15)
    user = await db.users.find_one({"username": body.username.strip().lower()})
    if not user or not user.get("active", True) or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Utente o password errati")
    await log(user, "login", "password")
    return _login_response(user)


@api.post("/auth/badge")
async def login_badge(body: BadgeIn, request: Request):
    throttle("badge:" + client_ip(request), 15)
    user = await db.users.find_one({"badge_hash": hash_badge(body.badge)})
    if not user or not user.get("active", True):
        raise HTTPException(401, "Badge non riconosciuto")
    await log(user, "login", "badge")
    return _login_response(user)


@api.get("/auth/me")
async def me(user: dict = Depends(current_user)):
    return out(user)


@api.post("/auth/password")
async def change_password(body: dict, user: dict = Depends(current_user)):
    old, new = body.get("vecchia", ""), body.get("nuova", "")
    if not verify_password(old, user["password_hash"]):
        raise HTTPException(400, "La password attuale non è corretta")
    if len(new) < 8:
        raise HTTPException(400, "La nuova password deve avere almeno 8 caratteri")
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"password_hash": hash_password(new)}})
    await log(user, "password", "cambio password")
    return {"ok": True}


# ------------------------------------------------------------------ utenti (admin)

@api.get("/staff/utenti")
async def list_users(user: dict = Depends(ADMIN)):
    users = await db.users.find({}).sort("username", 1).to_list(500)
    res = []
    for u in users:
        o = out(u)
        o["ha_badge"] = bool(u.get("badge_hash"))
        res.append(o)
    return res


@api.post("/staff/utenti")
async def create_user(body: UserIn, user: dict = Depends(ADMIN)):
    if not body.password:
        raise HTTPException(400, "La password è obbligatoria")
    doc = {
        "_id": new_id(), "username": body.username.strip().lower(), "name": body.name.strip(),
        "email": body.email.strip(), "role": body.role, "password_hash": hash_password(body.password),
        "active": body.active, "created": now(),
    }
    if body.badge:
        doc["badge_hash"] = hash_badge(body.badge)
    try:
        await db.users.insert_one(doc)
    except Exception:
        raise HTTPException(409, "Username o badge già in uso")
    await log(user, "utente creato", f"{doc['username']} ({doc['role']})")
    return out(doc)


@api.put("/staff/utenti/{uid}")
async def update_user(uid: str, body: UserIn, user: dict = Depends(ADMIN)):
    target = await db.users.find_one({"_id": uid})
    if not target:
        raise HTTPException(404, "Utente non trovato")
    if uid == user["_id"] and (body.role != "admin" or not body.active):
        raise HTTPException(400, "Non puoi togliere a te stesso il ruolo di amministratore o disattivarti")
    sets = {"name": body.name.strip(), "email": body.email.strip(), "role": body.role, "active": body.active}
    unsets = {}
    if body.password:
        sets["password_hash"] = hash_password(body.password)
    if body.badge is not None:
        if body.badge == "":
            unsets["badge_hash"] = ""
        else:
            sets["badge_hash"] = hash_badge(body.badge)
    upd = {"$set": sets}
    if unsets:
        upd["$unset"] = unsets
    try:
        await db.users.update_one({"_id": uid}, upd)
    except Exception:
        raise HTTPException(409, "Badge già assegnato a un altro utente")
    await log(user, "utente modificato", target["username"])
    return out(await db.users.find_one({"_id": uid}))


# ------------------------------------------------------------------ assegnazioni

@api.get("/staff/assegnazioni")
async def list_assegnazioni(q: str = "", stato: str = "", settore: str = "", mie: bool = False,
                            user: dict = Depends(STAFF)):
    f: dict = {}
    if q:
        f["$or"] = [{k: regex(q)} for k in ("numero_verbale", "materiali", "richiedente.nome", "azienda.nome", "committente.nome")]
    if stato:
        f["stato"] = stato
    if settore:
        f["settore"] = settore
    if mie:
        f["assegnato_a"] = user["_id"]
    items = await db.assegnazioni.find(f).sort("created", -1).to_list(500)
    return [out(i) for i in items]


@api.post("/staff/assegnazioni")
async def create_assegnazione(body: AssegnazioneIn, user: dict = Depends(SEGRETERIA)):
    doc = body.model_dump()
    doc.update({
        "_id": new_id(), "numero_verbale": await next_verbale(), "stato": "ricevuta",
        "created": now(), "aggiornato": now(), "creato_da": user["username"],
        "note_tecniche": "", "prove_eseguite": "", "certificato_id": None,
        "storico": [{"stato": "ricevuta", "data": now(), "utente": user["username"]}],
    })
    await db.assegnazioni.insert_one(doc)
    await log(user, "assegnazione creata", f"{doc['numero_verbale']} - {doc['materiali'][:60]}")
    return out(doc)


@api.get("/staff/assegnazioni/{aid}")
async def get_assegnazione(aid: str, user: dict = Depends(STAFF)):
    a = await db.assegnazioni.find_one({"_id": aid})
    if not a:
        raise HTTPException(404, "Assegnazione non trovata")
    res = out(a)
    docs = await db.documents.find({"assegnazione_id": aid}).sort("created", -1).to_list(200)
    res["documenti"] = [_staff_doc(d) for d in docs]
    if a.get("certificato_id"):
        c = await db.certificati.find_one({"_id": a["certificato_id"]})
        res["certificato"] = out(c)
    return res


@api.put("/staff/assegnazioni/{aid}")
async def update_assegnazione(aid: str, body: dict, user: dict = Depends(STAFF)):
    a = await db.assegnazioni.find_one({"_id": aid})
    if not a:
        raise HTTPException(404, "Assegnazione non trovata")
    if user["role"] == "tecnico":
        t = TecnicoUpdate(**{k: v for k, v in body.items() if k in TecnicoUpdate.model_fields})
        sets = {k: v for k, v in t.model_dump().items() if v is not None}
        if sets.get("stato") == "consegnata":
            raise HTTPException(403, "La consegna viene registrata dalla segreteria")
    else:
        full = AssegnazioneIn(**{k: v for k, v in body.items() if k in AssegnazioneIn.model_fields})
        sets = full.model_dump()
        for k in ("note_tecniche", "prove_eseguite"):
            if k in body:
                sets[k] = str(body[k])
        if body.get("stato") in ("ricevuta", "in_prova", "completata", "consegnata"):
            sets["stato"] = body["stato"]
    sets["aggiornato"] = now()
    upd: dict = {"$set": sets}
    if "stato" in sets and sets["stato"] != a["stato"]:
        upd["$push"] = {"storico": {"stato": sets["stato"], "data": now(), "utente": user["username"]}}
    await db.assegnazioni.update_one({"_id": aid}, upd)
    await log(user, "assegnazione aggiornata", f"{a['numero_verbale']}" + (f" -> {sets['stato']}" if "stato" in sets else ""))
    return out(await db.assegnazioni.find_one({"_id": aid}))


# ------------------------------------------------------------------ certificati

def _verify_link(numero: str, chiave: str) -> str:
    return f"{settings.public_url}/#/certificati?v={quote(numero, safe='')}&k={quote(chiave, safe='')}"


async def _send_credentials(cert: dict, chiave: str, email: str) -> dict:
    subject, html_body, text = credentials_email(
        cert["numero_verbale"], chiave, _verify_link(cert["numero_verbale"], chiave), cert["materiali"],
        SETTORE_LABEL[cert["settore"]], STATO_CERT_LABEL[cert["stato"]], cert["destinatario_nome"],
    )
    try:
        provider = await send_email(email, subject, html_body, text)
        res = {"inviata": True, "provider": provider, "a": email}
    except MailError as e:
        res = {"inviata": False, "errore": str(e), "a": email}
    await db.certificati.update_one({"_id": cert["_id"]}, {"$push": {"email_log": {
        "tipo": "credenziali", "quando": now(), **res}}})
    return res


@api.get("/staff/certificati")
async def list_certificati(q: str = "", stato: str = "", settore: str = "", user: dict = Depends(STAFF)):
    f: dict = {}
    if q:
        f["$or"] = [{k: regex(q)} for k in ("numero_verbale", "materiali", "destinatario_nome", "destinatario_email")]
    if stato:
        f["stato"] = stato
    if settore:
        f["settore"] = settore
    items = await db.certificati.find(f).sort("created", -1).to_list(500)
    return [out(i) for i in items]


@api.post("/staff/certificati")
async def create_certificato(body: CertificatoIn, user: dict = Depends(SEGRETERIA)):
    ass = None
    if body.assegnazione_id:
        ass = await db.assegnazioni.find_one({"_id": body.assegnazione_id})
        if not ass:
            raise HTTPException(404, "Assegnazione non trovata")
        if ass.get("certificato_id"):
            raise HTTPException(409, "Per questa assegnazione esiste già un certificato")
    numero = ass["numero_verbale"] if ass else await next_verbale()
    chiave = new_key()
    cid = new_id()
    doc = {
        "_id": cid, "numero_verbale": numero, "chiave_hash": hash_key(chiave),
        "assegnazione_id": body.assegnazione_id, "settore": body.settore,
        "destinatario_nome": body.destinatario_nome.strip(), "destinatario_email": body.destinatario_email,
        "materiali": body.materiali.strip(), "tipo_prove": body.tipo_prove, "norme": body.norme,
        "formato": body.formato, "stato": body.stato, "note_pubbliche": body.note_pubbliche,
        "note_interne": body.note_interne, "created": now(), "aggiornato": now(), "creato_da": user["username"],
        "data_pronto": now() if body.stato != "in_lavorazione" else None, "email_log": [],
        "storico": [{"stato": body.stato, "data": now(), "utente": user["username"]}],
    }
    await db.certificati.insert_one(doc)
    if ass:
        await db.assegnazioni.update_one({"_id": ass["_id"]}, {"$set": {"certificato_id": cid, "aggiornato": now()}})
    email_res = None
    if body.invia_email:
        email_res = await _send_credentials(doc, chiave, body.destinatario_email)
    await log(user, "certificato emesso", f"{numero} -> {body.destinatario_email}" + ("" if not email_res or email_res["inviata"] else " (EMAIL NON INVIATA)"))
    # La chiave in chiaro viene restituita solo ora: in caso di email fallita la segreteria può comunicarla a mano.
    return {"certificato": out(await db.certificati.find_one({"_id": cid})), "chiave": chiave, "email": email_res}


@api.get("/staff/certificati/{cid}")
async def get_certificato(cid: str, user: dict = Depends(STAFF)):
    c = await db.certificati.find_one({"_id": cid})
    if not c:
        raise HTTPException(404, "Certificato non trovato")
    res = out(c)
    docs = await db.documents.find({"certificato_id": cid}).sort("created", -1).to_list(100)
    res["documenti"] = [_staff_doc(d) for d in docs]
    return res


@api.post("/staff/certificati/{cid}/stato")
async def set_stato_certificato(cid: str, body: CertificatoStato, user: dict = Depends(SEGRETERIA)):
    c = await db.certificati.find_one({"_id": cid})
    if not c:
        raise HTTPException(404, "Certificato non trovato")
    sets = {"stato": body.stato, "aggiornato": now()}
    if body.note_pubbliche is not None:
        sets["note_pubbliche"] = body.note_pubbliche
    if body.stato in ("pronto", "consegnato") and not c.get("data_pronto"):
        sets["data_pronto"] = now()
    upd = {"$set": sets}
    if body.stato != c["stato"]:
        upd["$push"] = {"storico": {"stato": body.stato, "data": now(), "utente": user["username"]}}
    await db.certificati.update_one({"_id": cid}, upd)
    if c.get("assegnazione_id"):
        extra = {}
        if body.stato == "pronto":
            extra = {"stato": "completata", "conservazione_fino": (date.today() + timedelta(days=90)).isoformat()}
        elif body.stato == "consegnato":
            extra = {"stato": "consegnata"}
        if extra:
            await db.assegnazioni.update_one({"_id": c["assegnazione_id"]}, {"$set": {**extra, "aggiornato": now()}})
    email_res = None
    if body.stato == "pronto" and body.invia_email and c["stato"] != "pronto":
        attachments = []
        if c["formato"] == "pdf_firmato":
            d = await db.documents.find_one({"certificato_id": cid, "categoria": "Certificato firmato"})
            if d and d["files"]:
                blob = await db.files.find_one({"_id": d["files"][0]["file_id"]})
                if blob:
                    attachments.append({"name": d["files"][0]["filename"], "data": bytes(blob["data"])})
        subject, html_body, text = ready_email(
            c["numero_verbale"], f"{settings.public_url}/#/certificati", body.note_pubbliche or "", bool(attachments))
        try:
            provider = await send_email(c["destinatario_email"], subject, html_body, text, attachments)
            email_res = {"inviata": True, "provider": provider, "a": c["destinatario_email"]}
        except MailError as e:
            email_res = {"inviata": False, "errore": str(e), "a": c["destinatario_email"]}
        await db.certificati.update_one({"_id": cid}, {"$push": {"email_log": {"tipo": "pronto", "quando": now(), **email_res}}})
    await log(user, "certificato aggiornato", f"{c['numero_verbale']} -> {body.stato}")
    return {"certificato": out(await db.certificati.find_one({"_id": cid})), "email": email_res}


@api.post("/staff/certificati/{cid}/reinvia")
async def reinvia_credenziali(cid: str, body: ReinvioIn, user: dict = Depends(SEGRETERIA)):
    """Genera una NUOVA chiave (la vecchia smette di funzionare) e la invia."""
    c = await db.certificati.find_one({"_id": cid})
    if not c:
        raise HTTPException(404, "Certificato non trovato")
    chiave = new_key()
    email = body.destinatario_email or c["destinatario_email"]
    update = {"chiave_hash": hash_key(chiave), "aggiornato": now()}
    if body.destinatario_email:
        update["destinatario_email"] = email
    await db.certificati.update_one({"_id": cid}, {"$set": update})
    c.update(update)
    res = await _send_credentials(c, chiave, email)
    await log(user, "credenziali reinviate", f"{c['numero_verbale']} -> {email}")
    return {"chiave": chiave, "email": res}


# ------------------------------------------------------------------ documenti

def _staff_doc(d: dict) -> dict:
    o = out(d)
    o["files"] = [{"idx": i, "formato": f["formato"], "filename": f["filename"], "size": f["size"]} for i, f in enumerate(d["files"])]
    return o


@api.get("/staff/documenti")
async def staff_documenti(user: dict = Depends(STAFF)):
    docs = await db.documents.find({}).sort("created", -1).to_list(1000)
    return [_staff_doc(d) for d in docs]


@api.post("/staff/documenti")
async def upload_documento(
    titolo: str = Form(...), categoria: str = Form("Altro"), pubblico: bool = Form(False),
    assegnazione_id: str = Form(""), certificato_id: str = Form(""), file: UploadFile = File(...),
    user: dict = Depends(STAFF),
):
    if pubblico and user["role"] == "tecnico":
        raise HTTPException(403, "Solo la segreteria può pubblicare documenti sul sito")
    data = await file.read()
    if len(data) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(413, f"File troppo grande (massimo {settings.max_upload_mb} MB)")
    if not data:
        raise HTTPException(400, "File vuoto")
    fid = new_id()
    await db.files.insert_one({"_id": fid, "data": data})
    fname = Path(file.filename or "documento").name
    ext = fname.rsplit(".", 1)[-1].lower() if "." in fname else "bin"
    last = await db.documents.find_one({"pubblico": True}, sort=[("ordine", -1)])
    doc = {
        "_id": new_id(), "titolo": titolo.strip(), "categoria": categoria.strip() or "Altro",
        "pubblico": pubblico, "ordine": (last["ordine"] + 1) if last else 0,
        "assegnazione_id": assegnazione_id or None, "certificato_id": certificato_id or None,
        "files": [{"file_id": fid, "filename": fname, "formato": ext, "size": len(data), "content_type": file.content_type}],
        "creato_da": user["username"], "created": now(),
    }
    await db.documents.insert_one(doc)
    await log(user, "documento caricato", f"{doc['titolo']} ({'pubblico' if pubblico else 'interno'})")
    return _staff_doc(doc)


@api.get("/staff/documenti/{doc_id}/file/{idx}")
async def staff_documento_file(doc_id: str, idx: int, user: dict = Depends(STAFF)):
    return await _file_response(await db.documents.find_one({"_id": doc_id}), idx)


@api.delete("/staff/documenti/{doc_id}")
async def delete_documento(doc_id: str, user: dict = Depends(STAFF)):
    d = await db.documents.find_one({"_id": doc_id})
    if not d:
        raise HTTPException(404, "Documento non trovato")
    if user["role"] == "tecnico" and (d["creato_da"] != user["username"] or d.get("pubblico")):
        raise HTTPException(403, "Puoi eliminare solo i tuoi documenti interni")
    for f in d["files"]:
        await db.files.delete_one({"_id": f["file_id"]})
    await db.documents.delete_one({"_id": doc_id})
    await log(user, "documento eliminato", d["titolo"])
    return {"ok": True}


# ------------------------------------------------------------------ avviso, dashboard, log

@api.put("/staff/avviso")
async def set_avviso(body: AvvisoIn, user: dict = Depends(SEGRETERIA)):
    await db.settings.update_one({"_id": "avviso"}, {"$set": {**body.model_dump(), "aggiornato": now()}}, upsert=True)
    await log(user, "avviso modificato", body.titolo)
    return await public_avviso()


@api.get("/staff/dashboard")
async def dashboard(user: dict = Depends(STAFF)):
    async def count(col, f):
        return await db[col].count_documents(f)
    ass = {s: await count("assegnazioni", {"stato": s}) for s in ("ricevuta", "in_prova", "completata", "consegnata")}
    cert = {s: await count("certificati", {"stato": s}) for s in ("in_lavorazione", "pronto", "consegnato")}
    recenti = await db.assegnazioni.find({}).sort("created", -1).to_list(6)
    mie = await count("assegnazioni", {"assegnato_a": user["_id"], "stato": {"$in": ["ricevuta", "in_prova"]}})
    scadenze_limite = (date.today() + timedelta(days=14)).isoformat()
    scadenze = await db.assegnazioni.find({"conservazione_fino": {"$lte": scadenze_limite}, "stato": {"$ne": "archiviata"}}).sort("conservazione_fino", 1).to_list(10)
    return {"assegnazioni": ass, "certificati": cert, "mie_aperte": mie,
            "recenti": [out(r) for r in recenti], "scadenze_conservazione": [out(s) for s in scadenze]}


@api.get("/staff/log")
async def get_log(limit: int = 200, user: dict = Depends(ADMIN)):
    items = await db.logs.find({}).sort("quando", -1).to_list(min(limit, 1000))
    return [out(i) for i in items]


@api.get("/staff/colleghi")
async def colleghi(user: dict = Depends(STAFF)):
    """Elenco minimo di utenti (per assegnare un lavoro a un tecnico)."""
    users = await db.users.find({"active": True}).sort("name", 1).to_list(200)
    return [{"id": u["_id"], "name": u["name"], "role": u["role"]} for u in users]


app.include_router(api)

if FRONTEND.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND), html=True), name="site")
