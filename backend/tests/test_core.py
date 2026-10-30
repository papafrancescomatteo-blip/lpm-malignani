"""Test della logica centrale (senza database): python -m tests.test_core"""
import re
from app import security as s
from app.mailer import credentials_email, ready_email, _send_sync
from app.models import CertificatoIn, AssegnazioneIn, check_email

def test_password():
    h = s.hash_password("Segreta123")
    assert s.verify_password("Segreta123", h) and not s.verify_password("sbagliata", h)
    assert not s.verify_password("x", "garbage")

def test_key():
    k = s.new_key()
    assert re.fullmatch(r"[A-Z2-9]{5}-[A-Z2-9]{5}", k) and not set(k) & set("01OIL")
    assert s.hash_key(k) == s.hash_key(k.lower().replace("-", " "))   # tollerante a come la scrive l'utente
    assert s.hash_key(k) != s.hash_key(s.new_key())
    assert len({s.new_key() for _ in range(500)}) == 500

def test_badge_and_token():
    assert s.hash_badge(" 0012345 ") == s.hash_badge("0012345") != s.hash_badge("0012346")
    t = s.make_token({"_id": "u1", "role": "segreteria"})
    p = s.decode_token(t); assert p["sub"] == "u1" and p["role"] == "segreteria"
    try: s.decode_token(t + "x"); assert False
    except Exception: pass

def test_models():
    assert check_email("a@b.it") == "a@b.it"
    for bad in ("", "a@b", "a b@c.it"):
        try: check_email(bad); assert False, bad
        except ValueError: pass
    c = CertificatoIn(settore="edilizia", destinatario_nome="Rossi", destinatario_email="x@y.it", materiali="cls")
    assert c.stato == "in_lavorazione" and c.invia_email
    a = AssegnazioneIn(settore="cicli", data_arrivo="2026-10-30", richiedente={"nome": "Bici Srl"}, materiali="Telaio MTB")
    assert a.consegna == "ritiro_a_mano" and a.copie == 1
    try: AssegnazioneIn(settore="cicli", data_arrivo="30/10/2026", richiedente={}, materiali="x"); assert False
    except Exception: pass

def test_email():
    subj, html, text = credentials_email("2026/0007", "ABCDE-23456", "https://x/#/c", "Barre <b>", "Edilizia", "In lavorazione", "Mario")
    assert "2026/0007" in subj and "ABCDE-23456" in html and "ABCDE-23456" in text
    assert "<b>" not in html.split("Materiali:</b>")[1][:20]            # il contenuto utente è escapato
    assert "pronto" in ready_email("2026/0007", "https://x", "", False)[0].lower()
    assert _send_sync("a@b.it", "t", "<p>x</p>", "x", None) == "console"

if __name__ == "__main__":
    for n, f in list(globals().items()):
        if n.startswith("test_"): f(); print("ok", n)
