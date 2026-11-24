"""Verziózott vevői ajánlat: minden módosítás új verzió, a korábbiak megmaradnak."""

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Projekt, User
from app.models_projekt import AjanlatAllapot, AjanlatSor, AjanlatVerzio, VevoiAjanlat
from app.schemas_projekt import (
    AjanlatAllapotUpdate,
    AjanlatCreate,
    AjanlatResponse,
    AjanlatVerzioIn,
)
from app.services.audit import log_audit

router = APIRouter(tags=["vevoi-ajanlat"])


def _q(db: Session):
    return db.query(VevoiAjanlat).options(joinedload(VevoiAjanlat.verziok).joinedload(AjanlatVerzio.sorok))


def _get(db: Session, aid: int) -> VevoiAjanlat:
    a = _q(db).filter(VevoiAjanlat.id == aid).first()
    if not a:
        raise HTTPException(status_code=404, detail="Ajánlat not found")
    return a


def _uj_verzio(ajanlat: VevoiAjanlat, body: AjanlatVerzioIn, user: User) -> AjanlatVerzio:
    v = AjanlatVerzio(
        verzio=len(ajanlat.verziok) + 1,
        megjegyzes=body.megjegyzes,
        ervenyes_ig=body.ervenyes_ig,
        letrehozo_id=user.id,
        netto_osszeg=sum((s.mennyiseg * s.egysegar for s in body.sorok), Decimal(0)),
    )
    v.sorok = [AjanlatSor(sorrend=i, **s.model_dump()) for i, s in enumerate(body.sorok)]
    return v


