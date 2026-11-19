"""Pénzügyi modul — Szerződés (ügyfél, ütemezett részszámlákkal), TIG +
alvállalkozói számla, ügyfél számla, bankegyenleg-pillanatkép. Erre épül a
gördülő (rolling) cash-flow előrejelzés, lásd services/cashflow.py.

Külön fájlban, méret miatt — ugyanaz a Base/metadata, mint app/models.py,
ezért a kapcsolatok fájlok között is feloldódnak, amíg mindkét modult
importáljuk a mapperek konfigurálása előtt (main.py és migrations/env.py is
explicit importálja mindkettőt). Ugyanez a minta, mint a planora
models_finance.py-ja.
"""

import enum
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models import VatTipus


class TigAllapot(str, enum.Enum):
    TERVEZET = "tervezet"
    JOVAHAGYVA = "jovahagyva"
    SZAMLAZVA = "szamlazva"
    LEZART = "lezart"


class AlvallalkozoiSzamlaAllapot(str, enum.Enum):
    BEERKEZETT = "beerkezett"
    JOVAHAGYVA = "jovahagyva"
    FIZETESRE_VAR = "fizetesre_var"
    KIFIZETVE = "kifizetve"
    LEJART = "lejart"


class SzerzodesAllapot(str, enum.Enum):
    TERVEZET = "tervezet"
    AKTIV = "aktiv"
    TELJESITETT = "teljesitett"
    TOROLT = "torolt"


class UgyfelSzamlaAllapot(str, enum.Enum):
    KIALLITVA = "kiallitva"
    RESZBEN_FIZETVE = "reszben_fizetve"
    KIFIZETVE = "kifizetve"
    LEJART = "lejart"


class Tig(Base):
    """Teljesítésigazolás — az alvállalkozói elszámolás alapja. Egy TIG-re
    utólag kiállítható az alvállalkozói számla (AlvallalkozoiSzamla.tig_id,
    opcionális — spot munkánál lehet TIG nélkül is számla)."""

    __tablename__ = "tigek"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    projekt_id: Mapped[int] = mapped_column(ForeignKey("projektek.id", ondelete="CASCADE"), index=True)
    alvallalkozo_id: Mapped[int] = mapped_column(ForeignKey("alvallalkozok.id"), index=True)
    datum: Mapped[date] = mapped_column(Date)
    idoszak_kezdet: Mapped[date] = mapped_column(Date)
    idoszak_veg: Mapped[date] = mapped_column(Date)
    netto: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    afa_tipus: Mapped[VatTipus] = mapped_column(Enum(VatTipus))
    afa: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    brutto: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    allapot: Mapped[TigAllapot] = mapped_column(Enum(TigAllapot), default=TigAllapot.TERVEZET)
    megjegyzes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    projekt = relationship("Projekt")
    alvallalkozo = relationship("Alvallalkozo")
    szamlak: Mapped[list["AlvallalkozoiSzamla"]] = relationship(back_populates="tig")


