"""Érdeklődők (lead) + értékesítési pipeline."""

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Erdeklodes, ErdeklodesAllapot, Kommunikacio, Ugyfel, User
from app.services.audit import log_audit
from app.schemas_crm import (
    ErdeklodesCreate,
    ErdeklodesResponse,
    ErdeklodesUpdate,
    PipelineSzakasz,
    UgyfelResponse,
)

router = APIRouter(prefix="/erdeklodok", tags=["erdeklodok"])


def _query(db: Session):
    return db.query(Erdeklodes).options(joinedload(Erdeklodes.owner))


@router.get("", response_model=list[ErdeklodesResponse])
def list_erdeklodok(
    allapot: ErdeklodesAllapot | None = None,
    q: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = _query(db)
    if allapot is not None:
        query = query.filter(Erdeklodes.allapot == allapot)
    if q:
        query = query.filter(Erdeklodes.nev.ilike(f"%{q}%"))
    return query.order_by(Erdeklodes.created_at.desc()).all()


@router.get("/pipeline", response_model=list[PipelineSzakasz])
def pipeline(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    darab = dict(db.query(Erdeklodes.allapot, func.count(Erdeklodes.id)).group_by(Erdeklodes.allapot).all())
    ertek = dict(
        db.query(Erdeklodes.allapot, func.coalesce(func.sum(Erdeklodes.becsult_ertek), 0))
        .group_by(Erdeklodes.allapot)
        .all()
    )
    return [
        PipelineSzakasz(
            allapot=a,
            darab=darab.get(a, 0),
            ertek_osszesen=Decimal(str(ertek.get(a, 0))),
        )
        for a in ErdeklodesAllapot
    ]


@router.post("", response_model=ErdeklodesResponse, status_code=201)
def create_erdeklodes(
    body: ErdeklodesCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    data = body.model_dump()
    if data.get("owner_id") is None:
        data["owner_id"] = user.id
    erdeklodes = Erdeklodes(**data)
    db.add(erdeklodes)
    db.flush()
    log_audit(db, user, "erdeklodes", erdeklodes.id, "letrehozas", erdeklodes.nev)
    db.commit()
    return _query(db).filter(Erdeklodes.id == erdeklodes.id).first()


@router.get("/{erdeklodes_id}", response_model=ErdeklodesResponse)
def get_erdeklodes(
    erdeklodes_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    erdeklodes = _query(db).filter(Erdeklodes.id == erdeklodes_id).first()
    if not erdeklodes:
        raise HTTPException(status_code=404, detail="Érdeklődő not found")
    return erdeklodes


@router.patch("/{erdeklodes_id}", response_model=ErdeklodesResponse)
def update_erdeklodes(
    erdeklodes_id: int,
    body: ErdeklodesUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    erdeklodes = db.query(Erdeklodes).get(erdeklodes_id)
    if not erdeklodes:
        raise HTTPException(status_code=404, detail="Érdeklődő not found")
    adat = body.model_dump(exclude_unset=True)
    for field, value in adat.items():
        setattr(erdeklodes, field, value)
    if "allapot" in adat:
        log_audit(db, user, "erdeklodes", erdeklodes.id, "allapot", erdeklodes.allapot.value)
    else:
        log_audit(db, user, "erdeklodes", erdeklodes.id, "modositas")
    db.commit()
    return _query(db).filter(Erdeklodes.id == erdeklodes_id).first()


@router.post("/{erdeklodes_id}/konverzio", response_model=UgyfelResponse, status_code=201)
def konverzio(
    erdeklodes_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Érdeklődőből ügyfél: létrehozza az Ügyfelet, a lead 'nyert' lesz és
    hozzákötődik; a kommunikációs napló átkerül az új ügyfélhez is."""
    erdeklodes = db.query(Erdeklodes).get(erdeklodes_id)
    if not erdeklodes:
        raise HTTPException(status_code=404, detail="Érdeklődő not found")
    if erdeklodes.ugyfel_id is not None:
        raise HTTPException(status_code=409, detail="Már ügyféllé konvertálva")
    ugyfel = Ugyfel(
        nev=erdeklodes.nev,
        telefon=erdeklodes.telefon,
        email=erdeklodes.email,
        owner_id=erdeklodes.owner_id or user.id,
    )
    db.add(ugyfel)
    db.flush()
    erdeklodes.ugyfel_id = ugyfel.id
    erdeklodes.allapot = ErdeklodesAllapot.NYERT
    for k in db.query(Kommunikacio).filter(Kommunikacio.erdeklodes_id == erdeklodes.id).all():
        k.ugyfel_id = ugyfel.id
    log_audit(db, user, "erdeklodes", erdeklodes.id, "konverzio", f"ugyfel #{ugyfel.id}")
    db.commit()
    db.refresh(ugyfel)
    return ugyfel


@router.delete("/{erdeklodes_id}", status_code=204)
def delete_erdeklodes(
    erdeklodes_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    erdeklodes = db.query(Erdeklodes).get(erdeklodes_id)
    if not erdeklodes:
        raise HTTPException(status_code=404, detail="Érdeklődő not found")
    log_audit(db, user, "erdeklodes", erdeklodes.id, "torles", erdeklodes.nev)
    db.delete(erdeklodes)
    db.commit()
