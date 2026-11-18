from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user
from app.models import (
    Dokumentum,
    Projekt,
    ProjektTetel,
    ProjektTetelVallalas,
    Specifikacio,
    TetelEsemeny,
    User,
)
from app.schemas_crm import (
    DokumentumCreate,
    DokumentumResponse,
    ProjektTetelCreate,
    ProjektTetelResponse,
    ProjektTetelUpdate,
    SpecifikacioCreate,
    SpecifikacioResponse,
    TetelEsemenyCreate,
    TetelEsemenyResponse,
    TetelEsemenyUpdate,
    VallalasCreate,
    VallalasResponse,
)

router = APIRouter(prefix="/projektek/{projekt_id}", tags=["tetelek"])


def _tetel_query(db: Session):
    return db.query(ProjektTetel).options(
        joinedload(ProjektTetel.munkanem),
        joinedload(ProjektTetel.vallalasok).joinedload(ProjektTetelVallalas.alvallalkozo),
        joinedload(ProjektTetel.esemenyek),
        joinedload(ProjektTetel.specifikaciok),
    )


def _get_tetel(db: Session, projekt_id: int, tetel_id: int) -> ProjektTetel:
    tetel = (
        _tetel_query(db)
        .filter(ProjektTetel.id == tetel_id, ProjektTetel.projekt_id == projekt_id)
        .first()
    )
    if not tetel:
        raise HTTPException(status_code=404, detail="Tétel not found")
    return tetel


@router.get("/tetelek", response_model=list[ProjektTetelResponse])
def list_tetelek(
    projekt_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if not db.query(Projekt).get(projekt_id):
        raise HTTPException(status_code=404, detail="Projekt not found")
    return _tetel_query(db).filter(ProjektTetel.projekt_id == projekt_id).order_by(ProjektTetel.id).all()


@router.post("/tetelek", response_model=ProjektTetelResponse, status_code=201)
def create_tetel(
    projekt_id: int,
    body: ProjektTetelCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if not db.query(Projekt).get(projekt_id):
        raise HTTPException(status_code=404, detail="Projekt not found")
    data = body.model_dump(exclude={"vallalasok"})
    tetel = ProjektTetel(projekt_id=projekt_id, **data)
    db.add(tetel)
    db.flush()
    for vallalas in body.vallalasok:
        db.add(ProjektTetelVallalas(tetel_id=tetel.id, **vallalas.model_dump()))
    db.commit()
    return _get_tetel(db, projekt_id, tetel.id)


@router.patch("/tetelek/{tetel_id}", response_model=ProjektTetelResponse)
def update_tetel(
    projekt_id: int,
    tetel_id: int,
    body: ProjektTetelUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    tetel = _get_tetel(db, projekt_id, tetel_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(tetel, field, value)
    db.commit()
    return _get_tetel(db, projekt_id, tetel_id)


@router.delete("/tetelek/{tetel_id}", status_code=204)
def delete_tetel(
    projekt_id: int,
    tetel_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    tetel = _get_tetel(db, projekt_id, tetel_id)
    db.delete(tetel)
    db.commit()


@router.post("/tetelek/{tetel_id}/vallalasok", response_model=VallalasResponse, status_code=201)
def add_vallalas(
    projekt_id: int,
    tetel_id: int,
    body: VallalasCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    _get_tetel(db, projekt_id, tetel_id)
    vallalas = ProjektTetelVallalas(tetel_id=tetel_id, **body.model_dump())
    db.add(vallalas)
    db.commit()
    db.refresh(vallalas)
    return vallalas


@router.delete("/tetelek/{tetel_id}/vallalasok/{vallalas_id}", status_code=204)
def remove_vallalas(
    projekt_id: int,
    tetel_id: int,
    vallalas_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    _get_tetel(db, projekt_id, tetel_id)
    vallalas = (
        db.query(ProjektTetelVallalas)
        .filter(ProjektTetelVallalas.id == vallalas_id, ProjektTetelVallalas.tetel_id == tetel_id)
        .first()
    )
    if not vallalas:
        raise HTTPException(status_code=404, detail="Vállalás not found")
    db.delete(vallalas)
    db.commit()


@router.post("/tetelek/{tetel_id}/esemenyek", response_model=TetelEsemenyResponse, status_code=201)
def add_esemeny(
    projekt_id: int,
    tetel_id: int,
    body: TetelEsemenyCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    _get_tetel(db, projekt_id, tetel_id)
    esemeny = TetelEsemeny(tetel_id=tetel_id, **body.model_dump())
    db.add(esemeny)
    db.commit()
    db.refresh(esemeny)
    return esemeny


@router.patch("/tetelek/{tetel_id}/esemenyek/{esemeny_id}", response_model=TetelEsemenyResponse)
def update_esemeny(
    projekt_id: int,
    tetel_id: int,
    esemeny_id: int,
    body: TetelEsemenyUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    _get_tetel(db, projekt_id, tetel_id)
    esemeny = (
        db.query(TetelEsemeny)
        .filter(TetelEsemeny.id == esemeny_id, TetelEsemeny.tetel_id == tetel_id)
        .first()
    )
    if not esemeny:
        raise HTTPException(status_code=404, detail="Esemény not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(esemeny, field, value)
    db.commit()
    db.refresh(esemeny)
    return esemeny


@router.delete("/tetelek/{tetel_id}/esemenyek/{esemeny_id}", status_code=204)
def remove_esemeny(
    projekt_id: int,
    tetel_id: int,
    esemeny_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    _get_tetel(db, projekt_id, tetel_id)
    esemeny = (
        db.query(TetelEsemeny)
        .filter(TetelEsemeny.id == esemeny_id, TetelEsemeny.tetel_id == tetel_id)
        .first()
    )
    if not esemeny:
        raise HTTPException(status_code=404, detail="Esemény not found")
    db.delete(esemeny)
    db.commit()


@router.post("/tetelek/{tetel_id}/specifikaciok", response_model=SpecifikacioResponse, status_code=201)
def add_specifikacio(
    projekt_id: int,
    tetel_id: int,
    body: SpecifikacioCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    _get_tetel(db, projekt_id, tetel_id)
    spec = Specifikacio(tetel_id=tetel_id, **body.model_dump())
    db.add(spec)
    db.commit()
    db.refresh(spec)
    return spec


@router.delete("/tetelek/{tetel_id}/specifikaciok/{spec_id}", status_code=204)
def remove_specifikacio(
    projekt_id: int,
    tetel_id: int,
    spec_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    _get_tetel(db, projekt_id, tetel_id)
    spec = (
        db.query(Specifikacio)
        .filter(Specifikacio.id == spec_id, Specifikacio.tetel_id == tetel_id)
        .first()
    )
    if not spec:
        raise HTTPException(status_code=404, detail="Specifikáció not found")
    db.delete(spec)
    db.commit()


@router.get("/dokumentumok", response_model=list[DokumentumResponse])
def list_dokumentumok(
    projekt_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if not db.query(Projekt).get(projekt_id):
        raise HTTPException(status_code=404, detail="Projekt not found")
    return db.query(Dokumentum).filter(Dokumentum.projekt_id == projekt_id).order_by(Dokumentum.id).all()


@router.post("/dokumentumok", response_model=DokumentumResponse, status_code=201)
def add_dokumentum(
    projekt_id: int,
    body: DokumentumCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if not db.query(Projekt).get(projekt_id):
        raise HTTPException(status_code=404, detail="Projekt not found")
    dok = Dokumentum(projekt_id=projekt_id, **body.model_dump())
    db.add(dok)
    db.commit()
    db.refresh(dok)
    return dok
