"""Értesítések / emlékeztetők — élőben számolt lista (nincs külön tábla):
a bejelentkezett felhasználó lejárt/közelgő feladatai, és pénzügyi
szerepkörnek a lejárt számlák."""

from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Feladat, User, UserRole
from app.models_ext import Jegy, JegyAllapot, JegyPrioritas
from app.models_finance import AlvallalkozoiSzamla, UgyfelSzamla
from app.schemas_crm import ErtesitesItem

router = APIRouter(prefix="/ertesitesek", tags=["ertesitesek"])

_KOZELI_NAPOK = 2
_PENZUGY = (UserRole.ADMIN, UserRole.PENZUGY, UserRole.VEZETES)


@router.get("", response_model=list[ErtesitesItem])
def list_ertesitesek(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    today = date.today()
    hatar = today + timedelta(days=_KOZELI_NAPOK)
    items: list[ErtesitesItem] = []

    feladatok = (
        db.query(Feladat)
        .filter(
            Feladat.felelos_id == user.id,
            Feladat.kesz.is_(False),
            Feladat.hatarido.isnot(None),
            Feladat.hatarido <= hatar,
        )
        .order_by(Feladat.hatarido)
        .all()
    )
    for f in feladatok:
        lejart = f.hatarido < today
        items.append(
            ErtesitesItem(
                tipus="feladat",
                szint="lejart" if lejart else "kozeli",
                cim=f.cim,
                reszlet="Lejárt feladat" if lejart else "Közelgő határidő",
                datum=f.hatarido,
                link="/feladatok",
            )
        )

    for j in (
        db.query(Jegy)
        .options(joinedload(Jegy.ugyfel))
        .filter(Jegy.felelos_id == user.id, Jegy.allapot.in_((JegyAllapot.NYITOTT, JegyAllapot.FOLYAMATBAN)))
        .all()
    ):
        items.append(
            ErtesitesItem(
                tipus="jegy",
                szint="lejart" if j.prioritas == JegyPrioritas.SURGOS else "kozeli",
                cim=f"Jegy: {j.targy}",
                reszlet=f"{j.ugyfel.nev} — {'sürgős' if j.prioritas == JegyPrioritas.SURGOS else 'nyitott'}",
                datum=j.created_at.date(),
                link="/jegyek",
            )
        )

    if user.role in _PENZUGY:
        for sz in (
            db.query(UgyfelSzamla)
            .options(joinedload(UgyfelSzamla.ugyfel))
            .filter(UgyfelSzamla.fizetes_datum.is_(None), UgyfelSzamla.esedekesseg < today)
            .all()
        ):
            items.append(
                ErtesitesItem(
                    tipus="szamla",
                    szint="lejart",
                    cim=f"Lejárt ügyfélszámla: {sz.szamlaszam}",
                    reszlet=f"{sz.ugyfel.nev} — hátralék {sz.hatralek}",
                    datum=sz.esedekesseg,
                    link="/penzugy",
                )
            )
        for sz in (
            db.query(AlvallalkozoiSzamla)
            .options(joinedload(AlvallalkozoiSzamla.alvallalkozo))
            .filter(AlvallalkozoiSzamla.fizetes_datum.is_(None), AlvallalkozoiSzamla.esedekesseg < today)
            .all()
        ):
            items.append(
                ErtesitesItem(
                    tipus="szamla",
                    szint="lejart",
                    cim=f"Lejárt alvállalkozói számla: {sz.szamlaszam}",
                    reszlet=f"{sz.alvallalkozo.nev} — hátralék {sz.hatralek}",
                    datum=sz.esedekesseg,
                    link="/penzugy",
                )
            )

    items.sort(key=lambda i: (i.szint != "lejart", i.datum or today))
    return items
