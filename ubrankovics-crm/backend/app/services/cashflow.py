"""Gördülő (rolling) cash-flow motor.

A specifikáció (lásd app/models_finance.py docstring) "egységes cash flow
input" elve: minden forrás (ügyfél számla, alvállalkozói számla, anyagrendelés,
szerződés-részlet, bérköltség) ugyanazt a néhány mezőt adja (irány, összeg,
esedékesség, tényleges-e) — a bucket-motor ezt a közös alakot látja, sosem a
forrás saját tábláját. Lásd CashflowItem (app/schemas_finance.py).

Két réteg:
- "tényleges": már létező számla/rendelés, amíg nincs kifizetve a bruttó
  (vagy annak hátraléka) a fizetési határidő szerinti bucketbe esik; lejárt,
  még nyitott tételek mindig az első (aktuális) bucketbe csúsznak.
- "tervezett": még nem számlázott, de szerződés-ütemterv / jóváhagyott PO /
  tervezett bérköltség alapján várható tétel.

Nyitó egyenleg: a legutóbb rögzített BankEgyenleg — ez a felhasználó által
kézzel rögzített, tényleges bankszámla-állás, nem számítható az adatokból.
"""

from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models import AnyagRendeles, SzamlaAllapot
from app.services.afa import compute_afa
from app.models_finance import (
    AlvallalkozoiSzamla,
    BankEgyenleg,
    SzerzodesReszlet,
    TervezettBerkoltseg,
    UgyfelSzamla,
)
from app.schemas_finance import CashflowBucket, CashflowItem


@dataclass
class _Bucket:
    start: date
    end: date
    items: list[CashflowItem] = field(default_factory=list)


def _bucket_start(d: date, bucket_meret: str) -> date:
    if bucket_meret == "honap":
        return d.replace(day=1)
    return d - timedelta(days=d.weekday())  # hétfő


def _next_bucket_start(d: date, bucket_meret: str) -> date:
    if bucket_meret == "honap":
        return (d.replace(day=28) + timedelta(days=4)).replace(day=1)
    return d + timedelta(days=7)


def _build_buckets(bucket_meret: str, horizont: int, today: date) -> list[_Bucket]:
    buckets = []
    start = _bucket_start(today, bucket_meret)
    for _ in range(horizont):
        end = _next_bucket_start(start, bucket_meret) - timedelta(days=1)
        buckets.append(_Bucket(start=start, end=end))
        start = end + timedelta(days=1)
    return buckets


def _place(buckets: list[_Bucket], esedekesseg: date, item: CashflowItem) -> None:
    """Az esedékesség szerinti bucketbe teszi a tételt; ha a dátum a horizont
    első bucketje elé esik (lejárt, még nyitott), az első bucketbe csúszik."""
    if esedekesseg < buckets[0].start:
        buckets[0].items.append(item)
        return
    for b in buckets:
        if b.start <= esedekesseg <= b.end:
            b.items.append(item)
            return
    # a horizonton túl esedékes — nem jelenik meg ebben a nézetben


