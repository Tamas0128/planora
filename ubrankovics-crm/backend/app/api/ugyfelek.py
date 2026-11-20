from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user
from app.models import ProjektUgyfel, Ugyfel, User
from app.schemas_crm import UgyfelCreate, UgyfelProjektLinkResponse, UgyfelResponse, UgyfelUpdate

router = APIRouter(prefix="/ugyfelek", tags=["ugyfelek"])


@router.get("", response_model=list[UgyfelResponse])
def list_ugyfelek(
    q: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = db.query(Ugyfel)
    if q:
        query = query.filter(Ugyfel.nev.ilike(f"%{q}%"))
    return query.order_by(Ugyfel.nev).all()


@router.post("", response_model=UgyfelResponse, status_code=201)
def create_ugyfel(
    body: UgyfelCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    ugyfel = Ugyfel(**body.model_dump())
    db.add(ugyfel)
    db.commit()
    db.refresh(ugyfel)
    return ugyfel


@router.get("/{ugyfel_id}", response_model=UgyfelResponse)
def get_ugyfel(
    ugyfel_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    ugyfel = db.query(Ugyfel).get(ugyfel_id)
    if not ugyfel:
        raise HTTPException(status_code=404, detail="Ügyfél not found")
    return ugyfel


@router.get("/{ugyfel_id}/projektek", response_model=list[UgyfelProjektLinkResponse])
def list_ugyfel_projektek(
    ugyfel_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if not db.query(Ugyfel).get(ugyfel_id):
        raise HTTPException(status_code=404, detail="Ügyfél not found")
    linkek = (
        db.query(ProjektUgyfel)
        .options(joinedload(ProjektUgyfel.projekt))
        .filter(ProjektUgyfel.ugyfel_id == ugyfel_id)
        .all()
    )
    return [
        UgyfelProjektLinkResponse(
            id=link.id,
            projekt_id=link.projekt_id,
            projekt_nev=link.projekt.projekt_nev,
            allapot=link.projekt.allapot,
            epitesi_cim=link.epitesi_cim,
            szerep=link.szerep,
        )
        for link in linkek
    ]


@router.patch("/{ugyfel_id}", response_model=UgyfelResponse)
def update_ugyfel(
    ugyfel_id: int,
    body: UgyfelUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    ugyfel = db.query(Ugyfel).get(ugyfel_id)
    if not ugyfel:
        raise HTTPException(status_code=404, detail="Ügyfél not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(ugyfel, field, value)
    db.commit()
    db.refresh(ugyfel)
    return ugyfel


@router.delete("/{ugyfel_id}", status_code=204)
def delete_ugyfel(
    ugyfel_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    ugyfel = db.query(Ugyfel).get(ugyfel_id)
    if not ugyfel:
        raise HTTPException(status_code=404, detail="Ügyfél not found")
    db.delete(ugyfel)
    db.commit()
