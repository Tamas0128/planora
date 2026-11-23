"""Ügyfélszolgálati jegyek: reklamáció, hibabejelentés, kérés követése."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Projekt, Ugyfel, User
from app.models_ext import Jegy, JegyAllapot
from app.schemas_ext import JegyCreate, JegyResponse, JegyUpdate
from app.services.audit import log_audit

router = APIRouter(prefix="/jegyek", tags=["jegyek"])

_LEZARO = (JegyAllapot.MEGOLDVA, JegyAllapot.LEZART)


def _to_response(j: Jegy) -> JegyResponse:
    return JegyResponse(
        id=j.id,
        ugyfel_id=j.ugyfel_id,
        ugyfel_nev=j.ugyfel.nev if j.ugyfel else None,
        projekt_id=j.projekt_id,
        targy=j.targy,
        leiras=j.leiras,
        allapot=j.allapot,
        prioritas=j.prioritas,
        felelos_id=j.felelos_id,
        felelos=j.felelos,
        created_at=j.created_at,
        lezarva_at=j.lezarva_at,
    )


def _query(db: Session):
    return db.query(Jegy).options(joinedload(Jegy.ugyfel), joinedload(Jegy.felelos))


@router.get("", response_model=list[JegyResponse])
def list_jegyek(
    allapot: JegyAllapot | None = None,
    ugyfel_id: int | None = None,
    felelos_id: int | None = None,
    projekt_id: int | None = None,
    nyitott: bool | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = _query(db)
    if allapot is not None:
        q = q.filter(Jegy.allapot == allapot)
    if ugyfel_id is not None:
        q = q.filter(Jegy.ugyfel_id == ugyfel_id)
    if projekt_id is not None:
        q = q.filter(Jegy.projekt_id == projekt_id)
    if felelos_id is not None:
        q = q.filter(Jegy.felelos_id == felelos_id)
    if nyitott is True:
        q = q.filter(Jegy.allapot.notin_(_LEZARO))
    return [_to_response(j) for j in q.order_by(Jegy.created_at.desc()).all()]


@router.post("", response_model=JegyResponse, status_code=201)
def create_jegy(body: JegyCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if not db.query(Ugyfel).get(body.ugyfel_id):
        raise HTTPException(status_code=404, detail="Ügyfél not found")
    if body.projekt_id is not None and not db.query(Projekt).get(body.projekt_id):
        raise HTTPException(status_code=404, detail="Projekt not found")
    jegy = Jegy(letrehozo_id=user.id, **body.model_dump())
    db.add(jegy)
    db.flush()
    log_audit(db, user, "jegy", jegy.id, "letrehozas", body.targy)
    db.commit()
    return _to_response(_query(db).filter(Jegy.id == jegy.id).first())


@router.patch("/{jegy_id}", response_model=JegyResponse)
def update_jegy(
    jegy_id: int,
    body: JegyUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    jegy = db.query(Jegy).get(jegy_id)
    if not jegy:
        raise HTTPException(status_code=404, detail="Jegy not found")
    adat = body.model_dump(exclude_unset=True)
    for field, value in adat.items():
        setattr(jegy, field, value)
    if "allapot" in adat:
        jegy.lezarva_at = datetime.utcnow() if jegy.allapot in _LEZARO else None
        log_audit(db, user, "jegy", jegy.id, "allapot", jegy.allapot.value)
    else:
        log_audit(db, user, "jegy", jegy.id, "modositas")
    db.commit()
    return _to_response(_query(db).filter(Jegy.id == jegy_id).first())


@router.delete("/{jegy_id}", status_code=204)
def delete_jegy(jegy_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    jegy = db.query(Jegy).get(jegy_id)
    if not jegy:
        raise HTTPException(status_code=404, detail="Jegy not found")
    log_audit(db, user, "jegy", jegy.id, "torles", jegy.targy)
    db.delete(jegy)
    db.commit()
