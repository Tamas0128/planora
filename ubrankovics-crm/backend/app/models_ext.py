"""CRM-bővítések: auditnapló, egyedi mezők, címkék + kampányok, ügyfélszolgálati
jegyek, értékesítési célok. Külön fájlban (models_finance mintájára); a
main.py és a migrations/env.py is importálja, hogy a mapperek feloldódjanak."""

import enum
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models import User


class AuditNaplo(Base):
    """Ki, mikor, mit csinált (létrehozás / módosítás / törlés / egyesítés...)."""

    __tablename__ = "audit_naplo"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    entitas: Mapped[str] = mapped_column(String(50), index=True)
    entitas_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    muvelet: Mapped[str] = mapped_column(String(50))
    reszletek: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    user: Mapped["User | None"] = relationship()


class EgyediMezo(Base):
    """Admin által definiált extra mező ügyfélhez vagy érdeklődőhöz."""

    __tablename__ = "egyedi_mezok"
    __table_args__ = (UniqueConstraint("entitas", "nev", name="uq_egyedi_mezo_entitas_nev"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    entitas: Mapped[str] = mapped_column(String(20))  # "ugyfel" | "erdeklodes"
    nev: Mapped[str] = mapped_column(String(100))
    tipus: Mapped[str] = mapped_column(String(20), default="szoveg")  # szoveg | szam | datum
    sorrend: Mapped[int] = mapped_column(Integer, default=0)


class EgyediMezoErtek(Base):
    __tablename__ = "egyedi_mezo_ertekek"
    __table_args__ = (UniqueConstraint("mezo_id", "entitas_id", name="uq_egyedi_mezo_ertek"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    mezo_id: Mapped[int] = mapped_column(ForeignKey("egyedi_mezok.id", ondelete="CASCADE"))
    entitas_id: Mapped[int] = mapped_column(Integer, index=True)
    ertek: Mapped[str] = mapped_column(Text)


ugyfel_cimkek = Table(
    "ugyfel_cimkek",
    Base.metadata,
    Column("ugyfel_id", ForeignKey("ugyfelek.id", ondelete="CASCADE"), primary_key=True),
    Column("cimke_id", ForeignKey("cimkek.id", ondelete="CASCADE"), primary_key=True),
)


class Cimke(Base):
    """Ügyfél-címke — egy címke = egy szegmens (marketing, kampány-célcsoport)."""

    __tablename__ = "cimkek"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nev: Mapped[str] = mapped_column(String(100), unique=True)

    ugyfelek = relationship("Ugyfel", secondary=ugyfel_cimkek)


class Kampany(Base):
    """Tömeges e-mail (hírlevél) egy szegmensnek vagy minden e-mailes ügyfélnek."""

    __tablename__ = "kampanyok"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nev: Mapped[str] = mapped_column(String(255))
    targy: Mapped[str] = mapped_column(String(255))
    uzenet: Mapped[str] = mapped_column(Text)
    cimke_id: Mapped[int | None] = mapped_column(ForeignKey("cimkek.id", ondelete="SET NULL"), nullable=True)
    cimzettek_szama: Mapped[int] = mapped_column(Integer, default=0)
    elkuldve_szama: Mapped[int] = mapped_column(Integer, default=0)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    cimke: Mapped["Cimke | None"] = relationship()
    user: Mapped["User | None"] = relationship()


class JegyAllapot(str, enum.Enum):
    NYITOTT = "nyitott"
    FOLYAMATBAN = "folyamatban"
    MEGOLDVA = "megoldva"
    LEZART = "lezart"


class JegyPrioritas(str, enum.Enum):
    ALACSONY = "alacsony"
    NORMAL = "normal"
    SURGOS = "surgos"


class Jegy(Base):
    """Ügyfélszolgálati jegy: reklamáció, hibabejelentés, kérés."""

    __tablename__ = "jegyek"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ugyfel_id: Mapped[int] = mapped_column(ForeignKey("ugyfelek.id", ondelete="CASCADE"), index=True)
    projekt_id: Mapped[int | None] = mapped_column(ForeignKey("projektek.id", ondelete="SET NULL"), nullable=True)
    targy: Mapped[str] = mapped_column(String(255))
    leiras: Mapped[str | None] = mapped_column(Text, nullable=True)
    allapot: Mapped[JegyAllapot] = mapped_column(Enum(JegyAllapot), default=JegyAllapot.NYITOTT)
    prioritas: Mapped[JegyPrioritas] = mapped_column(Enum(JegyPrioritas), default=JegyPrioritas.NORMAL)
    felelos_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    letrehozo_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    lezarva_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    ugyfel = relationship("Ugyfel")
    felelos: Mapped["User | None"] = relationship(foreign_keys=[felelos_id])


class ErtekesitesiCel(Base):
    """Havi értékesítési cél (nyert érték, Ft) az előrejelzéshez."""

    __tablename__ = "ertekesitesi_celok"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    honap: Mapped[str] = mapped_column(String(7), unique=True)  # "YYYY-MM"
    osszeg: Mapped[Decimal] = mapped_column(Numeric(14, 2))
