"""Értesítések: az élő lista összeállítása és a napi e-mailes összefoglaló.

Az összefoglalót csak az kapja, aki bekapcsolta (`User.email_ertesites`), naponta
legfeljebb egyszer (`User.utolso_email_ertesites`), és csak ha van teendő."""

import asyncio
import html
import logging
from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session, joinedload

from app.config import settings
from app.models import Feladat, User, UserRole
from app.models_ext import Jegy, JegyAllapot, JegyPrioritas
from app.models_finance import AlvallalkozoiSzamla, UgyfelSzamla
from app.schemas_crm import ErtesitesItem
from app.services.email import send_email

logger = logging.getLogger("ubrankovics.ertesites")

KOZELI_NAPOK = 2
_PENZUGY = (UserRole.ADMIN, UserRole.PENZUGY, UserRole.VEZETES)


def gyujtsd_ertesiteseket(db: Session, user: User, today: date | None = None) -> list[ErtesitesItem]:
    today = today or date.today()
    hatar = today + timedelta(days=KOZELI_NAPOK)
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
        surgos = j.prioritas == JegyPrioritas.SURGOS
        items.append(
            ErtesitesItem(
                tipus="jegy",
                szint="lejart" if surgos else "kozeli",
                cim=f"Jegy: {j.targy}",
                reszlet=f"{j.ugyfel.nev} — {'sürgős' if surgos else 'nyitott'}",
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


def _osszefoglalo_html(user: User, items: list[ErtesitesItem]) -> str:
    base = settings.public_base_url.rstrip("/")
    sorok = ""
    for i in items:
        jel = " <b style=\"color:#b00020\">(lejárt / sürgős)</b>" if i.szint == "lejart" else ""
        datum = f" · {i.datum.isoformat()}" if i.datum else ""
        reszlet = html.escape(i.reszlet or "")
        sorok += (
            f"<li><a href=\"{html.escape(base + i.link)}\">{html.escape(i.cim)}</a>{jel}"
            f"<br><small>{reszlet}{datum}</small></li>"
        )
    return (
        f"<p>Kedves {html.escape(user.full_name)}!</p>"
        f"<p>Ma {len(items)} teendőd van a(z) {html.escape(settings.cegnev)} CRM-ben:</p><ul>{sorok}</ul>"
        f'<p><small>Ezt a levelet azért kapod, mert bekapcsoltad az e-mailes napi összefoglalót. '
        f'Kikapcsolás: <a href="{html.escape(base)}">CRM</a> → Értesítések.</small></p>'
    )


def kuldj_osszefoglalot(db: Session, user: User, today: date | None = None, force: bool = False) -> str:
    """Visszatérés: "elkuldve" | "nincs_teendo" | "mar_elkuldve" | "nincs_smtp"."""
    today = today or date.today()
    if not force and user.utolso_email_ertesites == today:
        return "mar_elkuldve"
    items = gyujtsd_ertesiteseket(db, user, today)
    if not items:
        return "nincs_teendo"
    kuldve = send_email(user.email, f"Napi összefoglaló — {len(items)} teendő", _osszefoglalo_html(user, items))
    if not kuldve:
        return "nincs_smtp"
    user.utolso_email_ertesites = today
    db.commit()
    return "elkuldve"


def kuldj_minden_osszefoglalot(db: Session, today: date | None = None) -> int:
    kuldve = 0
    for user in db.query(User).filter(User.is_active.is_(True), User.email_ertesites.is_(True)).all():
        try:
            if kuldj_osszefoglalot(db, user, today) == "elkuldve":
                kuldve += 1
        except Exception:  # egy hibás címzett ne állítsa meg a többit
            logger.exception("Napi összefoglaló küldése sikertelen: user_id=%s", user.id)
    return kuldve


async def digest_utemezo(session_factory) -> None:
    """Óránként ellenőriz; a beállított óra után naponta egyszer küld. Az első
    ellenőrzés 60 mp-cel az indulás után történik (tesztekben sosem fut le)."""
    await asyncio.sleep(60)
    while True:
        try:
            if settings.email_digest_enabled and datetime.now().hour >= settings.email_digest_hour:
                def _futtat() -> int:
                    db = session_factory()
                    try:
                        return kuldj_minden_osszefoglalot(db)
                    finally:
                        db.close()

                kuldve = await asyncio.to_thread(_futtat)
                if kuldve:
                    logger.info("Napi összefoglaló elküldve %s felhasználónak", kuldve)
        except Exception:
            logger.exception("Napi összefoglaló ütemező hiba")
        await asyncio.sleep(3600)
