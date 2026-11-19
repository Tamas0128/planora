from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user
from decimal import Decimal

from app.models import (
    Ajanlatkeres,
    AnyagRendeles,
    BeszallitoiAjanlat,
    Dokumentum,
    Projekt,
    ProjektTetel,
    ProjektTetelVallalas,
    Specifikacio,
    TetelEsemeny,
    TetelFuggoseg,
    User,
)
from app.schemas_crm import (
    AjanlatkeresCreate,
    AjanlatkeresResponse,
    AjanlatkeresUpdate,
    AjanlatValasztas,
    AnyagRendelesCreate,
    AnyagRendelesResponse,
    AnyagRendelesUpdate,
    BeszallitoiAjanlatCreate,
    BeszallitoiAjanlatResponse,
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
    TetelFuggosegCreate,
    TetelFuggosegResponse,
    UgyfelArUpdate,
    VallalasCreate,
    VallalasResponse,
)
from app.services.afa import compute_afa
from app.services.schedule_engine import recalculate_schedule

router = APIRouter(prefix="/projektek/{projekt_id}", tags=["tetelek"])


def _tetel_query(db: Session):
    return db.query(ProjektTetel).options(
        joinedload(ProjektTetel.munkanem),
        joinedload(ProjektTetel.kijelolt),
        joinedload(ProjektTetel.vallalasok).joinedload(ProjektTetelVallalas.alvallalkozo),
        joinedload(ProjektTetel.esemenyek),
        joinedload(ProjektTetel.specifikaciok),
        joinedload(ProjektTetel.fuggosegek).joinedload(TetelFuggoseg.prerequisite).joinedload(ProjektTetel.munkanem),
        joinedload(ProjektTetel.rendelesek).joinedload(AnyagRendeles.kivalasztott_ajanlat),
        joinedload(ProjektTetel.rendelesek)
        .joinedload(AnyagRendeles.ajanlatkeresek)
        .joinedload(Ajanlatkeres.ajanlatok),
    )


def _get_projekt_or_404(db: Session, projekt_id: int) -> Projekt:
    projekt = db.query(Projekt).get(projekt_id)
    if not projekt:
        raise HTTPException(status_code=404, detail="Projekt not found")
    return projekt


def _maybe_recalculate(db: Session, projekt_id: int) -> None:
    projekt = db.query(Projekt).get(projekt_id)
    if projekt and projekt.utemezes_aktiv:
        recalculate_schedule(db, projekt)
        db.commit()


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
    return _tetel_query(db).filter(ProjektTetel.projekt_id == projekt_id).order_by(ProjektTetel.sorrend, ProjektTetel.id).all()


