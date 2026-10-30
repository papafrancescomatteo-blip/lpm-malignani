"""Modelli dei dati ricevuti dall'API. Campi ricavati dai modelli di domanda D_UFF_07..11."""
import re
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

Role = Literal["admin", "segreteria", "tecnico"]
Settore = Literal["meccanica", "edilizia", "cicli"]
StatoAssegnazione = Literal["ricevuta", "in_prova", "completata", "consegnata"]
StatoCertificato = Literal["in_lavorazione", "pronto", "consegnato"]

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]{2,}$")


def check_email(value: str) -> str:
    value = (value or "").strip()
    if not EMAIL_RE.match(value):
        raise ValueError("indirizzo email non valido")
    return value


class LoginIn(BaseModel):
    username: str
    password: str


class BadgeIn(BaseModel):
    badge: str = Field(min_length=3, max_length=64)


class UserIn(BaseModel):
    username: str = Field(min_length=3, max_length=40)
    name: str = Field(min_length=2, max_length=80)
    email: str = ""
    role: Role
    password: Optional[str] = Field(default=None, min_length=8, max_length=100)
    badge: Optional[str] = Field(default=None, max_length=64)  # "" = rimuove il badge
    active: bool = True


class Parte(BaseModel):
    """Richiedente, azienda o committente."""
    nome: str = ""
    indirizzo: str = ""
    email: str = ""
    pec: str = ""
    telefono: str = ""


class Fatturazione(BaseModel):
    intestatario: Literal["richiedente", "azienda", "committente", "impresa"] = "richiedente"
    partita_iva: str = ""
    codice_fiscale: str = ""
    email_fattura: str = ""
    pec_o_sdi: str = ""


class Campione(BaseModel):
    sigla: str = ""
    descrizione: str = ""
    quantita: str = ""
    note: str = ""


class AssegnazioneIn(BaseModel):
    modello: Literal["D_UFF_07", "D_UFF_08", "D_UFF_09", "D_UFF_10", "D_UFF_11"] = "D_UFF_08"
    settore: Settore
    data_arrivo: str
    priorita: Literal["normale", "urgente"] = "normale"
    richiedente: Parte
    qualita_richiedente: str = ""  # direttore lavori, collaudatore, direttore tecnico...
    azienda: Parte = Parte()
    committente: Parte = Parte()
    costruzione: str = ""
    localita: str = ""
    materiali: str = Field(min_length=2)  # denominazione sul frontespizio del rapporto
    tipo_prove: str = ""
    norme: str = ""
    campioni: list[Campione] = []
    ddt: str = ""
    verbale_prelievo_n: str = ""
    verbale_prelievo_data: str = ""
    fatturazione: Fatturazione = Fatturazione()
    formato_rapporto: Literal["pdf_firmato", "cartaceo"] = "pdf_firmato"
    copie: int = Field(default=1, ge=0, le=20)
    consegna: Literal["ritiro_a_mano", "posta_ordinaria", "pec"] = "ritiro_a_mano"
    delega_consegna: str = ""
    email_avviso: str = ""
    restituzione_campioni: bool = False
    assegnato_a: Optional[str] = None
    note: str = ""

    @field_validator("data_arrivo")
    @classmethod
    def _date(cls, v: str) -> str:
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", v):
            raise ValueError("data non valida (AAAA-MM-GG)")
        return v


class TecnicoUpdate(BaseModel):
    """Cosa può modificare un tecnico di laboratorio."""
    stato: Optional[StatoAssegnazione] = None
    note_tecniche: Optional[str] = None
    prove_eseguite: Optional[str] = None


class CertificatoIn(BaseModel):
    assegnazione_id: Optional[str] = None
    settore: Settore
    destinatario_nome: str = Field(min_length=2)  # richiedente a cui scrivere
    destinatario_email: str
    materiali: str = Field(min_length=2)
    tipo_prove: str = ""
    norme: str = ""
    formato: Literal["pdf_firmato", "cartaceo"] = "pdf_firmato"
    stato: StatoCertificato = "in_lavorazione"
    note_pubbliche: str = ""  # visibili a chi verifica lo stato
    note_interne: str = ""
    invia_email: bool = True

    @field_validator("destinatario_email")
    @classmethod
    def _email(cls, v: str) -> str:
        return check_email(v)


class CertificatoStato(BaseModel):
    stato: StatoCertificato
    note_pubbliche: Optional[str] = None
    invia_email: bool = True


class ReinvioIn(BaseModel):
    destinatario_email: Optional[str] = None

    @field_validator("destinatario_email")
    @classmethod
    def _email(cls, v):
        return check_email(v) if v else v


class VerificaIn(BaseModel):
    numero_verbale: str = Field(min_length=3, max_length=30)
    chiave: str = Field(min_length=4, max_length=30)


class AvvisoIn(BaseModel):
    attivo: bool = True
    titolo: str = Field(default="", max_length=120)
    testo: str = Field(default="", max_length=800)
