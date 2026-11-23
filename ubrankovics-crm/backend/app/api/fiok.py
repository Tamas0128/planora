"""Fiókkezelés: elfelejtett jelszó (e-mailes token) és kétlépcsős belépés (TOTP)."""

import hashlib
import logging
import secrets
from datetime import datetime, timedelta
from html import escape

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.auth import _check_login_rate
from app.config import settings
from app.core import totp
from app.core.security import hash_password, verify_password
from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import User, UserRole
from app.models_auth import JelszoVisszaallitas
from app.services.audit import log_audit
from app.services.email import send_email

router = APIRouter(prefix="/auth", tags=["fiok"])
logger = logging.getLogger("ubrankovics.fiok")

TOKEN_ERVENYESSEG = timedelta(hours=1)
MIN_JELSZO = 8
GENERIKUS_VALASZ = {"uzenet": "Ha a megadott fiók létezik, e-mailben elküldtük a jelszó-visszaállító linket."}


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


class ForgotRequest(BaseModel):
    azonosito: str = Field(min_length=1, description="Felhasználónév vagy e-mail")


class ResetRequest(BaseModel):
    token: str = Field(min_length=10)
    password: str = Field(min_length=MIN_JELSZO)


@router.post("/elfelejtett-jelszo")
def elfelejtett_jelszo(request: Request, body: ForgotRequest, db: Session = Depends(get_db)):
    """Mindig ugyanazt válaszolja, hogy a végpont ne árulja el, mely fiókok léteznek."""
    _check_login_rate(request)
    az = body.azonosito.strip()
    user = db.query(User).filter(or_(User.username == az, User.email == az), User.is_active.is_(True)).first()
    if user:
        now = datetime.utcnow()
        for r in db.query(JelszoVisszaallitas).filter(
            JelszoVisszaallitas.user_id == user.id, JelszoVisszaallitas.felhasznalva_at.is_(None)
        ):
            r.felhasznalva_at = now  # a korábbi linkek érvénytelenek
        token = secrets.token_urlsafe(32)
        db.add(JelszoVisszaallitas(user_id=user.id, token_hash=_hash(token), lejar=now + TOKEN_ERVENYESSEG))
        log_audit(db, user, "user", user.id, "jelszo_visszaallitas_kerve")
        db.commit()
        link = f"{settings.public_base_url}/uj-jelszo?token={token}"
        try:
            kuldve = send_email(
                user.email,
                "Jelszó-visszaállítás – Ubrankovics CRM",
                f"<p>Kedves {escape(user.full_name)}!</p>"
                f'<p>Jelszó-visszaállítást kértek a fiókodhoz. <a href="{escape(link)}">Új jelszó megadása</a> '
                "(a link 1 óráig érvényes).</p><p>Ha nem te kérted, hagyd figyelmen kívül ezt a levelet.</p>",
            )
            if not kuldve:
                logger.warning("Jelszó-visszaállító e-mail nem ment ki (SMTP nincs beállítva), user=%s", user.id)
        except Exception:  # noqa: BLE001 — a válasz nem árulkodhat az SMTP hibáról
            logger.exception("Jelszó-visszaállító e-mail küldése sikertelen, user=%s", user.id)
    return GENERIKUS_VALASZ


@router.post("/uj-jelszo")
def uj_jelszo(request: Request, body: ResetRequest, db: Session = Depends(get_db)):
    _check_login_rate(request)
    rec = db.query(JelszoVisszaallitas).filter(JelszoVisszaallitas.token_hash == _hash(body.token)).first()
    if not rec or rec.felhasznalva_at is not None or rec.lejar < datetime.utcnow():
        raise HTTPException(status_code=400, detail="A link érvénytelen vagy lejárt. Kérj új jelszó-visszaállítást.")
    user = db.query(User).get(rec.user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=400, detail="A link érvénytelen vagy lejárt. Kérj új jelszó-visszaállítást.")
    user.hashed_password = hash_password(body.password)
    rec.felhasznalva_at = datetime.utcnow()
    log_audit(db, user, "user", user.id, "jelszo_visszaallitva")
    db.commit()
    return {"uzenet": "A jelszó megváltozott, most már beléphetsz."}


# --- Kétlépcsős belépés (TOTP) -------------------------------------------------------------


class OtpCode(BaseModel):
    code: str


class OtpDisable(BaseModel):
    password: str
    code: str


@router.post("/2fa/beallitas")
def tfa_beallitas(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Új titkot generál (még nem aktív); az aktiválás a 2fa/bekapcsolas hívással történik."""
    if user.totp_enabled:
        raise HTTPException(status_code=409, detail="A kétlépcsős belépés már be van kapcsolva")
    user.totp_secret = totp.new_secret()
    db.commit()
    return {"secret": user.totp_secret, "otpauth_uri": totp.otpauth_uri(user.totp_secret, user.username)}


@router.post("/2fa/bekapcsolas")
def tfa_bekapcsolas(body: OtpCode, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.totp_enabled or not user.totp_secret:
        raise HTTPException(status_code=409, detail="Előbb indítsd el a beállítást")
    step = totp.verify(user.totp_secret, body.code)
    if step is None:
        raise HTTPException(status_code=400, detail="Hibás vagy lejárt hitelesítő kód")
    user.totp_enabled = True
    user.totp_utolso_lepes = step
    log_audit(db, user, "user", user.id, "2fa_bekapcsolva")
    db.commit()
    return {"totp_enabled": True}


@router.post("/2fa/kikapcsolas")
def tfa_kikapcsolas(body: OtpDisable, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if not user.totp_enabled or not user.totp_secret:
        raise HTTPException(status_code=409, detail="A kétlépcsős belépés nincs bekapcsolva")
    if not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Hibás jelszó")
    if totp.verify(user.totp_secret, body.code, last_step=user.totp_utolso_lepes or 0) is None:
        raise HTTPException(status_code=400, detail="Hibás vagy lejárt hitelesítő kód")
    user.totp_enabled = False
    user.totp_secret = None
    user.totp_utolso_lepes = 0
    log_audit(db, user, "user", user.id, "2fa_kikapcsolva")
    db.commit()
    return {"totp_enabled": False}


@router.post("/users/{user_id}/2fa-visszaallitas")
def tfa_admin_visszaallitas(
    user_id: int, db: Session = Depends(get_db), admin: User = Depends(require_roles(UserRole.ADMIN))
):
    """Elvesztett hitelesítő eszköz esetén az admin kikapcsolja a felhasználó 2FA-ját."""
    user = db.query(User).get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.totp_enabled = False
    user.totp_secret = None
    user.totp_utolso_lepes = 0
    log_audit(db, admin, "user", user.id, "2fa_admin_visszaallitas")
    db.commit()
    return {"totp_enabled": False}
