"""RFC 6238 TOTP (HMAC-SHA1, 30 mp, 6 számjegy) külső függőség nélkül."""

import base64
import hashlib
import hmac
import secrets
import struct
import time
from urllib.parse import quote

PERIOD = 30
DIGITS = 6


def new_secret() -> str:
    return base64.b32encode(secrets.token_bytes(20)).decode().rstrip("=")


def _code(secret: str, step: int) -> str:
    key = base64.b32decode(secret + "=" * (-len(secret) % 8), casefold=True)
    digest = hmac.new(key, struct.pack(">Q", step), hashlib.sha1).digest()
    off = digest[-1] & 0x0F
    value = (struct.unpack(">I", digest[off : off + 4])[0] & 0x7FFFFFFF) % 10**DIGITS
    return str(value).zfill(DIGITS)


def current_step(now: float | None = None) -> int:
    return int((now if now is not None else time.time()) // PERIOD)


def verify(secret: str, code: str, now: float | None = None, last_step: int = 0) -> int | None:
    """A talált időlépést adja vissza (±1 lépés tolerancia), vagy None-t.
    A last_step-nél nem újabb lépés elutasított: egy kód nem használható kétszer."""
    code = (code or "").strip().replace(" ", "")
    if len(code) != DIGITS or not code.isdigit():
        return None
    step = current_step(now)
    for s in (step - 1, step, step + 1):
        if s > last_step and hmac.compare_digest(_code(secret, s), code):
            return s
    return None


def otpauth_uri(secret: str, account: str, issuer: str = "Ubrankovics CRM") -> str:
    return f"otpauth://totp/{quote(issuer)}:{quote(account)}?secret={secret}&issuer={quote(issuer)}&digits={DIGITS}&period={PERIOD}"
