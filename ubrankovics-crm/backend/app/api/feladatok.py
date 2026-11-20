from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Feladat, Projekt, User
from app.schemas_crm import FeladatCreate, FeladatResponse, FeladatUpdate

router = APIRouter(prefix="/feladatok", tags=["feladatok"])


def _to_response(f: Feladat) -> FeladatResponse:
    return FeladatResponse(
        id=f.id,
        cim=f.cim,
        leiras=f.leiras,
        hatarido=f.hatarido,
        felelos_id=f.felelos_id,
        felelos=f.felelos,
        projekt_id=f.projekt_id,
        projekt_nev=f.projekt.projekt_nev if f.projekt else None,
        letrehozo_id=f.letrehozo_id,
        kesz=f.kesz,
        created_at=f.created_at,
    )


def _query(db: Session):
    return db.query(Feladat).options(joinedload(Feladat.felelos), joinedload(Feladat.projekt))


@router.get("", response_model=list[FeladatResponse])
def list_feladatok(
    felelos_id: int | None = None,
    projekt_id: int | None = None,
    kesz: bool | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = _query(db)
    if felelos_id is not None:
        q = q.filter(Feladat.felelos_id == felelos_id)
    if projekt_id is not None:
        q = q.filter(Feladat.projekt_id == projekt_id)
    if kesz is not None:
        q = q.filter(Feladat.kesz == kesz)
    feladatok = q.order_by(Feladat.kesz, Feladat.hatarido.is_(None), Feladat.hatarido).all()
    return [_to_response(f) for f in feladatok]


@router.post("", response_model=FeladatResponse, status_code=201)
def create_feladat(
    body: FeladatCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if body.projekt_id is not None and not db.query(Projekt).get(body.projekt_id):
        raise HTTPException(status_code=404, detail="Projekt not found")
    feladat = Feladat(letrehozo_id=user.id, **body.model_dump())
    db.add(feladat)
    db.commit()
    db.refresh(feladat)
    return _to_response(_query(db).filter(Feladat.id == feladat.id).first())


@router.patch("/{feladat_id}", response_model=FeladatResponse)
def update_feladat(
    feladat_id: int,
    body: FeladatUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    feladat = db.query(Feladat).get(feladat_id)
    if not feladat:
        raise HTTPException(status_code=404, detail="Feladat not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(feladat, field, value)
    db.commit()
    return _to_response(_query(db).filter(Feladat.id == feladat_id).first())


@router.delete("/{feladat_id}", status_code=204)
def delete_feladat(
    feladat_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    feladat = db.query(Feladat).get(feladat_id)
    if not feladat:
        raise HTTPException(status_code=404, detail="Feladat not found")
    db.delete(feladat)
    db.commit()
