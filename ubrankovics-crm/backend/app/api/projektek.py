from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user
from app.models import (
    Projekt,
    ProjektFazis,
    ProjektLepes,
    ProjektSzerep,
    ProjektTetel,
    ProjektTipus,
    ProjektTipusFazis,
    ProjektTipusTetel,
    ProjektTipusTetelFuggoseg,
    ProjektUgyfel,
    TetelFuggoseg,
    User,
)
from app.schemas_crm import (
    ProjektCreate,
    ProjektDetail,
    ProjektFazisCreate,
    ProjektFazisResponse,
    ProjektLepesCreate,
    ProjektLepesUpdate,
    ProjektLepesResponse,
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


def _copy_tipus_into_projekt(db: Session, projekt: Projekt, projekt_tipus_id: int) -> None:
    tipus = (
        db.query(ProjektTipus)
        .options(
            joinedload(ProjektTipus.fazisok).joinedload(ProjektTipusFazis.lepesek),
            joinedload(ProjektTipus.tetel_sablonok),
        )
        .get(projekt_tipus_id)
    )
    if not tipus:
        raise HTTPException(status_code=404, detail="Projekttípus not found")
    for fazis_sablon in tipus.fazisok:
        fazis = ProjektFazis(projekt_id=projekt.id, nev=fazis_sablon.nev, sorrend=fazis_sablon.sorrend)
        db.add(fazis)
        db.flush()
        for lepes_sablon in fazis_sablon.lepesek:
            db.add(
                ProjektLepes(
                    fazis_id=fazis.id,
                    nev=lepes_sablon.nev,
                    sorrend=lepes_sablon.sorrend,
                    merfoldko=lepes_sablon.merfoldko,
                )
            )

    # Munkatétel-lista automatikusan a kiválasztott épülettípus sablonjából
    # (a planora ActivityTemplate -> Activity mintájára) — utána a sablontól
    # teljesen függetlenül szerkeszthető, akárcsak a fázis/lépés checklist.
    tetel_sablonok = [t for t in tipus.tetel_sablonok if t.include_by_default]
    sablon_id_to_tetel: dict[int, ProjektTetel] = {}
    for tetel_sablon in tetel_sablonok:
        tetel = ProjektTetel(
            projekt_id=projekt.id,
            munkanem_id=tetel_sablon.munkanem_id,
            sorrend=tetel_sablon.sorrend,
            duration_days=tetel_sablon.duration_days,
            prep_days=tetel_sablon.prep_days,
            felelos_szerep=tetel_sablon.felelos_szerep,
        )
        db.add(tetel)
        sablon_id_to_tetel[tetel_sablon.id] = tetel
    db.flush()

    sablon_deps = (
        db.query(ProjektTipusTetelFuggoseg)
        .filter(ProjektTipusTetelFuggoseg.tetel_id.in_(sablon_id_to_tetel.keys()))
        .all()
    )
    for dep in sablon_deps:
        tetel = sablon_id_to_tetel.get(dep.tetel_id)
        prereq = sablon_id_to_tetel.get(dep.prerequisite_tetel_id)
        if tetel and prereq:
            db.add(TetelFuggoseg(tetel_id=tetel.id, prerequisite_id=prereq.id))


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
    if body.projekt_tipus_id:
        _copy_tipus_into_projekt(db, projekt, body.projekt_tipus_id)
        db.flush()
        if projekt.utemezes_aktiv:
            recalculate_schedule(db, projekt)
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


def _fazis_query(db: Session):
    return db.query(ProjektFazis).options(joinedload(ProjektFazis.lepesek))


@router.get("/{projekt_id}/fazisok", response_model=list[ProjektFazisResponse])
def list_fazisok(
    projekt_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if not db.query(Projekt).get(projekt_id):
        raise HTTPException(status_code=404, detail="Projekt not found")
    return _fazis_query(db).filter(ProjektFazis.projekt_id == projekt_id).order_by(ProjektFazis.sorrend).all()


@router.post("/{projekt_id}/fazisok", response_model=ProjektFazisResponse, status_code=201)
def add_fazis(
    projekt_id: int,
    body: ProjektFazisCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if not db.query(Projekt).get(projekt_id):
        raise HTTPException(status_code=404, detail="Projekt not found")
    max_sorrend = (
        db.query(ProjektFazis.sorrend)
        .filter(ProjektFazis.projekt_id == projekt_id)
        .order_by(ProjektFazis.sorrend.desc())
        .first()
    )
    fazis = ProjektFazis(
        projekt_id=projekt_id, nev=body.nev, sorrend=(max_sorrend[0] + 1) if max_sorrend else 0
    )
    db.add(fazis)
    db.commit()
    db.refresh(fazis)
    return fazis


@router.delete("/{projekt_id}/fazisok/{fazis_id}", status_code=204)
def remove_fazis(
    projekt_id: int,
    fazis_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    fazis = (
        db.query(ProjektFazis)
        .filter(ProjektFazis.id == fazis_id, ProjektFazis.projekt_id == projekt_id)
        .first()
    )
    if not fazis:
        raise HTTPException(status_code=404, detail="Fázis not found")
    db.delete(fazis)
    db.commit()


def _get_fazis_or_404(db: Session, projekt_id: int, fazis_id: int) -> ProjektFazis:
    fazis = (
        db.query(ProjektFazis)
        .filter(ProjektFazis.id == fazis_id, ProjektFazis.projekt_id == projekt_id)
        .first()
    )
    if not fazis:
        raise HTTPException(status_code=404, detail="Fázis not found")
    return fazis


@router.post("/{projekt_id}/fazisok/{fazis_id}/lepesek", response_model=ProjektLepesResponse, status_code=201)
def add_lepes(
    projekt_id: int,
    fazis_id: int,
    body: ProjektLepesCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    _get_fazis_or_404(db, projekt_id, fazis_id)
    max_sorrend = (
        db.query(ProjektLepes.sorrend)
        .filter(ProjektLepes.fazis_id == fazis_id)
        .order_by(ProjektLepes.sorrend.desc())
        .first()
    )
    lepes = ProjektLepes(
        fazis_id=fazis_id,
        nev=body.nev,
        merfoldko=body.merfoldko,
        sorrend=(max_sorrend[0] + 1) if max_sorrend else 0,
    )
    db.add(lepes)
    db.commit()
    db.refresh(lepes)
    return lepes


@router.patch("/{projekt_id}/fazisok/{fazis_id}/lepesek/{lepes_id}", response_model=ProjektLepesResponse)
def update_lepes(
    projekt_id: int,
    fazis_id: int,
    lepes_id: int,
    body: ProjektLepesUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    _get_fazis_or_404(db, projekt_id, fazis_id)
    lepes = (
        db.query(ProjektLepes)
        .filter(ProjektLepes.id == lepes_id, ProjektLepes.fazis_id == fazis_id)
        .first()
    )
    if not lepes:
        raise HTTPException(status_code=404, detail="Lépés not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(lepes, field, value)
    db.commit()
    db.refresh(lepes)
    return lepes


@router.delete("/{projekt_id}/fazisok/{fazis_id}/lepesek/{lepes_id}", status_code=204)
def remove_lepes(
    projekt_id: int,
    fazis_id: int,
    lepes_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    _get_fazis_or_404(db, projekt_id, fazis_id)
    lepes = (
        db.query(ProjektLepes)
        .filter(ProjektLepes.id == lepes_id, ProjektLepes.fazis_id == fazis_id)
        .first()
    )
    if not lepes:
        raise HTTPException(status_code=404, detail="Lépés not found")
    db.delete(lepes)
    db.commit()
