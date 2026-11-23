"""Értesítések / emlékeztetők: élőben számolt lista + e-mailes napi összefoglaló
beállítása. A gyűjtés logikája: services/ertesitesek.py."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.schemas_crm import ErtesitesItem
from app.services.ertesitesek import gyujtsd_ertesiteseket, kuldj_osszefoglalot

router = APIRouter(prefix="/ertesitesek", tags=["ertesitesek"])


class EmailBeallitas(BaseModel):
    email_ertesites: bool
    email: str


class EmailBeallitasPut(BaseModel):
    email_ertesites: bool


class KuldesEredmeny(BaseModel):
    allapot: str  # elkuldve | nincs_teendo | nincs_smtp


@router.get("", response_model=list[ErtesitesItem])
def list_ertesitesek(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return gyujtsd_ertesiteseket(db, user)


@router.get("/beallitas", response_model=EmailBeallitas)
def get_beallitas(user: User = Depends(get_current_user)):
    return EmailBeallitas(email_ertesites=bool(user.email_ertesites), email=user.email)


@router.put("/beallitas", response_model=EmailBeallitas)
def put_beallitas(
    body: EmailBeallitasPut,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    user.email_ertesites = body.email_ertesites
    db.commit()
    return EmailBeallitas(email_ertesites=user.email_ertesites, email=user.email)


@router.post("/kuldes-most", response_model=KuldesEredmeny)
def kuldes_most(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Azonnal elküldi a saját összefoglalót (a napi korlátot figyelmen kívül hagyva)."""
    return KuldesEredmeny(allapot=kuldj_osszefoglalot(db, user, force=True))
