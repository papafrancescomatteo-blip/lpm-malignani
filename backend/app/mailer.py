"""Invio email via API HTTPS (Brevo o Resend). Niente SMTP: Render blocca le porte SMTP sul piano gratuito."""
import asyncio
import base64
import html
import json
import urllib.error
import urllib.request

from .config import settings


class MailError(Exception):
    pass


def _post(url: str, headers: dict, body: dict) -> None:
    req = urllib.request.Request(
        url, data=json.dumps(body).encode(), headers={"Content-Type": "application/json", **headers}, method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            resp.read()
    except urllib.error.HTTPError as e:
        raise MailError(f"{e.code} {e.read().decode(errors='ignore')[:300]}")
    except Exception as e:  # rete, timeout...
        raise MailError(str(e))


def _send_sync(to: str, subject: str, html_body: str, text_body: str, attachments: list | None) -> str:
    provider = settings.email_provider
    attachments = attachments or []
    if provider == "brevo":
        if not settings.brevo_api_key:
            raise MailError("BREVO_API_KEY mancante")
        body = {
            "sender": {"name": settings.mail_from_name, "email": settings.mail_from},
            "to": [{"email": to}],
            "replyTo": {"email": settings.mail_reply_to},
            "subject": subject,
            "htmlContent": html_body,
            "textContent": text_body,
        }
        if attachments:
            body["attachment"] = [{"name": a["name"], "content": base64.b64encode(a["data"]).decode()} for a in attachments]
        _post("https://api.brevo.com/v3/smtp/email", {"api-key": settings.brevo_api_key}, body)
        return "brevo"
    if provider == "resend":
        if not settings.resend_api_key:
            raise MailError("RESEND_API_KEY mancante")
        body = {
            "from": f"{settings.mail_from_name} <{settings.mail_from}>",
            "to": [to],
            "reply_to": settings.mail_reply_to,
            "subject": subject,
            "html": html_body,
            "text": text_body,
        }
        if attachments:
            body["attachments"] = [{"filename": a["name"], "content": base64.b64encode(a["data"]).decode()} for a in attachments]
        _post("https://api.resend.com/emails", {"Authorization": f"Bearer {settings.resend_api_key}"}, body)
        return "resend"
    # console: utile in sviluppo, non invia nulla
    print(f"[EMAIL console] a={to} oggetto={subject}\n{text_body}\n")
    return "console"


async def send_email(to: str, subject: str, html_body: str, text_body: str, attachments: list | None = None) -> str:
    """Restituisce il nome del provider usato. Solleva MailError se l'invio fallisce."""
    return await asyncio.to_thread(_send_sync, to, subject, html_body, text_body, attachments)


# ---------------------------------------------------------------- template

def _layout(title: str, inner: str) -> str:
    return f"""<!doctype html><html lang="it"><body style="margin:0;background:#eef2f8;font-family:Segoe UI,Arial,sans-serif;color:#10213f">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden">
<tr><td style="background:#0b2447;padding:22px 28px;color:#fff">
<div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#f5a54a">ITI Arturo Malignani &middot; Udine</div>
<div style="font-size:20px;font-weight:700;margin-top:4px">Laboratorio Prove Materiali</div></td></tr>
<tr><td style="padding:28px"><h1 style="font-size:20px;margin:0 0 14px">{html.escape(title)}</h1>{inner}</td></tr>
<tr><td style="background:#f5f7fb;padding:16px 28px;font-size:12px;color:#5b6b86">
Viale Leonardo da Vinci 10, 33100 Udine &middot; Tel. 0432 46361 (digitare 8)<br>
<a href="mailto:laboratorio@malignani.ud.it" style="color:#2a5ba8">laboratorio@malignani.ud.it</a> &middot; PEC laboratorio.malignani@pec.it</td></tr>
</table></td></tr></table></body></html>"""


def credentials_email(numero_verbale: str, chiave: str, link: str, materiali: str, settore: str, stato_label: str, destinatario_nome: str):
    nome = html.escape(destinatario_nome or "")
    inner = f"""<p style="line-height:1.55">Gentile {nome or 'cliente'},<br>il Laboratorio Prove Materiali ha registrato la sua richiesta. Con le credenziali qui sotto potrà <b>verificare in qualsiasi momento lo stato di lavorazione del certificato</b> dal nostro sito.</p>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fb;border-radius:10px;margin:18px 0"><tr><td style="padding:18px 20px">
<div style="font-size:12px;color:#5b6b86;text-transform:uppercase;letter-spacing:.08em">Numero di verbale</div>
<div style="font-size:24px;font-weight:700;letter-spacing:.04em">{html.escape(numero_verbale)}</div>
<div style="font-size:12px;color:#5b6b86;text-transform:uppercase;letter-spacing:.08em;margin-top:14px">Chiave di ricerca</div>
<div style="font-size:24px;font-weight:700;letter-spacing:.12em;font-family:Consolas,monospace;color:#c25a00">{html.escape(chiave)}</div></td></tr></table>
<p style="font-size:14px;line-height:1.6"><b>Settore:</b> {html.escape(settore)}<br><b>Materiali:</b> {html.escape(materiali or '-')}<br><b>Stato attuale:</b> {html.escape(stato_label)}</p>
<p style="margin:22px 0"><a href="{html.escape(link)}" style="background:#f28c28;color:#0b2447;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:8px;display:inline-block">Verifica lo stato del certificato</a></p>
<p style="font-size:13px;color:#5b6b86;line-height:1.55">Conservi questa email: la chiave di ricerca è personale. Il laboratorio conserva i materiali per 90 giorni dalla data di emissione del rapporto di prova. Per informazioni risponda a questa email o telefoni allo 0432 46361 (digitare 8).</p>"""
    text = (
        f"Gentile {destinatario_nome or 'cliente'},\n\nIl Laboratorio Prove Materiali dell'ITI Malignani ha registrato la sua richiesta.\n\n"
        f"Numero di verbale: {numero_verbale}\nChiave di ricerca: {chiave}\nSettore: {settore}\nMateriali: {materiali or '-'}\nStato: {stato_label}\n\n"
        f"Verifica lo stato: {link}\n\nLaboratorio Prove Materiali - Viale Leonardo da Vinci 10, Udine - Tel. 0432 46361 (digitare 8)"
    )
    return f"Credenziali per il certificato n. {numero_verbale}", _layout("Credenziali per seguire il suo certificato", inner), text


def ready_email(numero_verbale: str, link: str, nota: str, with_attachment: bool):
    extra = "<p style='font-size:14px'>In allegato trova il certificato in formato PDF.</p>" if with_attachment else (
        "<p style='font-size:14px'>Può ritirarlo presso il laboratorio negli orari di apertura, oppure attendere la spedizione concordata.</p>"
    )
    nota_html = f"<p style='font-size:14px;background:#fff7ec;border-left:4px solid #f28c28;padding:10px 14px'>{html.escape(nota)}</p>" if nota else ""
    inner = f"""<p style="line-height:1.55">Il certificato relativo al verbale <b>{html.escape(numero_verbale)}</b> è <b>pronto</b>.</p>{extra}{nota_html}
<p style="margin:22px 0"><a href="{html.escape(link)}" style="background:#f28c28;color:#0b2447;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:8px;display:inline-block">Vedi lo stato</a></p>"""
    text = f"Il certificato relativo al verbale {numero_verbale} e' pronto.\n{nota or ''}\nVerifica: {link}"
    return f"Certificato n. {numero_verbale} pronto", _layout("Il suo certificato è pronto", inner), text
