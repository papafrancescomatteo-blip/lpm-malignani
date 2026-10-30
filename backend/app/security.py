"""Password, badge, chiavi di ricerca e token. Solo libreria standard + PyJWT."""
import base64
import hashlib
import hmac
import os
import secrets
import time

import jwt

from .config import settings

# Niente 0/O/1/I/L: la chiave viene letta da una email e digitata a mano
KEY_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    dk = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1, dklen=32)
    return "scrypt$" + base64.b64encode(salt).decode() + "$" + base64.b64encode(dk).decode()


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, salt_b64, dk_b64 = stored.split("$")
        if scheme != "scrypt":
            return False
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(dk_b64)
        dk = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1, dklen=32)
        return hmac.compare_digest(dk, expected)
    except Exception:
        return False


def _hmac(value: str) -> str:
    return hmac.new(settings.jwt_secret.encode(), value.encode(), hashlib.sha256).hexdigest()


def hash_badge(code: str) -> str:
    return _hmac("badge:" + code.strip())


def normalize_key(key: str) -> str:
    return "".join(ch for ch in key.upper() if ch.isalnum())


def new_key() -> str:
    raw = "".join(secrets.choice(KEY_ALPHABET) for _ in range(10))
    return raw[:5] + "-" + raw[5:]


def hash_key(key: str) -> str:
    return _hmac("key:" + normalize_key(key))


def make_token(user: dict) -> str:
    now = int(time.time())
    payload = {
        "sub": user["_id"],
        "role": user["role"],
        "iat": now,
        "exp": now + settings.token_hours * 3600,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
