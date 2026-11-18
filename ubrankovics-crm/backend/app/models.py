import enum
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
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


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    ERTEKESITES = "ertekesites"
    KIVITELEZES = "kivitelezes"
    BESZERZES = "beszerzes"
    PENZUGY = "penzugy"
    VEZETES = "vezetes"


class ProjektAllapot(str, enum.Enum):
    UJ = "uj"
    AJANLAT = "ajanlat"
    SZERZODOTT = "szerzodott"
    KIVITELEZES = "kivitelezes"
    LEZART = "lezart"


class SzemelySzervezet(str, enum.Enum):
    BELSO = "belso"
    KULSO = "kulso"


class ProjektSzerepTipus(str, enum.Enum):
    EPITESVEZETO = "epitesvezeto"
    PROJEKTFELELOS = "projektfelelos"
    MUSZAKI_ELLENOR = "muszaki_ellenor"
    EPITESZ_TERVEZO = "epitesz_tervezo"
    GYARTASTERVEZO = "gyartastervezo"


class MunkanemCsoport(str, enum.Enum):
    SZERKEZET = "szerkezet"
    ALAPOZAS = "alapozas"
    TETO = "teto"
    NYILASZARO = "nyilaszaro"
    KULSO_FELULET = "kulso_felulet"
    GEPESZET = "gepeszet"
    ALJZAT = "aljzat"
    BELSO = "belso"


class VallalasTipus(str, enum.Enum):
    SAJAT = "sajat"
    ALVALLALKOZO = "alvallalkozo"
    UGYFEL = "ugyfel"
    NINCS = "nincs"


class TetelSzakasz(str, enum.Enum):
    AJANLAT = "ajanlat"
    SZERZODES = "szerzodes"
    BESZERZES = "beszerzes"
    KIVITELEZES = "kivitelezes"
    KESZ = "kesz"


class TetelEsemenyTipus(str, enum.Enum):
    AJANLATKERES = "ajanlatkeres"
    AJANLAT_BEERKEZETT = "ajanlat_beerkezett"
    AJANLAT_UGYFELNEK = "ajanlat_ugyfelnek"
    AJANLAT_ALAIRVA = "ajanlat_alairva"
    SZERZODES = "szerzodes"
    ANYAG_MEGRENDELVE = "anyag_megrendelve"
    ANYAG_MEGERKEZETT = "anyag_megerkezett"
    MUNKA_KESZ = "munka_kesz"


class TetelEsemenyAllapot(str, enum.Enum):
    NEM_RELEVANS = "nem_relevans"
    NYITOTT = "nyitott"
    FOLYAMATBAN = "folyamatban"
    KESZ = "kesz"


# ---------------------------------------------------------------------------
# User / auth
# ---------------------------------------------------------------------------


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True)
    full_name: Mapped[str] = mapped_column(String(255))
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.ERTEKESITES)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


# ---------------------------------------------------------------------------
# Ügyfél / Projekt / Személy / Szerep
# ---------------------------------------------------------------------------


