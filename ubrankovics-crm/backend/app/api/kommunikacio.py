"""Kommunikációs napló: hívások, levelek, találkozók, megjegyzések időrendben."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Erdeklodes, Kommunikacio, Ugyfel, User
from app.schemas_crm import KommunikacioCreate, KommunikacioResponse

router = APIRouter(prefix="/kommunikacio", tags=["kommunikacio"])


@router.get("", response_model=list[KommunikacioResponse])
def list_kommunikacio(
    ugyfel_id: int | None = None,
    erdeklodes_id: int | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if ugyfel_id is None and erdeklodes_id is None:
        raise HTTPException(status_code=400, detail="ugyfel_id vagy erdeklodes_id kötelező")
    q = db.query(Kommunikacio).options(joinedload(Kommunikacio.user))
    if ugyfel_id is not None:
        q = q.filter(Kommunikacio.ugyfel_id == ugyfel_id)
    if erdeklodes_id is not None:
        q = q.filter(Kommunikacio.erdeklodes_id == erdeklodes_id)
    return q.order_by(Kommunikacio.datum.desc(), Kommunikacio.id.desc()).all()


@router.post("", response_model=KommunikacioResponse, status_code=201)
def create_kommunikacio(
    body: KommunikacioCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if (body.ugyfel_id is None) == (body.erdeklodes_id is None):
        raise HTTPException(status_code=400, detail="Pontosan egy kell: ugyfel_id vagy erdeklodes_id")
    if body.ugyfel_id is not None and not db.query(Ugyfel).get(body.ugyfel_id):
        raise HTTPException(status_code=404, detail="Ügyfél not found")
    if body.erdeklodes_id is not None and not db.query(Erdeklodes).get(body.erdeklodes_id):
        raise HTTPException(status_code=404, detail="Érdeklődő not found")
    k = Kommunikacio(user_id=user.id, **body.model_dump(exclude_none=True))
    db.add(k)
    db.commit()
    return db.query(Kommunikacio).options(joinedload(Kommunikacio.user)).filter(Kommunikacio.id == k.id).first()


@router.delete("/{kommunikacio_id}", status_code=204)
def delete_kommunikacio(
    kommunikacio_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    k = db.query(Kommunikacio).get(kommunikacio_id)
    if not k:
        raise HTTPException(status_code=404, detail="Bejegyzés not found")
    db.delete(k)
    db.commit()
