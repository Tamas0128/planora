from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel

from app.models import (
    MunkanemCsoport,
    ProjektAllapot,
    ProjektSzerepTipus,
    SzemelySzervezet,
    TetelEsemenyAllapot,
    TetelEsemenyTipus,
    TetelSzakasz,
    VallalasTipus,
)

_from_attrs = {"from_attributes": True}


# --- Ügyfél ---------------------------------------------------------------


class UgyfelCreate(BaseModel):
    nev: str
    telefon: Optional[str] = None
    email: Optional[str] = None
    owner_id: Optional[int] = None


class UgyfelUpdate(BaseModel):
    nev: Optional[str] = None
    telefon: Optional[str] = None
    email: Optional[str] = None
    owner_id: Optional[int] = None


class UgyfelResponse(BaseModel):
    id: int
    nev: str
    telefon: Optional[str]
    email: Optional[str]
    owner_id: Optional[int]
    created_at: datetime

    model_config = _from_attrs


# --- Személy ---------------------------------------------------------------


class SzemelyCreate(BaseModel):
    nev: str
    telefon: Optional[str] = None
    email: Optional[str] = None
    szervezet: SzemelySzervezet = SzemelySzervezet.BELSO


class SzemelyUpdate(BaseModel):
    nev: Optional[str] = None
    telefon: Optional[str] = None
    email: Optional[str] = None
    szervezet: Optional[SzemelySzervezet] = None


class SzemelyResponse(BaseModel):
    id: int
    nev: str
    telefon: Optional[str]
    email: Optional[str]
    szervezet: SzemelySzervezet

    model_config = _from_attrs


# --- Alvállalkozó -----------------------------------------------------------


class AlvallalkozoCreate(BaseModel):
    nev: str
    kapcsolat: Optional[str] = None


class AlvallalkozoUpdate(BaseModel):
    nev: Optional[str] = None
    kapcsolat: Optional[str] = None


class AlvallalkozoResponse(BaseModel):
    id: int
    nev: str
    kapcsolat: Optional[str]

    model_config = _from_attrs


# --- Munkanem ----------------------------------------------------------------


class MunkanemCreate(BaseModel):
    kod: str
    nev: str
    csoport: MunkanemCsoport
    sorrend: int = 0
    alias: Optional[str] = None


class MunkanemUpdate(BaseModel):
    nev: Optional[str] = None
    csoport: Optional[MunkanemCsoport] = None
    sorrend: Optional[int] = None
    alias: Optional[str] = None


class MunkanemResponse(BaseModel):
    id: int
    kod: str
    nev: str
    csoport: MunkanemCsoport
    sorrend: int
    alias: Optional[str]

    model_config = _from_attrs


# --- Törzsadat ----------------------------------------------------------------


class TorzsadatCreate(BaseModel):
    tipus: str
    ertek: str


class TorzsadatResponse(BaseModel):
    id: int
    tipus: str
    ertek: str

    model_config = _from_attrs


# --- Projekt ügyfél-link ------------------------------------------------------


class ProjektUgyfelCreate(BaseModel):
    ugyfel_id: int
    epitesi_cim: Optional[str] = None
    szerep: Optional[str] = None


class ProjektUgyfelResponse(BaseModel):
    id: int
    ugyfel_id: int
    epitesi_cim: Optional[str]
    szerep: Optional[str]
    ugyfel: UgyfelResponse

    model_config = _from_attrs


# --- Projekt szerep ------------------------------------------------------------


class ProjektSzerepCreate(BaseModel):
    szemely_id: int
    szerep: ProjektSzerepTipus


class ProjektSzerepResponse(BaseModel):
    id: int
    szemely_id: int
    szerep: ProjektSzerepTipus
    szemely: SzemelyResponse

    model_config = _from_attrs


# --- Projekt -------------------------------------------------------------------


class ProjektCreate(BaseModel):
    projekt_nev: str
    hrsz: Optional[str] = None
    enaplo_iktatoszam: Optional[str] = None
    mappa_utvonal: Optional[str] = None
    allapot: ProjektAllapot = ProjektAllapot.UJ
    utemezes_aktiv: bool = False
    delivery_date: Optional[date] = None
    ugyfelek: list[ProjektUgyfelCreate] = []


class ProjektUpdate(BaseModel):
    projekt_nev: Optional[str] = None
    hrsz: Optional[str] = None
    enaplo_iktatoszam: Optional[str] = None
    mappa_utvonal: Optional[str] = None
    allapot: Optional[ProjektAllapot] = None
    utemezes_aktiv: Optional[bool] = None
    delivery_date: Optional[date] = None


