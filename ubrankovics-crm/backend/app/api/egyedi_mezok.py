"""Egyedi mezők: az admin ügyfélhez / érdeklődőhöz extra mezőket definiál,
bárki kitöltheti őket."""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import User, UserRole
from app.models_ext import EgyediMezo, EgyediMezoErtek
from app.schemas_ext import EgyediMezoCreate, EgyediMezoErtekItem, EgyediMezoErtekPut, EgyediMezoResponse
from app.services.audit import log_audit

router = APIRouter(prefix="/egyedi-mezok", tags=["egyedi-mezok"])

_ENTITASOK = ("ugyfel", "erdeklodes")
_TIPUSOK = ("szoveg", "szam", "datum")


def _check_entitas(entitas: str) -> None:
    if entitas not in _ENTITASOK:
        raise HTTPException(status_code=400, detail="entitas: ugyfel vagy erdeklodes")


@router.get("", response_model=list[EgyediMezoResponse])
def list_mezok(
    entitas: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(EgyediMezo)
    if entitas:
        q = q.filter(EgyediMezo.entitas == entitas)
    return q.order_by(EgyediMezo.entitas, EgyediMezo.sorrend, EgyediMezo.id).all()


@router.post("", response_model=EgyediMezoResponse, status_code=201)
def create_mezo(
    body: EgyediMezoCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN)),
):
    _check_entitas(body.entitas)
    if body.tipus not in _TIPUSOK:
        raise HTTPException(status_code=400, detail="tipus: szoveg, szam vagy datum")
    nev = body.nev.strip()
    if not nev:
        raise HTTPException(status_code=400, detail="A mező neve kötelező")
    sorrend = db.query(EgyediMezo).filter(EgyediMezo.entitas == body.entitas).count()
    mezo = EgyediMezo(entitas=body.entitas, nev=nev, tipus=body.tipus, sorrend=sorrend)
    db.add(mezo)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Ilyen nevű mező már létezik")
    log_audit(db, user, "egyedi_mezo", mezo.id, "letrehozas", f"{body.entitas}: {nev}")
    db.commit()
    db.refresh(mezo)
    return mezo


@router.delete("/{mezo_id}", status_code=204)
def delete_mezo(
    mezo_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN)),
):
    mezo = db.query(EgyediMezo).get(mezo_id)
    if not mezo:
        raise HTTPException(status_code=404, detail="Mező not found")
    db.query(EgyediMezoErtek).filter(EgyediMezoErtek.mezo_id == mezo_id).delete()
    log_audit(db, user, "egyedi_mezo", mezo.id, "torles", f"{mezo.entitas}: {mezo.nev}")
    db.delete(mezo)
    db.commit()


@router.get("/ertekek", response_model=list[EgyediMezoErtekItem])
def get_ertekek(
    entitas: str,
    entitas_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    _check_entitas(entitas)
    mezok = db.query(EgyediMezo).filter(EgyediMezo.entitas == entitas).order_by(EgyediMezo.sorrend, EgyediMezo.id).all()
    ertekek = {
        e.mezo_id: e.ertek
        for e in db.query(EgyediMezoErtek).filter(EgyediMezoErtek.entitas_id == entitas_id)
        if e.mezo_id in {m.id for m in mezok}
    }
    return [EgyediMezoErtekItem(mezo_id=m.id, nev=m.nev, tipus=m.tipus, ertek=ertekek.get(m.id)) for m in mezok]


@router.put("/ertekek", response_model=list[EgyediMezoErtekItem])
def put_ertekek(
    body: EgyediMezoErtekPut,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _check_entitas(body.entitas)
    mezok = {m.id: m for m in db.query(EgyediMezo).filter(EgyediMezo.entitas == body.entitas)}
    for mezo_id, ertek in body.ertekek.items():
        mezo = mezok.get(mezo_id)
        if not mezo:
            raise HTTPException(status_code=404, detail=f"Mező {mezo_id} nem ehhez az entitáshoz tartozik")
        ertek = (ertek or "").strip()
        if ertek:
            try:
                if mezo.tipus == "szam":
                    float(ertek.replace(",", "."))
                elif mezo.tipus == "datum":
                    date.fromisoformat(ertek)
            except ValueError:
                raise HTTPException(status_code=400, detail=f"'{mezo.nev}': érvénytelen {mezo.tipus} érték")
        row = (
            db.query(EgyediMezoErtek)
            .filter(EgyediMezoErtek.mezo_id == mezo_id, EgyediMezoErtek.entitas_id == body.entitas_id)
            .first()
        )
        if not ertek:
            if row:
                db.delete(row)
        elif row:
            row.ertek = ertek
        else:
            db.add(EgyediMezoErtek(mezo_id=mezo_id, entitas_id=body.entitas_id, ertek=ertek))
    log_audit(db, user, body.entitas, body.entitas_id, "egyedi_mezo_ertek", f"{len(body.ertekek)} mező")
    db.commit()
    return get_ertekek(body.entitas, body.entitas_id, db, user)
