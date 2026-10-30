"""Configurazione letta dalle variabili d'ambiente (vedi .env.example)."""
import os


def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


class Settings:
    mongodb_uri: str = _env("MONGODB_URI", "mock")  # "mock" = database in memoria (solo sviluppo)
    mongodb_db: str = _env("MONGODB_DB", "lpm_malignani")
    jwt_secret: str = _env("JWT_SECRET", "cambia-questo-segreto-in-produzione")
    token_hours: int = int(_env("TOKEN_HOURS", "10"))

    # Primo amministratore creato all'avvio se non esiste nessun utente
    admin_username: str = _env("ADMIN_USERNAME", "admin")
    admin_password: str = _env("ADMIN_PASSWORD", "")
    admin_name: str = _env("ADMIN_NAME", "Amministratore di sistema")
    admin_email: str = _env("ADMIN_EMAIL", "")

    public_url: str = _env("PUBLIC_URL", "http://localhost:8000").rstrip("/")

    # Email: brevo | resend | console
    email_provider: str = _env("EMAIL_PROVIDER", "console").lower()
    brevo_api_key: str = _env("BREVO_API_KEY")
    resend_api_key: str = _env("RESEND_API_KEY")
    mail_from: str = _env("MAIL_FROM", "laboratorio@malignani.ud.it")
    mail_from_name: str = _env("MAIL_FROM_NAME", "Laboratorio Prove Materiali - ITI Malignani")
    mail_reply_to: str = _env("MAIL_REPLY_TO", "laboratorio@malignani.ud.it")

    max_upload_mb: int = int(_env("MAX_UPLOAD_MB", "10"))


settings = Settings()
