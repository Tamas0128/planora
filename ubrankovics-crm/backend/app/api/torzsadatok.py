from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import Alvallalkozo, Munkanem, Szemely, Torzsadat, User, UserRole
from app.schemas_crm import (
    AlvallalkozoCreate,
    AlvallalkozoResponse,
    AlvallalkozoUpdate,
    MunkanemCreate,
    MunkanemResponse,
    MunkanemUpdate,
    SzemelyCreate,
    SzemelyResponse,
    SzemelyUpdate,
    TorzsadatCreate,
    TorzsadatResponse,
)

router = APIRouter(tags=["torzsadatok"])


# --- Munkanem ----------------------------------------------------------------


@router.get("/munkanemek", response_model=list[MunkanemResponse])
def list_munkanemek(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(Munkanem).order_by(Munkanem.sorrend, Munkanem.nev).all()


@router.post("/munkanemek", response_model=MunkanemResponse, status_code=201)
def create_munkanem(
    body: MunkanemCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.VEZETES)),
):
    if db.query(Munkanem).filter(Munkanem.kod == body.kod).first():
        raise HTTPException(status_code=400, detail="Ez a kód már létezik")
    munkanem = Munkanem(**body.model_dump())
    db.add(munkanem)
    db.commit()
    db.refresh(munkanem)
    return munkanem


@router.patch("/munkanemek/{munkanem_id}", response_model=MunkanemResponse)
def update_munkanem(
    munkanem_id: int,
    body: MunkanemUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.VEZETES)),
):
    munkanem = db.query(Munkanem).get(munkanem_id)
    if not munkanem:
        raise HTTPException(status_code=404, detail="Munkanem not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(munkanem, field, value)
    db.commit()
    db.refresh(munkanem)
    return munkanem


# --- Alvállalkozó -----------------------------------------------------------


@router.get("/alvallalkozok", response_model=list[AlvallalkozoResponse])
def list_alvallalkozok(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(Alvallalkozo).order_by(Alvallalkozo.nev).all()


@router.post("/alvallalkozok", response_model=AlvallalkozoResponse, status_code=201)
def create_alvallalkozo(
    body: AlvallalkozoCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    alvallalkozo = Alvallalkozo(**body.model_dump())
    db.add(alvallalkozo)
    db.commit()
    db.refresh(alvallalkozo)
    return alvallalkozo


@router.patch("/alvallalkozok/{alvallalkozo_id}", response_model=AlvallalkozoResponse)
def update_alvallalkozo(
    alvallalkozo_id: int,
    body: AlvallalkozoUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    alvallalkozo = db.query(Alvallalkozo).get(alvallalkozo_id)
    if not alvallalkozo:
        raise HTTPException(status_code=404, detail="Alvállalkozó not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(alvallalkozo, field, value)
    db.commit()
    db.refresh(alvallalkozo)
    return alvallalkozo


@router.delete("/alvallalkozok/{alvallalkozo_id}", status_code=204)
def delete_alvallalkozo(
    alvallalkozo_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    alvallalkozo = db.query(Alvallalkozo).get(alvallalkozo_id)
    if not alvallalkozo:
        raise HTTPException(status_code=404, detail="Alvállalkozó not found")
    db.delete(alvallalkozo)
    db.commit()


# --- Személy ------------------------------------------------------------------


@router.get("/szemelyek", response_model=list[SzemelyResponse])
def list_szemelyek(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(Szemely).order_by(Szemely.nev).all()


@router.post("/szemelyek", response_model=SzemelyResponse, status_code=201)
def create_szemely(
    body: SzemelyCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    szemely = Szemely(**body.model_dump())
    db.add(szemely)
    db.commit()
    db.refresh(szemely)
    return szemely


@router.patch("/szemelyek/{szemely_id}", response_model=SzemelyResponse)
def update_szemely(
    szemely_id: int,
    body: SzemelyUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    szemely = db.query(Szemely).get(szemely_id)
    if not szemely:
        raise HTTPException(status_code=404, detail="Személy not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(szemely, field, value)
    db.commit()
    db.refresh(szemely)
    return szemely


@router.delete("/szemelyek/{szemely_id}", status_code=204)
def delete_szemely(
    szemely_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    szemely = db.query(Szemely).get(szemely_id)
    if not szemely:
        raise HTTPException(status_code=404, detail="Személy not found")
    db.delete(szemely)
    db.commit()


# --- Törzsadat ----------------------------------------------------------------


@router.get("/torzsadatok", response_model=list[TorzsadatResponse])
def list_torzsadatok(
    tipus: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = db.query(Torzsadat)
    if tipus:
        query = query.filter(Torzsadat.tipus == tipus)
    return query.order_by(Torzsadat.tipus, Torzsadat.ertek).all()


@router.post("/torzsadatok", response_model=TorzsadatResponse, status_code=201)
def create_torzsadat(
    body: TorzsadatCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if db.query(Torzsadat).filter(Torzsadat.tipus == body.tipus, Torzsadat.ertek == body.ertek).first():
        raise HTTPException(status_code=400, detail="Ez az érték már létezik ebben a típusban")
    torzsadat = Torzsadat(**body.model_dump())
    db.add(torzsadat)
    db.commit()
    db.refresh(torzsadat)
    return torzsadat


@router.delete("/torzsadatok/{torzsadat_id}", status_code=204)
def delete_torzsadat(
    torzsadat_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    torzsadat = db.query(Torzsadat).get(torzsadat_id)
    if not torzsadat:
        raise HTTPException(status_code=404, detail="Törzsadat not found")
    db.delete(torzsadat)
    db.commit()
