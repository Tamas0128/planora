"""Projekt-életciklus bővítések: átadás-átvételi jegyzőkönyv (garanciával), építési
napló fotókkal, verziózott vevői ajánlat. Külön fájl (models_ext mintájára); a
main.py és a migrations/env.py is importálja."""

import enum
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models import Projekt, User  # noqa: F401


class AtvetelAllapot(str, enum.Enum):
    TERVEZET = "tervezet"
    ALAIRT = "alairt"


class Atvetel(Base):
    """Átadás-átvételi jegyzőkönyv; aláírással indul a garanciális idő."""

    __tablename__ = "atvetelek"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    projekt_id: Mapped[int] = mapped_column(ForeignKey("projektek.id", ondelete="CASCADE"), index=True)
    datum: Mapped[date] = mapped_column(Date)
    atado_nev: Mapped[str] = mapped_column(String(255))
    atvevo_nev: Mapped[str] = mapped_column(String(255))
    hibak: Mapped[str | None] = mapped_column(Text, nullable=True)  # átvételkor feltárt hiányosságok
    megjegyzes: Mapped[str | None] = mapped_column(Text, nullable=True)
    garancia_honap: Mapped[int] = mapped_column(Integer, default=24)
    allapot: Mapped[AtvetelAllapot] = mapped_column(Enum(AtvetelAllapot), default=AtvetelAllapot.TERVEZET)
    alairva_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    garancia_lejar: Mapped[date | None] = mapped_column(Date, nullable=True)
    letrehozo_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class NaploBejegyzes(Base):
    """Napi építési napló bejegyzés."""

    __tablename__ = "naplo_bejegyzesek"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    projekt_id: Mapped[int] = mapped_column(ForeignKey("projektek.id", ondelete="CASCADE"), index=True)
    datum: Mapped[date] = mapped_column(Date)
    idojaras: Mapped[str | None] = mapped_column(String(100), nullable=True)
    letszam: Mapped[int | None] = mapped_column(Integer, nullable=True)
    munka: Mapped[str] = mapped_column(Text)
    megjegyzes: Mapped[str | None] = mapped_column(Text, nullable=True)
    szerzo_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    szerzo: Mapped["User | None"] = relationship(foreign_keys=[szerzo_id])
    fotok: Mapped[list["NaploFoto"]] = relationship(
        cascade="all, delete-orphan", order_by="NaploFoto.id"
    )


class NaploFoto(Base):
    __tablename__ = "naplo_fotok"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    bejegyzes_id: Mapped[int] = mapped_column(ForeignKey("naplo_bejegyzesek.id", ondelete="CASCADE"), index=True)
    utvonal: Mapped[str] = mapped_column(String(255))
    eredeti_nev: Mapped[str | None] = mapped_column(String(255), nullable=True)
    tartalom_tipus: Mapped[str | None] = mapped_column(String(100), nullable=True)
    meret: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AjanlatAllapot(str, enum.Enum):
    TERVEZET = "tervezet"
    ELKULDVE = "elkuldve"
    ELFOGADVA = "elfogadva"
    ELUTASITVA = "elutasitva"


class VevoiAjanlat(Base):
    """Egy projekt vevői ajánlata; a módosítások új verzióként rögzülnek."""

    __tablename__ = "vevoi_ajanlatok"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    projekt_id: Mapped[int] = mapped_column(ForeignKey("projektek.id", ondelete="CASCADE"), index=True)
    cim: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    verziok: Mapped[list["AjanlatVerzio"]] = relationship(
        cascade="all, delete-orphan", order_by="AjanlatVerzio.verzio"
    )


class AjanlatVerzio(Base):
    __tablename__ = "ajanlat_verziok"
    __table_args__ = (UniqueConstraint("ajanlat_id", "verzio", name="uq_ajanlat_verzio"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ajanlat_id: Mapped[int] = mapped_column(ForeignKey("vevoi_ajanlatok.id", ondelete="CASCADE"), index=True)
    verzio: Mapped[int] = mapped_column(Integer)
    allapot: Mapped[AjanlatAllapot] = mapped_column(Enum(AjanlatAllapot), default=AjanlatAllapot.TERVEZET)
    ervenyes_ig: Mapped[date | None] = mapped_column(Date, nullable=True)
    megjegyzes: Mapped[str | None] = mapped_column(Text, nullable=True)
    netto_osszeg: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    letrehozo_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    sorok: Mapped[list["AjanlatSor"]] = relationship(
        cascade="all, delete-orphan", order_by="AjanlatSor.sorrend, AjanlatSor.id"
    )


class AjanlatSor(Base):
    __tablename__ = "ajanlat_sorok"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    verzio_id: Mapped[int] = mapped_column(ForeignKey("ajanlat_verziok.id", ondelete="CASCADE"), index=True)
    sorrend: Mapped[int] = mapped_column(Integer, default=0)
    megnevezes: Mapped[str] = mapped_column(String(255))
    mennyiseg: Mapped[Decimal] = mapped_column(Numeric(12, 3), default=1)
    egyseg: Mapped[str | None] = mapped_column(String(30), nullable=True)
    egysegar: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)


class SablonFajl(Base):
    """Feltöltött .docx dokumentumsablon (típusonként egy); a generálás {{ változó }} helyőrzőket tölt ki."""

    __tablename__ = "sablon_fajlok"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tipus: Mapped[str] = mapped_column(String(30), unique=True)  # DokumentumSablonTipus értéke
    utvonal: Mapped[str] = mapped_column(String(255))
    eredeti_nev: Mapped[str] = mapped_column(String(255))
    meret: Mapped[int] = mapped_column(Integer)
    feltolto_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
