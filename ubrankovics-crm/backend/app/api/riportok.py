"""Riportok — meglévő adatokból levezetett összesítő nézetek, nem új
adatmodell: "értékesítési állapot" (tétel-szakasz megoszlás/érték) +
"pénzügyi összesítő" (lejárt számlák + legutóbbi bankegyenleg)."""

from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user
from app.models import AnyagRendeles, ProjektTetel, TetelSzakasz, User
from app.models_finance import AlvallalkozoiSzamla, BankEgyenleg, UgyfelSzamla
from app.schemas_crm import LejartSzamlaItem, PenzugyiOsszesito, SzakaszMegoszlasItem

router = APIRouter(prefix="/riportok", tags=["riportok"])


@router.get("/ertekesitesi-allapot", response_model=list[SzakaszMegoszlasItem])
def ertekesitesi_allapot(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    tetel_szamok = dict(
        db.query(ProjektTetel.szakasz, func.count(ProjektTetel.id)).group_by(ProjektTetel.szakasz).all()
    )
    ertekek = dict(
        db.query(ProjektTetel.szakasz, func.coalesce(func.sum(AnyagRendeles.ugyfel_brutto), 0))
        .join(AnyagRendeles, AnyagRendeles.tetel_id == ProjektTetel.id)
        .group_by(ProjektTetel.szakasz)
        .all()
    )
    return [
        SzakaszMegoszlasItem(
            szakasz=szakasz,
            tetel_szam=tetel_szamok.get(szakasz, 0),
            ertek_osszesen=Decimal(str(ertekek.get(szakasz, 0))),
        )
        for szakasz in TetelSzakasz
    ]


@router.get("/penzugyi-osszesito", response_model=PenzugyiOsszesito)
def penzugyi_osszesito(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    today = date.today()
    tetelek: list[LejartSzamlaItem] = []
    bevetel_osszesen = Decimal("0")
    kiadas_osszesen = Decimal("0")

    ugyfel_szamlak = (
        db.query(UgyfelSzamla)
        .options(joinedload(UgyfelSzamla.ugyfel), joinedload(UgyfelSzamla.projekt))
        .filter(UgyfelSzamla.fizetes_datum.is_(None), UgyfelSzamla.esedekesseg < today)
        .all()
    )
    for sz in ugyfel_szamlak:
        bevetel_osszesen += sz.hatralek
        tetelek.append(
            LejartSzamlaItem(
                forras_tipus="ugyfel_szamla",
                forras_id=sz.id,
                projekt_id=sz.projekt_id,
                projekt_nev=sz.projekt.projekt_nev,
                partner_nev=sz.ugyfel.nev,
                szamlaszam=sz.szamlaszam,
                esedekesseg=sz.esedekesseg,
                hatralek=sz.hatralek,
            )
        )

    alv_szamlak = (
        db.query(AlvallalkozoiSzamla)
        .options(joinedload(AlvallalkozoiSzamla.alvallalkozo), joinedload(AlvallalkozoiSzamla.projekt))
        .filter(AlvallalkozoiSzamla.fizetes_datum.is_(None), AlvallalkozoiSzamla.esedekesseg < today)
        .all()
    )
    for sz in alv_szamlak:
        kiadas_osszesen += sz.hatralek
        tetelek.append(
            LejartSzamlaItem(
                forras_tipus="alvallalkozoi_szamla",
                forras_id=sz.id,
                projekt_id=sz.projekt_id,
                projekt_nev=sz.projekt.projekt_nev,
                partner_nev=sz.alvallalkozo.nev,
                szamlaszam=sz.szamlaszam,
                esedekesseg=sz.esedekesseg,
                hatralek=sz.hatralek,
            )
        )

    tetelek.sort(key=lambda t: t.esedekesseg)

    snapshot = db.query(BankEgyenleg).order_by(BankEgyenleg.datum.desc()).first()

    return PenzugyiOsszesito(
        lejart_szamlak=tetelek,
        lejart_bevetel_osszesen=bevetel_osszesen,
        lejart_kiadas_osszesen=kiadas_osszesen,
        legutobbi_bankegyenleg_datuma=snapshot.datum if snapshot else None,
        legutobbi_bankegyenleg=snapshot.egyenleg if snapshot else None,
    )