def _collect_items(db: Session, projekt_id: int | None, horizon_start: date) -> list[CashflowItem]:
    items: list[CashflowItem] = []

    ugyfel_q = db.query(UgyfelSzamla).filter(UgyfelSzamla.fizetes_datum.is_(None))
    if projekt_id is not None:
        ugyfel_q = ugyfel_q.filter(UgyfelSzamla.projekt_id == projekt_id)
    for sz in ugyfel_q.all():
        items.append(
            CashflowItem(
                irany="bevetel",
                reteg="teny",
                leiras=f"Ügyfélszámla {sz.szamlaszam}",
                osszeg=sz.hatralek,
                esedekesseg=sz.esedekesseg,
                lejart=sz.esedekesseg < horizon_start,
                forras_tipus="ugyfel_szamla",
                forras_id=sz.id,
                projekt_id=sz.projekt_id,
            )
        )

    alv_q = db.query(AlvallalkozoiSzamla).filter(AlvallalkozoiSzamla.fizetes_datum.is_(None))
    if projekt_id is not None:
        alv_q = alv_q.filter(AlvallalkozoiSzamla.projekt_id == projekt_id)
    for sz in alv_q.all():
        items.append(
            CashflowItem(
                irany="kiadas",
                reteg="teny",
                leiras=f"Alvállalkozói számla {sz.szamlaszam}",
                osszeg=sz.hatralek,
                esedekesseg=sz.esedekesseg,
                lejart=sz.esedekesseg < horizon_start,
                forras_tipus="alvallalkozoi_szamla",
                forras_id=sz.id,
                projekt_id=sz.projekt_id,
            )
        )

    # Beszerzési (anyagrendelés) számlák — csak azok, amikhez tényleges
    # számla érkezett (szamla_allapot != NINCS) és még nincs kifizetve.
    rendeles_q = db.query(AnyagRendeles).filter(
        AnyagRendeles.szamla_allapot == SzamlaAllapot.MEGERKEZETT,
        AnyagRendeles.szamla_fizetesi_hatarido.isnot(None),
    )
    if projekt_id is not None:
        rendeles_q = rendeles_q.filter(AnyagRendeles.tetel.has(projekt_id=projekt_id))
    for r in rendeles_q.all():
        if r.szamla_osszeg is None:
            continue
        items.append(
            CashflowItem(
                irany="kiadas",
                reteg="teny",
                leiras=f"Beszerzési számla {r.szamla_szam or r.megnevezes}",
                osszeg=Decimal(str(r.szamla_osszeg)),
                esedekesseg=r.szamla_fizetesi_hatarido,
                lejart=r.szamla_fizetesi_hatarido < horizon_start,
                forras_tipus="anyagrendeles",
                forras_id=r.id,
                projekt_id=r.tetel.projekt_id if r.tetel else None,
            )
        )

    # Tervezett bevétel: szerződés-részletek, amik még nem számlázottak.
    reszlet_q = db.query(SzerzodesReszlet).filter(SzerzodesReszlet.kiallitott_szamla_id.is_(None))
    if projekt_id is not None:
        reszlet_q = reszlet_q.filter(SzerzodesReszlet.szerzodes.has(projekt_id=projekt_id))
    for resz in reszlet_q.all():
        # resz.osszeg a szerződés ÁFA-kulcsával nettó — a cash-flow-hoz a
        # bruttó (tényleges pénzmozgás) számít, lásd a modul docstringjét.
        _, brutto = compute_afa(Decimal(resz.osszeg), resz.szerzodes.afa_tipus)
        items.append(
            CashflowItem(
                irany="bevetel",
                reteg="terv",
                leiras=f"Szerződés részlet: {resz.megnevezes}",
                osszeg=brutto,
                esedekesseg=resz.esedekesseg,
                lejart=resz.esedekesseg < horizon_start,
                forras_tipus="szerzodes_reszlet",
                forras_id=resz.id,
                projekt_id=resz.szerzodes.projekt_id,
            )
        )

    # Tervezett kiadás: jóváhagyott, de még nem számlázott anyagrendelés —
    # a várható dátum a szükséges/visszaigazolt/megrendelés dátum, ami elsőként
    # elérhető közülük.
    terv_rendeles_q = db.query(AnyagRendeles).filter(
        AnyagRendeles.jovahagyva.is_(True),
        AnyagRendeles.szamla_allapot == SzamlaAllapot.NINCS,
    )
    if projekt_id is not None:
        terv_rendeles_q = terv_rendeles_q.filter(AnyagRendeles.tetel.has(projekt_id=projekt_id))
    for r in terv_rendeles_q.all():
        varhato = r.szukseges_datum or r.visszaigazolt_datum or r.megrendeles_datum
        if varhato is None:
            continue
        osszeg = None
        if r.kivalasztott_ajanlat is not None:
            osszeg = Decimal(str(r.kivalasztott_ajanlat.brutto))
        elif r.szamla_osszeg is not None:
            osszeg = Decimal(str(r.szamla_osszeg))
        if osszeg is None:
            continue
        items.append(
            CashflowItem(
                irany="kiadas",
                reteg="terv",
                leiras=f"Megrendelés: {r.megnevezes}",
                osszeg=osszeg,
                esedekesseg=varhato,
                lejart=varhato < horizon_start,
                forras_tipus="anyagrendeles",
                forras_id=r.id,
                projekt_id=r.tetel.projekt_id if r.tetel else None,
            )
        )

    # Tervezett bérköltség — cégszintű, nem projekt-specifikus, ezért csak a
    # teljes cégre (projekt_id=None) kért nézetben jelenik meg.
    if projekt_id is None:
        for b in db.query(TervezettBerkoltseg).all():
            items.append(
                CashflowItem(
                    irany="kiadas",
                    reteg="terv",
                    leiras=f"Bérköltség ({b.honap.strftime('%Y.%m')})",
                    osszeg=b.osszeg,
                    esedekesseg=b.honap,
                    lejart=b.honap < horizon_start,
                    forras_tipus="berkoltseg",
                    forras_id=b.id,
                    projekt_id=None,
                )
            )

    return items


def _latest_balance(db: Session) -> tuple[Decimal, date | None]:
    snap = db.query(BankEgyenleg).order_by(BankEgyenleg.datum.desc()).first()
    if snap is None:
        return Decimal("0"), None
    return snap.egyenleg, snap.datum


def rolling_forecast(
    db: Session,
    bucket_meret: str = "het",
    horizont: int = 13,
    projekt_id: int | None = None,
    today: date | None = None,
) -> tuple[list[CashflowBucket], list[list[CashflowItem]], date | None]:
    """Visszaadja a bucket-összesítőket, és (külön listában, azonos
    indexeléssel) a bucketenkénti konkrét tételeket a drill-downhoz."""

    today = today or date.today()
    buckets = _build_buckets(bucket_meret, horizont, today)
    nyito_egyenleg, nyito_datum = _latest_balance(db)

    all_items = _collect_items(db, projekt_id, buckets[0].start)
    for item in all_items:
        _place(buckets, item.esedekesseg, item)

    summaries: list[CashflowBucket] = []
    item_lists: list[list[CashflowItem]] = []
    nyito = nyito_egyenleg
    for b in buckets:
        bevetel_teny = sum((i.osszeg for i in b.items if i.irany == "bevetel" and i.reteg == "teny"), Decimal("0"))
        bevetel_terv = sum((i.osszeg for i in b.items if i.irany == "bevetel" and i.reteg == "terv"), Decimal("0"))
        kiadas_teny = sum((i.osszeg for i in b.items if i.irany == "kiadas" and i.reteg == "teny"), Decimal("0"))
        kiadas_terv = sum((i.osszeg for i in b.items if i.irany == "kiadas" and i.reteg == "terv"), Decimal("0"))
        netto = bevetel_teny + bevetel_terv - kiadas_teny - kiadas_terv
        zaro = nyito + netto
        summaries.append(
            CashflowBucket(
                kezdo_datum=b.start,
                vege_datum=b.end,
                nyito=nyito,
                bevetel_teny=bevetel_teny,
                bevetel_terv=bevetel_terv,
                kiadas_teny=kiadas_teny,
                kiadas_terv=kiadas_terv,
                netto=netto,
                zaro=zaro,
                negativ=zaro < 0,
            )
        )
        item_lists.append(b.items)
        nyito = zaro

    return summaries, item_lists, nyito_datum