class ProjektListItem(BaseModel):
    id: int
    projekt_nev: str
    allapot: ProjektAllapot
    utemezes_aktiv: bool
    created_at: datetime

    model_config = _from_attrs


class ProjektDetail(BaseModel):
    id: int
    projekt_nev: str
    hrsz: Optional[str]
    enaplo_iktatoszam: Optional[str]
    mappa_utvonal: Optional[str]
    allapot: ProjektAllapot
    utemezes_aktiv: bool
    delivery_date: Optional[date]
    created_at: datetime
    ugyfel_linkek: list[ProjektUgyfelResponse]
    szerepek: list[ProjektSzerepResponse]

    model_config = _from_attrs


# --- Tétel vállalás --------------------------------------------------------------


class VallalasCreate(BaseModel):
    tipus: VallalasTipus
    alvallalkozo_id: Optional[int] = None


class VallalasResponse(BaseModel):
    id: int
    tipus: VallalasTipus
    alvallalkozo_id: Optional[int]
    alvallalkozo: Optional[AlvallalkozoResponse]

    model_config = _from_attrs


# --- Tétel esemény ------------------------------------------------------------------


class TetelEsemenyCreate(BaseModel):
    tipus: TetelEsemenyTipus
    allapot: TetelEsemenyAllapot = TetelEsemenyAllapot.NYITOTT
    datum: Optional[date] = None
    megjegyzes: Optional[str] = None


class TetelEsemenyUpdate(BaseModel):
    allapot: Optional[TetelEsemenyAllapot] = None
    datum: Optional[date] = None
    megjegyzes: Optional[str] = None


class TetelEsemenyResponse(BaseModel):
    id: int
    tipus: TetelEsemenyTipus
    allapot: TetelEsemenyAllapot
    datum: Optional[date]
    megjegyzes: Optional[str]
    created_at: datetime

    model_config = _from_attrs


# --- Specifikáció -----------------------------------------------------------------


class SpecifikacioCreate(BaseModel):
    csoport: Optional[str] = None
    kulcs: str
    ertek: str
    mertekegyseg: Optional[str] = None
    megjegyzes: Optional[str] = None
    torzs_kod_id: Optional[int] = None


class SpecifikacioResponse(BaseModel):
    id: int
    csoport: Optional[str]
    kulcs: str
    ertek: str
    mertekegyseg: Optional[str]
    megjegyzes: Optional[str]
    torzs_kod_id: Optional[int]

    model_config = _from_attrs


# --- Projekt tétel ------------------------------------------------------------------


class ProjektTetelCreate(BaseModel):
    munkanem_id: int
    info: Optional[str] = None
    extra_megjegyzes: Optional[str] = None
    potmunka: bool = False
    potmunka_osszeg: Optional[Decimal] = None
    tig: Optional[str] = None
    varhato_szoveg: Optional[str] = None
    varhato_datum: Optional[date] = None
    szakasz: TetelSzakasz = TetelSzakasz.AJANLAT
    beszallito: Optional[str] = None
    rendeles_hatarido: Optional[date] = None
    vallalasok: list[VallalasCreate] = []


class ProjektTetelUpdate(BaseModel):
    info: Optional[str] = None
    extra_megjegyzes: Optional[str] = None
    potmunka: Optional[bool] = None
    potmunka_osszeg: Optional[Decimal] = None
    tig: Optional[str] = None
    varhato_szoveg: Optional[str] = None
    varhato_datum: Optional[date] = None
    szakasz: Optional[TetelSzakasz] = None
    beszallito: Optional[str] = None
    rendeles_hatarido: Optional[date] = None


class ProjektTetelResponse(BaseModel):
    id: int
    munkanem_id: int
    munkanem: MunkanemResponse
    info: Optional[str]
    extra_megjegyzes: Optional[str]
    potmunka: bool
    potmunka_osszeg: Optional[Decimal]
    tig: Optional[str]
    varhato_szoveg: Optional[str]
    varhato_datum: Optional[date]
    szakasz: TetelSzakasz
    beszallito: Optional[str]
    rendeles_hatarido: Optional[date]
    vallalasok: list[VallalasResponse]
    esemenyek: list[TetelEsemenyResponse]
    specifikaciok: list[SpecifikacioResponse]

    model_config = _from_attrs


# --- Dokumentum -----------------------------------------------------------------------


class DokumentumCreate(BaseModel):
    tipus: str
    utvonal: str
    megjegyzes: Optional[str] = None


class DokumentumResponse(BaseModel):
    id: int
    tipus: str
    utvonal: str
    megjegyzes: Optional[str]
    created_at: datetime

    model_config = _from_attrs
