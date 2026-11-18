from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Projekt, ProjektSzerep, ProjektUgyfel, User
from app.schemas_crm import (
    ProjektCreate,
    ProjektDetail,
    ProjektListItem,
    ProjektSzerepCreate,
    ProjektSzerepResponse,
    ProjektUgyfelCreate,
    ProjektUgyfelResponse,
    ProjektUpdate,
)
from app.services.schedule_engine import recalculate_schedule

router = APIRouter(prefix="/projektek", tags=["projektek"])


def _detail_query(db: Session):
    return db.query(Projekt).options(
        joinedload(Projekt.ugyfel_linkek).joinedload(ProjektUgyfel.ugyfel),
        joinedload(Projekt.szerepek).joinedload(ProjektSzerep.szemely),
    )


@router.get("", response_model=list[ProjektListItem])
def list_projektek(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(Projekt).order_by(Projekt.created_at.desc()).all()


@router.post("", response_model=ProjektDetail, status_code=201)
def create_projekt(
    body: ProjektCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    data = body.model_dump(exclude={"ugyfelek"})
    projekt = Projekt(**data)
    db.add(projekt)
    db.flush()
    for link in body.ugyfelek:
        db.add(ProjektUgyfel(projekt_id=projekt.id, **link.model_dump()))
    db.commit()
    return _detail_query(db).get(projekt.id)


@router.get("/{projekt_id}", response_model=ProjektDetail)
def get_projekt(
    projekt_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    projekt = _detail_query(db).get(projekt_id)
    if not projekt:
        raise HTTPException(status_code=404, detail="Projekt not found")
    return projekt


@router.patch("/{projekt_id}", response_model=ProjektDetail)
def update_projekt(
    projekt_id: int,
    body: ProjektUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    projekt = db.query(Projekt).get(projekt_id)
    if not projekt:
        raise HTTPException(status_code=404, detail="Projekt not found")
    updates = body.model_dump(exclude_unset=True)
    reschedule_relevant = "delivery_date" in updates or "utemezes_aktiv" in updates
    for field, value in updates.items():
        setattr(projekt, field, value)
    db.commit()
    if reschedule_relevant and projekt.utemezes_aktiv:
        recalculate_schedule(db, projekt)
        db.commit()
    return _detail_query(db).get(projekt_id)


@router.delete("/{projekt_id}", status_code=204)
def delete_projekt(
    projekt_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    projekt = db.query(Projekt).get(projekt_id)
    if not projekt:
        raise HTTPException(status_code=404, detail="Projekt not found")
    db.delete(projekt)
    db.commit()


@router.post("/{projekt_id}/ugyfelek", response_model=ProjektUgyfelResponse, status_code=201)
def add_projekt_ugyfel(
    projekt_id: int,
    body: ProjektUgyfelCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if not db.query(Projekt).get(projekt_id):
        raise HTTPException(status_code=404, detail="Projekt not found")
    link = ProjektUgyfel(projekt_id=projekt_id, **body.model_dump())
    db.add(link)
    db.commit()
    db.refresh(link)
    return link


@router.delete("/{projekt_id}/ugyfelek/{link_id}", status_code=204)
def remove_projekt_ugyfel(
    projekt_id: int,
    link_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    link = (
        db.query(ProjektUgyfel)
        .filter(ProjektUgyfel.id == link_id, ProjektUgyfel.projekt_id == projekt_id)
        .first()
    )
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
    db.delete(link)
    db.commit()


@router.post("/{projekt_id}/szerepek", response_model=ProjektSzerepResponse, status_code=201)
def add_projekt_szerep(
    projekt_id: int,
    body: ProjektSzerepCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if not db.query(Projekt).get(projekt_id):
        raise HTTPException(status_code=404, detail="Projekt not found")
    szerep = ProjektSzerep(projekt_id=projekt_id, **body.model_dump())
    db.add(szerep)
    db.commit()
    db.refresh(szerep)
    return szerep


@router.delete("/{projekt_id}/szerepek/{szerep_id}", status_code=204)
def remove_projekt_szerep(
    projekt_id: int,
    szerep_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    szerep = (
        db.query(ProjektSzerep)
        .filter(ProjektSzerep.id == szerep_id, ProjektSzerep.projekt_id == projekt_id)
        .first()
    )
    if not szerep:
        raise HTTPException(status_code=404, detail="Szerep not found")
    db.delete(szerep)
    db.commit()
