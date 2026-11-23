"""Verziózott vevői ajánlat: minden módosítás új verzió, a korábbiak megmaradnak."""

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Projekt, User
from app.models_projekt import AjanlatAllapot, AjanlatSor, AjanlatVerzio, VevoiAjanlat
from app.schemas_projekt import (
    AjanlatAllapotUpdate,
    AjanlatCreate,
    AjanlatResponse,
    AjanlatVerzioIn,
)
from app.services.audit import log_audit

router = APIRouter(tags=["vevoi-ajanlat"])


def _q(db: Session):
    return db.query(VevoiAjanlat).options(joinedload(VevoiAjanlat.verziok).joinedload(AjanlatVerzio.sorok))


def _get(db: Session, aid: int) -> VevoiAjanlat:
    a = _q(db).filter(VevoiAjanlat.id == aid).first()
    if not a:
        raise HTTPException(status_code=404, detail="Ajánlat not found")
    return a


def _uj_verzio(ajanlat: VevoiAjanlat, body: AjanlatVerzioIn, user: User) -> AjanlatVerzio:
    v = AjanlatVerzio(
        verzio=len(ajanlat.verziok) + 1,
        megjegyzes=body.megjegyzes,
        ervenyes_ig=body.ervenyes_ig,
        letrehozo_id=user.id,
        netto_osszeg=sum((s.mennyiseg * s.egysegar for s in body.sorok), Decimal(0)),
    )
    v.sorok = [AjanlatSor(sorrend=i, **s.model_dump()) for i, s in enumerate(body.sorok)]
    return v


@router.get("/projektek/{projekt_id}/ajanlatok", response_model=list[AjanlatResponse])
def list_ajanlatok(projekt_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    if not db.query(Projekt).get(projekt_id):
        raise HTTPException(status_code=404, detail="Projekt not found")
    return _q(db).filter(VevoiAjanlat.projekt_id == projekt_id).order_by(VevoiAjanlat.id.desc()).all()


@router.post("/projektek/{projekt_id}/ajanlatok", response_model=AjanlatResponse, status_code=201)
def create_ajanlat(
    projekt_id: int,
    body: AjanlatCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not db.query(Projekt).get(projekt_id):
        raise HTTPException(status_code=404, detail="Projekt not found")
    a = VevoiAjanlat(projekt_id=projekt_id, cim=body.cim)
    db.add(a)
    db.flush()
    a.verziok = [_uj_verzio(a, body, user)]
    log_audit(db, user, "ajanlat", a.id, "letrehozas", body.cim)
    db.commit()
    return _get(db, a.id)


@router.post("/ajanlatok/{ajanlat_id}/verziok", response_model=AjanlatResponse, status_code=201)
def uj_verzio(
    ajanlat_id: int,
    body: AjanlatVerzioIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    a = _get(db, ajanlat_id)
    if a.verziok and a.verziok[-1].allapot == AjanlatAllapot.ELFOGADVA:
        raise HTTPException(status_code=409, detail="Az elfogadott ajánlatnak nem hozható új verziója")
    v = _uj_verzio(a, body, user)
    # az előző, még függő verzió lecserélődik
    for r in a.verziok:
        if r.allapot in (AjanlatAllapot.TERVEZET, AjanlatAllapot.ELKULDVE):
            r.allapot = AjanlatAllapot.ELUTASITVA
    a.verziok.append(v)
    log_audit(db, user, "ajanlat", a.id, "uj_verzio", f"v{v.verzio}")
    db.commit()
    db.expire_all()
    return _get(db, ajanlat_id)


@router.patch("/ajanlat-verziok/{verzio_id}/allapot", response_model=AjanlatResponse)
def allapot(
    verzio_id: int,
    body: AjanlatAllapotUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    v = db.query(AjanlatVerzio).get(verzio_id)
    if not v:
        raise HTTPException(status_code=404, detail="Verzió not found")
    a = _get(db, v.ajanlat_id)
    if v.id != a.verziok[-1].id:
        raise HTTPException(status_code=409, detail="Csak a legutolsó verzió állapota módosítható")
    v.allapot = body.allapot
    log_audit(db, user, "ajanlat", a.id, "allapot", f"v{v.verzio}: {body.allapot.value}")
    db.commit()
    db.expire_all()
    return _get(db, a.id)


@router.delete("/ajanlatok/{ajanlat_id}", status_code=204)
def delete_ajanlat(ajanlat_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    a = _get(db, ajanlat_id)
    log_audit(db, user, "ajanlat", a.id, "torles", a.cim)
    db.delete(a)
    db.commit()
