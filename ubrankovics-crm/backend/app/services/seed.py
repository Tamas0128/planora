"""Induló (seed) adatok: admin felhasználó + munkanem-törzs.

A munkanem-lista itt csak egy KIINDULÓ, a felhasználó CRM-elemzésében
(`C:\\dev\\CRM\\docs\\1-3.xlsx`, 3.4 pont) konkrétan megnevezett tételekből
összeállított részhalmaz — nem a teljes ~45 elemes katalógus. A tényleges
excel-forrás teljes feldolgozása és a munkanem-lista bővítése külön,
jóváhagyott lépés (lásd a terv "8. szakasz" pontját), itt nem történik meg.
"""

import logging
import secrets

from sqlalchemy.orm import Session

from app.config import settings
from app.core.security import hash_password
from app.models import Munkanem, MunkanemCsoport, User, UserRole

logger = logging.getLogger("ubrankovics.seed")

_MUNKANEM_SEED: list[dict] = [
    {"kod": "ALAP-VIZSZIG", "nev": "Alapozás, vízszigetelés", "csoport": MunkanemCsoport.ALAPOZAS, "sorrend": 10, "alias": "Alapozás; Vízszigetelés"},
    {"kod": "FENYCSAT", "nev": "Fénycsatorna", "csoport": MunkanemCsoport.TETO, "sorrend": 20, "alias": None},
    {"kod": "PADLASFEL", "nev": "Padlásfeljáró", "csoport": MunkanemCsoport.TETO, "sorrend": 21, "alias": "Tetőkibúvó"},
    {"kod": "KULTERI-NYZ", "nev": "Kültéri nyílászáró", "csoport": MunkanemCsoport.NYILASZARO, "sorrend": 30, "alias": "Külső nyílászáró"},
    {"kod": "KULSO-KERET", "nev": "Külső keret", "csoport": MunkanemCsoport.NYILASZARO, "sorrend": 31, "alias": None},
    {"kod": "GARAZSKAPU", "nev": "Garázskapu", "csoport": MunkanemCsoport.NYILASZARO, "sorrend": 32, "alias": None},
    {"kod": "KULSO-LABAZAT", "nev": "Külső lábazat", "csoport": MunkanemCsoport.KULSO_FELULET, "sorrend": 40, "alias": "Lábazat"},
    {"kod": "VIZSZERELES", "nev": "Vízszerelés", "csoport": MunkanemCsoport.GEPESZET, "sorrend": 50, "alias": None},
    {"kod": "FUTES-HUTES", "nev": "Fűtés-hűtés", "csoport": MunkanemCsoport.GEPESZET, "sorrend": 51, "alias": "Fűtésszerelés"},
    {"kod": "ALJZAT", "nev": "Aljzat", "csoport": MunkanemCsoport.ALJZAT, "sorrend": 60, "alias": None},
    {"kod": "GIPSZKARTON", "nev": "Gipszkarton", "csoport": MunkanemCsoport.BELSO, "sorrend": 70, "alias": "Gipszkarton (álmenny)"},
    {"kod": "BELSO-FESTES", "nev": "Belső glettelés, festés", "csoport": MunkanemCsoport.BELSO, "sorrend": 71, "alias": "Belső festés"},
    {"kod": "KANDALLO", "nev": "Kandalló, szerelt kémény", "csoport": MunkanemCsoport.BELSO, "sorrend": 72, "alias": None},
]


def seed_munkanemek(db: Session) -> None:
    existing = {m.kod for m in db.query(Munkanem.kod).all()}
    for item in _MUNKANEM_SEED:
        if item["kod"] not in existing:
            db.add(Munkanem(**item))
    db.commit()


def seed_admin(db: Session) -> None:
    admin = db.query(User).filter(User.username == "admin").first()
    password = settings.admin_password
    if not admin:
        if not password:
            password = secrets.token_urlsafe(16)
            logger.warning(
                "ADMIN_PASSWORD not set — generated random admin password: %s "
                "(set ADMIN_PASSWORD in your environment to control this)",
                password,
            )
        admin = User(
            username="admin",
            email="admin@ubrankovics.local",
            full_name="Rendszergazda",
            hashed_password=hash_password(password),
            role=UserRole.ADMIN,
        )
        db.add(admin)
        db.commit()
    elif password:
        admin.hashed_password = hash_password(password)
        db.commit()