@router.post("/tetelek", response_model=ProjektTetelResponse, status_code=201)
def create_tetel(
    projekt_id: int,
    body: ProjektTetelCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if not db.query(Projekt).get(projekt_id):
        raise HTTPException(status_code=404, detail="Projekt not found")
    max_sorrend = (
        db.query(func.max(ProjektTetel.sorrend)).filter(ProjektTetel.projekt_id == projekt_id).scalar()
    )
    data = body.model_dump(exclude={"vallalasok"})
    tetel = ProjektTetel(projekt_id=projekt_id, sorrend=(max_sorrend or 0) + 1, **data)
    db.add(tetel)
    db.flush()
    for vallalas in body.vallalasok:
        db.add(ProjektTetelVallalas(tetel_id=tetel.id, **vallalas.model_dump()))
    db.commit()
    _maybe_recalculate(db, projekt_id)
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
    _maybe_recalculate(db, projekt_id)
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
    _maybe_recalculate(db, projekt_id)


@router.post("/tetelek/{tetel_id}/fuggosegek", response_model=TetelFuggosegResponse, status_code=201)
def add_fuggoseg(
    projekt_id: int,
    tetel_id: int,
    body: TetelFuggosegCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    _get_tetel(db, projekt_id, tetel_id)
    _get_tetel(db, projekt_id, body.prerequisite_id)
    if body.prerequisite_id == tetel_id:
        raise HTTPException(status_code=400, detail="Egy tétel nem függhet saját magától")
    fuggoseg = TetelFuggoseg(tetel_id=tetel_id, prerequisite_id=body.prerequisite_id)
    db.add(fuggoseg)
    db.commit()
    db.refresh(fuggoseg)
    _maybe_recalculate(db, projekt_id)
    return fuggoseg


@router.delete("/tetelek/{tetel_id}/fuggosegek/{fuggoseg_id}", status_code=204)
def remove_fuggoseg(
    projekt_id: int,
    tetel_id: int,
    fuggoseg_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    _get_tetel(db, projekt_id, tetel_id)
    fuggoseg = (
        db.query(TetelFuggoseg)
        .filter(TetelFuggoseg.id == fuggoseg_id, TetelFuggoseg.tetel_id == tetel_id)
        .first()
    )
    if not fuggoseg:
        raise HTTPException(status_code=404, detail="Függőség not found")
    db.delete(fuggoseg)
    db.commit()
    _maybe_recalculate(db, projekt_id)


@router.post("/utemezes/recalculate", response_model=list[ProjektTetelResponse])
def recalculate_utemezes(
    projekt_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    projekt = _get_projekt_or_404(db, projekt_id)
    if not projekt.utemezes_aktiv:
        raise HTTPException(status_code=400, detail="Az ütemező nincs bekapcsolva ennél a projektnél")
    recalculate_schedule(db, projekt)
    db.commit()
    return _tetel_query(db).filter(ProjektTetel.projekt_id == projekt_id).order_by(ProjektTetel.sorrend, ProjektTetel.id).all()


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


@router.post("/tetelek/{tetel_id}/rendelesek", response_model=AnyagRendelesResponse, status_code=201)
def add_rendeles(
    projekt_id: int,
    tetel_id: int,
    body: AnyagRendelesCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    _get_tetel(db, projekt_id, tetel_id)
    rendeles = AnyagRendeles(tetel_id=tetel_id, **body.model_dump())
    db.add(rendeles)
    db.commit()
    db.refresh(rendeles)
    return rendeles


@router.patch("/tetelek/{tetel_id}/rendelesek/{rendeles_id}", response_model=AnyagRendelesResponse)
def update_rendeles(
    projekt_id: int,
    tetel_id: int,
    rendeles_id: int,
    body: AnyagRendelesUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    _get_tetel(db, projekt_id, tetel_id)
    rendeles = (
        db.query(AnyagRendeles)
        .filter(AnyagRendeles.id == rendeles_id, AnyagRendeles.tetel_id == tetel_id)
        .first()
    )
    if not rendeles:
        raise HTTPException(status_code=404, detail="Rendelés not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(rendeles, field, value)
    db.commit()
    db.refresh(rendeles)
    return rendeles


@router.delete("/tetelek/{tetel_id}/rendelesek/{rendeles_id}", status_code=204)
def remove_rendeles(
    projekt_id: int,
    tetel_id: int,
    rendeles_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    _get_tetel(db, projekt_id, tetel_id)
    rendeles = (
        db.query(AnyagRendeles)
        .filter(AnyagRendeles.id == rendeles_id, AnyagRendeles.tetel_id == tetel_id)
        .first()
    )
    if not rendeles:
        raise HTTPException(status_code=404, detail="Rendelés not found")
    db.delete(rendeles)
    db.commit()


def _get_rendeles(db: Session, tetel_id: int, rendeles_id: int) -> AnyagRendeles:
    rendeles = (
        db.query(AnyagRendeles)
        .filter(AnyagRendeles.id == rendeles_id, AnyagRendeles.tetel_id == tetel_id)
        .first()
    )
    if not rendeles:
        raise HTTPException(status_code=404, detail="Rendelés not found")
    return rendeles


def _get_rendeles_full(db: Session, projekt_id: int, tetel_id: int, rendeles_id: int) -> AnyagRendeles:
    """Újratölti a rendelést a teljes ajánlatkérés/ajánlat lánccal, mutáció után."""
    _get_tetel(db, projekt_id, tetel_id)
    rendeles = (
        db.query(AnyagRendeles)
        .options(
            joinedload(AnyagRendeles.kivalasztott_ajanlat),
            joinedload(AnyagRendeles.ajanlatkeresek).joinedload(Ajanlatkeres.ajanlatok),
        )
        .filter(AnyagRendeles.id == rendeles_id, AnyagRendeles.tetel_id == tetel_id)
        .first()
    )
    if not rendeles:
        raise HTTPException(status_code=404, detail="Rendelés not found")
    return rendeles


@router.post(
    "/tetelek/{tetel_id}/rendelesek/{rendeles_id}/ajanlatkeresek",
    response_model=AjanlatkeresResponse,
    status_code=201,
)
def add_ajanlatkeres(
    projekt_id: int,
    tetel_id: int,
    rendeles_id: int,
    body: AjanlatkeresCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    _get_tetel(db, projekt_id, tetel_id)
    _get_rendeles(db, tetel_id, rendeles_id)
    ajanlatkeres = Ajanlatkeres(rendeles_id=rendeles_id, **body.model_dump())
    db.add(ajanlatkeres)
    rendeles = _get_rendeles(db, tetel_id, rendeles_id)
    if rendeles.allapot.value == "igeny":
        rendeles.allapot = rendeles.allapot.__class__.AJANLATKERES_ALATT
    db.commit()
    db.refresh(ajanlatkeres)
    return ajanlatkeres


@router.patch(
    "/tetelek/{tetel_id}/rendelesek/{rendeles_id}/ajanlatkeresek/{ajanlatkeres_id}",
    response_model=AjanlatkeresResponse,
)
def update_ajanlatkeres(
    projekt_id: int,
    tetel_id: int,
    rendeles_id: int,
    ajanlatkeres_id: int,
    body: AjanlatkeresUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    _get_tetel(db, projekt_id, tetel_id)
    ajanlatkeres = (
        db.query(Ajanlatkeres)
        .filter(Ajanlatkeres.id == ajanlatkeres_id, Ajanlatkeres.rendeles_id == rendeles_id)
        .first()
    )
    if not ajanlatkeres:
        raise HTTPException(status_code=404, detail="Ajánlatkérés not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(ajanlatkeres, field, value)
    db.commit()
    db.refresh(ajanlatkeres)
    return ajanlatkeres


@router.delete(
    "/tetelek/{tetel_id}/rendelesek/{rendeles_id}/ajanlatkeresek/{ajanlatkeres_id}", status_code=204
)
def remove_ajanlatkeres(
    projekt_id: int,
    tetel_id: int,
    rendeles_id: int,
    ajanlatkeres_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    _get_tetel(db, projekt_id, tetel_id)
    ajanlatkeres = (
        db.query(Ajanlatkeres)
        .filter(Ajanlatkeres.id == ajanlatkeres_id, Ajanlatkeres.rendeles_id == rendeles_id)
        .first()
    )
    if not ajanlatkeres:
        raise HTTPException(status_code=404, detail="Ajánlatkérés not found")
    db.delete(ajanlatkeres)
    db.commit()


@router.post(
    "/tetelek/{tetel_id}/rendelesek/{rendeles_id}/ajanlatkeresek/{ajanlatkeres_id}/ajanlatok",
    response_model=BeszallitoiAjanlatResponse,
    status_code=201,
)
def add_beszallitoi_ajanlat(
    projekt_id: int,
    tetel_id: int,
    rendeles_id: int,
    ajanlatkeres_id: int,
    body: BeszallitoiAjanlatCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    _get_tetel(db, projekt_id, tetel_id)
    ajanlatkeres = (
        db.query(Ajanlatkeres)
        .filter(Ajanlatkeres.id == ajanlatkeres_id, Ajanlatkeres.rendeles_id == rendeles_id)
        .first()
    )
    if not ajanlatkeres:
        raise HTTPException(status_code=404, detail="Ajánlatkérés not found")
    if len(ajanlatkeres.ajanlatok) >= 2:
        raise HTTPException(
            status_code=400, detail="Egy ajánlatkéréshez legfeljebb két ajánlat rögzíthető"
        )
    afa, brutto = compute_afa(Decimal(body.netto), body.afa_tipus)
    ajanlat = BeszallitoiAjanlat(
        ajanlatkeres_id=ajanlatkeres_id,
        netto=body.netto,
        afa_tipus=body.afa_tipus,
        afa=afa,
        brutto=brutto,
        ervenyesseg_datum=body.ervenyesseg_datum,
        szallitasi_ido_nap=body.szallitasi_ido_nap,
        megjegyzes=body.megjegyzes,
    )
    db.add(ajanlat)
    ajanlatkeres.allapot = ajanlatkeres.allapot.__class__.VALASZ_ERKEZETT
    db.commit()
    db.refresh(ajanlat)
    return ajanlat


@router.delete(
    "/tetelek/{tetel_id}/rendelesek/{rendeles_id}/ajanlatkeresek/{ajanlatkeres_id}/ajanlatok/{ajanlat_id}",
    status_code=204,
)
def remove_beszallitoi_ajanlat(
    projekt_id: int,
    tetel_id: int,
    rendeles_id: int,
    ajanlatkeres_id: int,
    ajanlat_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    _get_tetel(db, projekt_id, tetel_id)
    ajanlat = (
        db.query(BeszallitoiAjanlat)
        .filter(BeszallitoiAjanlat.id == ajanlat_id, BeszallitoiAjanlat.ajanlatkeres_id == ajanlatkeres_id)
        .first()
    )
    if not ajanlat:
        raise HTTPException(status_code=404, detail="Ajánlat not found")
    rendeles = _get_rendeles(db, tetel_id, rendeles_id)
    if rendeles.kivalasztott_ajanlat_id == ajanlat_id:
        rendeles.kivalasztott_ajanlat_id = None
    db.delete(ajanlat)
    db.commit()


@router.post(
    "/tetelek/{tetel_id}/rendelesek/{rendeles_id}/valaszt-ajanlat", response_model=AnyagRendelesResponse
)
def valaszt_ajanlat(
    projekt_id: int,
    tetel_id: int,
    rendeles_id: int,
    body: AjanlatValasztas,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    _get_tetel(db, projekt_id, tetel_id)
    rendeles = _get_rendeles(db, tetel_id, rendeles_id)
    ajanlat = (
        db.query(BeszallitoiAjanlat)
        .join(Ajanlatkeres, BeszallitoiAjanlat.ajanlatkeres_id == Ajanlatkeres.id)
        .filter(BeszallitoiAjanlat.id == body.ajanlat_id, Ajanlatkeres.rendeles_id == rendeles_id)
        .first()
    )
    if not ajanlat:
        raise HTTPException(status_code=404, detail="Ajánlat not found ehhez a rendeléshez")
    rendeles.kivalasztott_ajanlat_id = ajanlat.id
    rendeles.beszallito = ajanlat.ajanlatkeres.cimzett_nev
    db.commit()
    return _get_rendeles_full(db, projekt_id, tetel_id, rendeles_id)


@router.patch(
    "/tetelek/{tetel_id}/rendelesek/{rendeles_id}/ugyfel-ar", response_model=AnyagRendelesResponse
)
def set_ugyfel_ar(
    projekt_id: int,
    tetel_id: int,
    rendeles_id: int,
    body: UgyfelArUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    _get_tetel(db, projekt_id, tetel_id)
    rendeles = _get_rendeles(db, tetel_id, rendeles_id)
    afa, brutto = compute_afa(Decimal(body.ugyfel_netto), body.ugyfel_afa_tipus)
    rendeles.ugyfel_netto = body.ugyfel_netto
    rendeles.ugyfel_afa_tipus = body.ugyfel_afa_tipus
    rendeles.ugyfel_afa = afa
    rendeles.ugyfel_brutto = brutto
    db.commit()
    return _get_rendeles_full(db, projekt_id, tetel_id, rendeles_id)