class Ugyfel(Base):
    __tablename__ = "ugyfelek"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nev: Mapped[str] = mapped_column(String(255), index=True)
    telefon: Mapped[str | None] = mapped_column(String(50), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    owner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    owner: Mapped[User | None] = relationship()
    projekt_linkek: Mapped[list["ProjektUgyfel"]] = relationship(
        back_populates="ugyfel", cascade="all, delete-orphan"
    )


class Projekt(Base):
    __tablename__ = "projektek"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    projekt_nev: Mapped[str] = mapped_column(String(255), index=True)
    hrsz: Mapped[str | None] = mapped_column(String(100), nullable=True)
    enaplo_iktatoszam: Mapped[str | None] = mapped_column(String(100), nullable=True)
    mappa_utvonal: Mapped[str | None] = mapped_column(String(500), nullable=True)
    allapot: Mapped[ProjektAllapot] = mapped_column(Enum(ProjektAllapot), default=ProjektAllapot.UJ)
    utemezes_aktiv: Mapped[bool] = mapped_column(Boolean, default=False)
    delivery_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    completion_percent: Mapped[float] = mapped_column(Numeric(5, 1), default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    ugyfel_linkek: Mapped[list["ProjektUgyfel"]] = relationship(
        back_populates="projekt", cascade="all, delete-orphan"
    )
    szerepek: Mapped[list["ProjektSzerep"]] = relationship(
        back_populates="projekt", cascade="all, delete-orphan"
    )
    tetelek: Mapped[list["ProjektTetel"]] = relationship(
        back_populates="projekt", cascade="all, delete-orphan", order_by="ProjektTetel.id"
    )
    dokumentumok: Mapped[list["Dokumentum"]] = relationship(
        back_populates="projekt", cascade="all, delete-orphan"
    )


class ProjektUgyfel(Base):
    """Egy projekthez több ügyfél/cím is tartozhat (felhasználói döntés)."""

    __tablename__ = "projekt_ugyfelek"
    __table_args__ = (UniqueConstraint("projekt_id", "ugyfel_id", name="uq_projekt_ugyfel"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    projekt_id: Mapped[int] = mapped_column(ForeignKey("projektek.id"), index=True)
    ugyfel_id: Mapped[int] = mapped_column(ForeignKey("ugyfelek.id"), index=True)
    epitesi_cim: Mapped[str | None] = mapped_column(String(500), nullable=True)
    szerep: Mapped[str | None] = mapped_column(String(100), nullable=True)

    projekt: Mapped[Projekt] = relationship(back_populates="ugyfel_linkek")
    ugyfel: Mapped[Ugyfel] = relationship(back_populates="projekt_linkek")


class Szemely(Base):
    __tablename__ = "szemelyek"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nev: Mapped[str] = mapped_column(String(255), index=True)
    telefon: Mapped[str | None] = mapped_column(String(50), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    szervezet: Mapped[SzemelySzervezet] = mapped_column(Enum(SzemelySzervezet), default=SzemelySzervezet.BELSO)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ProjektSzerep(Base):
    __tablename__ = "projekt_szerepek"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    projekt_id: Mapped[int] = mapped_column(ForeignKey("projektek.id"), index=True)
    szemely_id: Mapped[int] = mapped_column(ForeignKey("szemelyek.id"), index=True)
    szerep: Mapped[ProjektSzerepTipus] = mapped_column(Enum(ProjektSzerepTipus))

    projekt: Mapped[Projekt] = relationship(back_populates="szerepek")
    szemely: Mapped[Szemely] = relationship()


# ---------------------------------------------------------------------------
# Munkanem törzs / Alvállalkozó / Törzsadat
# ---------------------------------------------------------------------------


class Munkanem(Base):
    __tablename__ = "munkanemek"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    kod: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    nev: Mapped[str] = mapped_column(String(255))
    csoport: Mapped[MunkanemCsoport] = mapped_column(Enum(MunkanemCsoport))
    sorrend: Mapped[int] = mapped_column(Integer, default=0)
    alias: Mapped[str | None] = mapped_column(Text, nullable=True)


class Alvallalkozo(Base):
    __tablename__ = "alvallalkozok"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nev: Mapped[str] = mapped_column(String(255), index=True)
    kapcsolat: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Torzsadat(Base):
    __tablename__ = "torzsadatok"
    __table_args__ = (UniqueConstraint("tipus", "ertek", name="uq_torzsadat_tipus_ertek"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tipus: Mapped[str] = mapped_column(String(100), index=True)
    ertek: Mapped[str] = mapped_column(String(255))


# ---------------------------------------------------------------------------
# Projekt tétel / vállalás / esemény / specifikáció
# ---------------------------------------------------------------------------


class ProjektTetel(Base):
    __tablename__ = "projekt_tetelek"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    projekt_id: Mapped[int] = mapped_column(ForeignKey("projektek.id"), index=True)
    munkanem_id: Mapped[int] = mapped_column(ForeignKey("munkanemek.id"), index=True)
    info: Mapped[str | None] = mapped_column(Text, nullable=True)
    extra_megjegyzes: Mapped[str | None] = mapped_column(Text, nullable=True)
    potmunka: Mapped[bool] = mapped_column(Boolean, default=False)
    potmunka_osszeg: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)
    potmunka_dokumentum_id: Mapped[int | None] = mapped_column(
        ForeignKey("dokumentumok.id"), nullable=True
    )
    tig: Mapped[str | None] = mapped_column(String(100), nullable=True)
    varhato_szoveg: Mapped[str | None] = mapped_column(String(255), nullable=True)
    varhato_datum: Mapped[date | None] = mapped_column(Date, nullable=True)
    szakasz: Mapped[TetelSzakasz] = mapped_column(Enum(TetelSzakasz), default=TetelSzakasz.AJANLAT)
    # Anyagrendelés-támogatás: a teljes beszerzési modul helyett egyszerű
    # "ki, mit, mikorra rendelt" mezők a tételen — a tényleges esemény
    # (megrendelve/megjött) a TetelEsemeny-ben, dátummal.
    beszallito: Mapped[str | None] = mapped_column(String(255), nullable=True)
    rendeles_hatarido: Mapped[date | None] = mapped_column(Date, nullable=True)
    # Ütemezés (opcionális, csak ha a projekt utemezes_aktiv=true): a tétel
    # csak akkor vesz részt a visszafelé ütemezésben, ha duration_days ki van
    # töltve — nincs külön "Activity" entitás, a tétel maga az ütemezhető
    # egység, hogy ne kelljen két párhuzamos munkalistát karbantartani.
    duration_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    prep_days: Mapped[int] = mapped_column(Integer, default=0)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    prep_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    projekt: Mapped[Projekt] = relationship(back_populates="tetelek")
    munkanem: Mapped[Munkanem] = relationship()
    vallalasok: Mapped[list["ProjektTetelVallalas"]] = relationship(
        back_populates="tetel", cascade="all, delete-orphan"
    )
    esemenyek: Mapped[list["TetelEsemeny"]] = relationship(
        back_populates="tetel", cascade="all, delete-orphan", order_by="TetelEsemeny.id"
    )
    specifikaciok: Mapped[list["Specifikacio"]] = relationship(
        back_populates="tetel", cascade="all, delete-orphan"
    )
    fuggosegek: Mapped[list["TetelFuggoseg"]] = relationship(
        back_populates="tetel",
        foreign_keys="TetelFuggoseg.tetel_id",
        cascade="all, delete-orphan",
    )


class ProjektTetelVallalas(Base):
    """Egy tételen több vállaló is lehet (saját cég és/vagy több alvállalkozó)."""

    __tablename__ = "projekt_tetel_vallalasok"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tetel_id: Mapped[int] = mapped_column(ForeignKey("projekt_tetelek.id"), index=True)
    tipus: Mapped[VallalasTipus] = mapped_column(Enum(VallalasTipus))
    alvallalkozo_id: Mapped[int | None] = mapped_column(ForeignKey("alvallalkozok.id"), nullable=True)

    tetel: Mapped[ProjektTetel] = relationship(back_populates="vallalasok")
    alvallalkozo: Mapped[Alvallalkozo | None] = relationship()


class TetelEsemeny(Base):
    __tablename__ = "tetel_esemenyek"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tetel_id: Mapped[int] = mapped_column(ForeignKey("projekt_tetelek.id"), index=True)
    tipus: Mapped[TetelEsemenyTipus] = mapped_column(Enum(TetelEsemenyTipus))
    allapot: Mapped[TetelEsemenyAllapot] = mapped_column(
        Enum(TetelEsemenyAllapot), default=TetelEsemenyAllapot.NYITOTT
    )
    datum: Mapped[date | None] = mapped_column(Date, nullable=True)
    megjegyzes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    tetel: Mapped[ProjektTetel] = relationship(back_populates="esemenyek")


class Specifikacio(Base):
    __tablename__ = "specifikaciok"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tetel_id: Mapped[int] = mapped_column(ForeignKey("projekt_tetelek.id"), index=True)
    csoport: Mapped[str | None] = mapped_column(String(255), nullable=True)
    kulcs: Mapped[str] = mapped_column(String(255))
    ertek: Mapped[str] = mapped_column(String(500))
    mertekegyseg: Mapped[str | None] = mapped_column(String(50), nullable=True)
    megjegyzes: Mapped[str | None] = mapped_column(Text, nullable=True)
    torzs_kod_id: Mapped[int | None] = mapped_column(ForeignKey("torzsadatok.id"), nullable=True)

    tetel: Mapped[ProjektTetel] = relationship(back_populates="specifikaciok")
    torzs_kod: Mapped[Torzsadat | None] = relationship()


class Dokumentum(Base):
    __tablename__ = "dokumentumok"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    projekt_id: Mapped[int] = mapped_column(ForeignKey("projektek.id"), index=True)
    tipus: Mapped[str] = mapped_column(String(100))
    utvonal: Mapped[str] = mapped_column(String(500))
    megjegyzes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    projekt: Mapped[Projekt] = relationship(back_populates="dokumentumok")


class TetelFuggoseg(Base):
    """Ütemezési függőség két tétel között (a tetel_id csak a prerequisite_id
    utáni szabad napon kezdődhet) — az opcionális ütemező "Gantt" nézetének
    szerkesztő funkciója ezt hozza létre/törli."""

    __tablename__ = "tetel_fuggosegek"
    __table_args__ = (UniqueConstraint("tetel_id", "prerequisite_id", name="uq_tetel_prereq"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tetel_id: Mapped[int] = mapped_column(ForeignKey("projekt_tetelek.id", ondelete="CASCADE"), index=True)
    prerequisite_id: Mapped[int] = mapped_column(ForeignKey("projekt_tetelek.id", ondelete="CASCADE"), index=True)

    tetel: Mapped[ProjektTetel] = relationship(back_populates="fuggosegek", foreign_keys=[tetel_id])
    prerequisite: Mapped[ProjektTetel] = relationship(foreign_keys=[prerequisite_id])

    @property
    def prerequisite_nev(self) -> str:
        return self.prerequisite.munkanem.nev