@router.get("/projektek/{projekt_id}/ajanlatok", response_model=list[AjanlatResponse])
def list_ajanlatok(projekt_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    if not db.query(Projekt).get(projekt_id):
        raise HTTPException(status_code=404, detail="Projekt not found")
    return _q(db).filter(VevoiAjanlat.projekt_id == projekt_id).order_by(VevoiAjanlat.id.desc()).all()


@router.post("/projektek/{projekt_id}/ajanlatok", response_model=AjanlatResponse, status_code=201)
def create_ajanlat(
    projekt_id: int,
    body: AjanlatCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not db.query(Projekt).get(projekt_id):
        raise HTTPException(status_code=404, detail="Projekt not found")
    a = VevoiAjanlat(projekt_id=projekt_id, cim=body.cim, cr_azonosito=(body.cr_azonosito or None))
    db.add(a)
    db.flush()
    a.verziok = [_uj_verzio(a, body, user)]
    log_audit(db, user, "ajanlat", a.id, "letrehozas", body.cim)
    db.commit()
    return _get(db, a.id)


@router.post("/ajanlatok/{ajanlat_id}/verziok", response_model=AjanlatResponse, status_code=201)
def uj_verzio(
    ajanlat_id: int,
    body: AjanlatVerzioIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    a = _get(db, ajanlat_id)
    if a.verziok and a.verziok[-1].allapot == AjanlatAllapot.ELFOGADVA:
        raise HTTPException(status_code=409, detail="Az elfogadott ajánlatnak nem hozható új verziója")
    v = _uj_verzio(a, body, user)
    # az előző, még függő verzió lecserélődik
    for r in a.verziok:
        if r.allapot in (AjanlatAllapot.TERVEZET, AjanlatAllapot.ELKULDVE):
            r.allapot = AjanlatAllapot.ELUTASITVA
    a.verziok.append(v)
    log_audit(db, user, "ajanlat", a.id, "uj_verzio", f"v{v.verzio}")
    db.commit()
    db.expire_all()
    return _get(db, ajanlat_id)


@router.patch("/ajanlat-verziok/{verzio_id}/allapot", response_model=AjanlatResponse)
def allapot(
    verzio_id: int,
    body: AjanlatAllapotUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    v = db.query(AjanlatVerzio).get(verzio_id)
    if not v:
        raise HTTPException(status_code=404, detail="Verzió not found")
    a = _get(db, v.ajanlat_id)
    if v.id != a.verziok[-1].id:
        raise HTTPException(status_code=409, detail="Csak a legutolsó verzió állapota módosítható")
    v.allapot = body.allapot
    log_audit(db, user, "ajanlat", a.id, "allapot", f"v{v.verzio}: {body.allapot.value}")
    db.commit()
    db.expire_all()
    return _get(db, a.id)


@router.delete("/ajanlatok/{ajanlat_id}", status_code=204)
def delete_ajanlat(ajanlat_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    a = _get(db, ajanlat_id)
    log_audit(db, user, "ajanlat", a.id, "torles", a.cim)
    db.delete(a)
    db.commit()


# --- Átemelés: az ajánlat sorai → projekt tételek + beszerzési igények ---------------------------

from pydantic import BaseModel  # noqa: E402

from app.models import AnyagRendeles, ProjektTetel, VatTipus  # noqa: E402
from app.services.afa import compute_afa  # noqa: E402
from sqlalchemy import func  # noqa: E402


class AtemelesSor(BaseModel):
    sor_id: int
    munkanem_id: int


class AtemelesIn(BaseModel):
    sorok: list[AtemelesSor]
    afa_tipus: VatTipus = VatTipus.AFA_27


class AtemelesOut(BaseModel):
    uj_tetelek: int
    uj_igenyek: int
    kihagyva: int


@router.post("/ajanlat-verziok/{verzio_id}/atemeles", response_model=AtemelesOut)
def atemeles(
    verzio_id: int,
    body: AtemelesIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Minden kiválasztott sorból beszerzési igény lesz a megadott munkanem tételén (ha a projektnek
    még nincs ilyen tétele, létrejön); az ügyfélár az ajánlati nettó összeg. Ugyanazt a sort nem emeli át kétszer."""
    v = db.query(AjanlatVerzio).options(joinedload(AjanlatVerzio.sorok)).filter(AjanlatVerzio.id == verzio_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Ajánlatverzió not found")
    ajanlat = db.query(VevoiAjanlat).get(v.ajanlat_id)
    sorok = {s.id: s for s in v.sorok}
    uj_tetelek = uj_igenyek = kihagyva = 0
    for k in body.sorok:
        sor = sorok.get(k.sor_id)
        if not sor:
            raise HTTPException(status_code=422, detail=f"Ismeretlen ajánlatsor: {k.sor_id}")
        tetel = (
            db.query(ProjektTetel)
            .filter(ProjektTetel.projekt_id == ajanlat.projekt_id, ProjektTetel.munkanem_id == k.munkanem_id)
            .order_by(ProjektTetel.id)
            .first()
        )
        if not tetel:
            max_s = db.query(func.max(ProjektTetel.sorrend)).filter(ProjektTetel.projekt_id == ajanlat.projekt_id).scalar()
            tetel = ProjektTetel(projekt_id=ajanlat.projekt_id, munkanem_id=k.munkanem_id, sorrend=(max_s or 0) + 1)
            db.add(tetel)
            db.flush()
            uj_tetelek += 1
        marvan = (
            db.query(AnyagRendeles)
            .filter(AnyagRendeles.tetel_id == tetel.id, AnyagRendeles.megnevezes == sor.megnevezes)
            .first()
        )
        if marvan:
            kihagyva += 1
            continue
        netto = (sor.mennyiseg * sor.egysegar).quantize(Decimal("0.01"))
        afa, brutto = compute_afa(netto, body.afa_tipus)
        db.add(
            AnyagRendeles(
                tetel_id=tetel.id,
                megnevezes=sor.megnevezes,
                mennyiseg=sor.mennyiseg,
                mertekegyseg=sor.egyseg,
                megjegyzes=f"Átemelve a(z) „{ajanlat.cim}” ajánlat v{v.verzio} verziójából",
                ugyfel_netto=netto,
                ugyfel_afa_tipus=body.afa_tipus,
                ugyfel_afa=afa,
                ugyfel_brutto=brutto,
            )
        )
        uj_igenyek += 1
    log_audit(db, user, "ajanlat", ajanlat.id, "atemeles", f"v{v.verzio}: {uj_igenyek} igény, {uj_tetelek} új tétel")
    db.commit()
    return AtemelesOut(uj_tetelek=uj_tetelek, uj_igenyek=uj_igenyek, kihagyva=kihagyva)


# --- Szerződés-összkép: alapszerződés (MVP) + pótmunkák (CR) -------------------------------------


class SzerzodesCr(BaseModel):
    ajanlat_id: int
    cr_azonosito: str
    cim: str
    allapot: str
    netto: Decimal
    elfogadott: bool


class SzerzodesOsszkep(BaseModel):
    alap_netto: Decimal
    alap_ajanlat_id: int | None
    alap_allapot: str | None
    cr_elfogadott_netto: Decimal
    cr_fuggo_netto: Decimal
    teljes_netto: Decimal
    crk: list[SzerzodesCr]


@router.get("/projektek/{projekt_id}/szerzodes-osszkep", response_model=SzerzodesOsszkep)
def szerzodes_osszkep(projekt_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Az alapszerződés az elfogadott (vagy ennek hiányában a legutóbbi) CR-azonosító nélküli ajánlat;
    a teljes érték az alap plusz az elfogadott pótmunkák."""
    if not db.query(Projekt).get(projekt_id):
        raise HTTPException(status_code=404, detail="Projekt not found")
    lista = _q(db).filter(VevoiAjanlat.projekt_id == projekt_id).order_by(VevoiAjanlat.id).all()
    alapok = [a for a in lista if not a.cr_azonosito]
    alap = next((a for a in alapok if a.verziok and a.verziok[-1].allapot == AjanlatAllapot.ELFOGADVA), None) or (alapok[-1] if alapok else None)
    alap_v = alap.verziok[-1] if alap and alap.verziok else None
    crk, elf, fuggo = [], Decimal(0), Decimal(0)
    for a in lista:
        if not a.cr_azonosito or not a.verziok:
            continue
        v = a.verziok[-1]
        ok = v.allapot == AjanlatAllapot.ELFOGADVA
        if ok:
            elf += v.netto_osszeg
        elif v.allapot in (AjanlatAllapot.TERVEZET, AjanlatAllapot.ELKULDVE):
            fuggo += v.netto_osszeg
        crk.append(SzerzodesCr(ajanlat_id=a.id, cr_azonosito=a.cr_azonosito, cim=a.cim, allapot=v.allapot.value, netto=v.netto_osszeg, elfogadott=ok))
    alap_netto = alap_v.netto_osszeg if alap_v else Decimal(0)
    return SzerzodesOsszkep(
        alap_netto=alap_netto,
        alap_ajanlat_id=alap.id if alap else None,
        alap_allapot=alap_v.allapot.value if alap_v else None,
        cr_elfogadott_netto=elf,
        cr_fuggo_netto=fuggo,
        teljes_netto=alap_netto + elf,
        crk=crk,
    )
