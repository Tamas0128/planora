"""Értékesítési előrejelzés: a pipeline szakaszonkénti valószínűséggel
súlyozott értéke várható lezárási hónapok szerint, a havi célhoz mérve, plusz
felelősönkénti teljesítmény."""

from collections import defaultdict
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import Erdeklodes, ErdeklodesAllapot, User, UserRole
from app.models_ext import ErtekesitesiCel
from app.schemas_ext import CelPut, ElorejelzesHonap, ElorejelzesValasz, TeljesitmenyItem
from app.services.audit import log_audit

router = APIRouter(prefix="/elorejelzes", tags=["elorejelzes"])

VALOSZINUSEG = {
    ErdeklodesAllapot.UJ: 10,
    ErdeklodesAllapot.KAPCSOLATFELVETEL: 25,
    ErdeklodesAllapot.AJANLAT: 50,
    ErdeklodesAllapot.TARGYALAS: 75,
    ErdeklodesAllapot.NYERT: 100,
    ErdeklodesAllapot.ELVESZETT: 0,
}
_ZART = (ErdeklodesAllapot.NYERT, ErdeklodesAllapot.ELVESZETT)


def _honap(d: date) -> str:
    return f"{d.year:04d}-{d.month:02d}"


def _honapok(kezdet: date, db_szam: int) -> list[str]:
    ev, ho = kezdet.year, kezdet.month
    out = []
    for _ in range(db_szam):
        out.append(f"{ev:04d}-{ho:02d}")
        ho += 1
        if ho > 12:
            ev, ho = ev + 1, 1
    return out


@router.get("", response_model=ElorejelzesValasz)
def elorejelzes(
    honapok: int = 6,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    honapok = max(1, min(honapok, 24))
    ma = date.today()
    lista = _honapok(ma, honapok)
    celok = {c.honap: c.osszeg for c in db.query(ErtekesitesiCel).filter(ErtekesitesiCel.honap.in_(lista))}

    nyitott = defaultdict(Decimal)
    sulyozott = defaultdict(Decimal)
    nyert = defaultdict(Decimal)
    datum_nelkul = Decimal("0")
    teljesitmeny: dict[str | None, dict] = defaultdict(
        lambda: {"nyert_db": 0, "nyert_osszeg": Decimal("0"), "nyitott_sulyozott": Decimal("0")}
    )

    for l in db.query(Erdeklodes).options(joinedload(Erdeklodes.owner)).all():
        ertek = Decimal(l.becsult_ertek or 0)
        felelos = l.owner.full_name if l.owner else None
        if l.allapot == ErdeklodesAllapot.NYERT:
            nyert[_honap(l.varhato_lezaras or l.created_at.date())] += ertek
            t = teljesitmeny[felelos]
            t["nyert_db"] += 1
            t["nyert_osszeg"] += ertek
            continue
        if l.allapot in _ZART:
            continue
        suly = Decimal(VALOSZINUSEG[l.allapot]) / 100
        teljesitmeny[felelos]["nyitott_sulyozott"] += ertek * suly
        h = _honap(l.varhato_lezaras) if l.varhato_lezaras else None
        if h in lista:
            nyitott[h] += ertek
            sulyozott[h] += ertek * suly
        else:
            datum_nelkul += ertek * suly

    sorok = [
        ElorejelzesHonap(
            honap=h,
            nyitott_osszeg=nyitott[h],
            sulyozott_osszeg=sulyozott[h],
            nyert_osszeg=nyert[h],
            cel=celok.get(h),
        )
        for h in lista
    ]
    return ElorejelzesValasz(
        honapok=sorok,
        datum_nelkul_sulyozott=datum_nelkul,
        sulyozott_osszesen=sum((s.sulyozott_osszeg for s in sorok), Decimal("0")) + datum_nelkul,
        teljesitmeny=sorted(
            (TeljesitmenyItem(felelos=k, **v) for k, v in teljesitmeny.items()),
            key=lambda t: t.nyert_osszeg,
            reverse=True,
        ),
        valoszinusegek={a.value: p for a, p in VALOSZINUSEG.items()},
    )


@router.put("/cel")
def set_cel(
    body: CelPut,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ERTEKESITES, UserRole.VEZETES)),
):
    try:
        ev, ho = body.honap.split("-")
        if not (len(ev) == 4 and 1 <= int(ho) <= 12 and len(ho) == 2):
            raise ValueError
    except ValueError:
        raise HTTPException(status_code=400, detail="honap formátuma: ÉÉÉÉ-HH")
    if body.osszeg < 0:
        raise HTTPException(status_code=400, detail="A cél nem lehet negatív")
    cel = db.query(ErtekesitesiCel).filter(ErtekesitesiCel.honap == body.honap).first()
    if body.osszeg == 0:
        if cel:
            db.delete(cel)
    elif cel:
        cel.osszeg = body.osszeg
    else:
        db.add(ErtekesitesiCel(honap=body.honap, osszeg=body.osszeg))
    log_audit(db, user, "cel", None, "beallitas", f"{body.honap}: {body.osszeg}")
    db.commit()
    return {"honap": body.honap, "osszeg": body.osszeg}