class AlvallalkozoiSzamla(Base):
    __tablename__ = "alvallalkozoi_szamlak"
    __table_args__ = (UniqueConstraint("alvallalkozo_id", "szamlaszam", name="uq_alv_szamla_szam"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    projekt_id: Mapped[int] = mapped_column(ForeignKey("projektek.id", ondelete="CASCADE"), index=True)
    alvallalkozo_id: Mapped[int] = mapped_column(ForeignKey("alvallalkozok.id"), index=True)
    tig_id: Mapped[int | None] = mapped_column(
        ForeignKey("tigek.id", ondelete="SET NULL"), nullable=True, index=True
    )
    szamlaszam: Mapped[str] = mapped_column(String(50))
    teljesites_datum: Mapped[date] = mapped_column(Date)
    kiallitas_datum: Mapped[date] = mapped_column(Date)
    esedekesseg: Mapped[date] = mapped_column(Date)
    fizetes_datum: Mapped[date | None] = mapped_column(Date, nullable=True)
    netto: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    afa_tipus: Mapped[VatTipus] = mapped_column(Enum(VatTipus))
    afa: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    brutto: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    fizetett_osszeg: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    allapot: Mapped[AlvallalkozoiSzamlaAllapot] = mapped_column(
        Enum(AlvallalkozoiSzamlaAllapot), default=AlvallalkozoiSzamlaAllapot.BEERKEZETT
    )
    megjegyzes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    projekt = relationship("Projekt")
    alvallalkozo = relationship("Alvallalkozo")
    tig: Mapped["Tig | None"] = relationship(back_populates="szamlak")

    @property
    def hatralek(self) -> Decimal:
        return self.brutto - (self.fizetett_osszeg or Decimal(0))


class Szerzodes(Base):
    """Ügyfél-szerződés, ütemezett részszámlákkal (SzerzodesReszlet) — a
    gördülő cash-flow "tervezett bevétel" rétegének forrása, amíg a
    részletből tényleges UgyfelSzamla nem lesz."""

    __tablename__ = "szerzodesek"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    projekt_id: Mapped[int] = mapped_column(ForeignKey("projektek.id", ondelete="CASCADE"), index=True)
    ugyfel_id: Mapped[int] = mapped_column(ForeignKey("ugyfelek.id"), index=True)
    szerzodesszam: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    osszeg: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    afa_tipus: Mapped[VatTipus] = mapped_column(Enum(VatTipus), default=VatTipus.AFA_27)
    kezdes: Mapped[date] = mapped_column(Date)
    befejezes: Mapped[date] = mapped_column(Date)
    allapot: Mapped[SzerzodesAllapot] = mapped_column(Enum(SzerzodesAllapot), default=SzerzodesAllapot.TERVEZET)
    megjegyzes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    projekt = relationship("Projekt")
    ugyfel = relationship("Ugyfel")
    reszletek: Mapped[list["SzerzodesReszlet"]] = relationship(
        back_populates="szerzodes", cascade="all, delete-orphan", order_by="SzerzodesReszlet.esedekesseg"
    )


class SzerzodesReszlet(Base):
    """Ütemezett részszámla-tétel. Amíg kiallitott_szamla_id None, a gördülő
    cash-flow "tervezett bevétel" rétegébe számít; miután tényleges
    UgyfelSzamla készül belőle, átkerül a "tényleges" rétegbe (a számítási
    szolgáltatás ez alapján dönt, nem duplikálja a két réteget)."""

    __tablename__ = "szerzodes_reszletek"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    szerzodes_id: Mapped[int] = mapped_column(ForeignKey("szerzodesek.id", ondelete="CASCADE"), index=True)
    megnevezes: Mapped[str] = mapped_column(String(255))
    osszeg: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    esedekesseg: Mapped[date] = mapped_column(Date)
    kiallitott_szamla_id: Mapped[int | None] = mapped_column(
        ForeignKey("ugyfel_szamlak.id", ondelete="SET NULL"), nullable=True
    )

    szerzodes: Mapped[Szerzodes] = relationship(back_populates="reszletek")
    kiallitott_szamla: Mapped["UgyfelSzamla | None"] = relationship()


class UgyfelSzamla(Base):
    __tablename__ = "ugyfel_szamlak"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    projekt_id: Mapped[int] = mapped_column(ForeignKey("projektek.id", ondelete="CASCADE"), index=True)
    ugyfel_id: Mapped[int] = mapped_column(ForeignKey("ugyfelek.id"), index=True)
    szerzodes_id: Mapped[int | None] = mapped_column(
        ForeignKey("szerzodesek.id", ondelete="SET NULL"), nullable=True, index=True
    )
    szamlaszam: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    kiallitas_datum: Mapped[date] = mapped_column(Date)
    teljesites_datum: Mapped[date] = mapped_column(Date)
    esedekesseg: Mapped[date] = mapped_column(Date)
    fizetes_datum: Mapped[date | None] = mapped_column(Date, nullable=True)
    netto: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    afa_tipus: Mapped[VatTipus] = mapped_column(Enum(VatTipus))
    afa: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    brutto: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    fizetett_osszeg: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    allapot: Mapped[UgyfelSzamlaAllapot] = mapped_column(
        Enum(UgyfelSzamlaAllapot), default=UgyfelSzamlaAllapot.KIALLITVA
    )
    megjegyzes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    projekt = relationship("Projekt")
    ugyfel = relationship("Ugyfel")
    szerzodes: Mapped["Szerzodes | None"] = relationship()

    @property
    def hatralek(self) -> Decimal:
        return self.brutto - (self.fizetett_osszeg or Decimal(0))


class TervezettBerkoltseg(Base):
    """Tervezett, cégszintű bérköltség havi bontásban — a gördülő cash-flow
    "tervezett kiadás" rétegének egyik forrása. Nem projekt-szintű, mert a
    bérköltség jellemzően nem bontható le egyenesen projektekre."""

    __tablename__ = "tervezett_berkoltsegek"
    __table_args__ = (UniqueConstraint("honap", name="uq_berkoltseg_honap"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    honap: Mapped[date] = mapped_column(Date)
    osszeg: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    megjegyzes: Mapped[str | None] = mapped_column(Text, nullable=True)


class BankEgyenleg(Base):
    """Bankegyenleg-pillanatkép — a gördülő cash-flow horizont első
    bucketjének nyitó egyenlege. MVP-ben kézzel rögzített érték, nincs
    banki integráció."""

    __tablename__ = "bank_egyenlegek"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    datum: Mapped[date] = mapped_column(Date, unique=True, index=True)
    egyenleg: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    rogzitette_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    rogzitette = relationship("User")
