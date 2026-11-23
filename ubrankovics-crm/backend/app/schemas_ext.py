from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel

from app.models_ext import JegyAllapot, JegyPrioritas
from app.schemas import UserBrief

_from_attrs = {"from_attributes": True}


# --- Auditnapló ----------------------------------------------------------------


class AuditResponse(BaseModel):
    id: int
    user: Optional[UserBrief]
    entitas: str
    entitas_id: Optional[int]
    muvelet: str
    reszletek: Optional[str]
    created_at: datetime

    model_config = _from_attrs


# --- Egyedi mezők -----------------------------------------------------------------


class EgyediMezoCreate(BaseModel):
    entitas: str  # "ugyfel" | "erdeklodes"
    nev: str
    tipus: str = "szoveg"  # szoveg | szam | datum


class EgyediMezoResponse(BaseModel):
    id: int
    entitas: str
    nev: str
    tipus: str
    sorrend: int

    model_config = _from_attrs


class EgyediMezoErtekItem(BaseModel):
    mezo_id: int
    nev: str
    tipus: str
    ertek: Optional[str] = None


class EgyediMezoErtekPut(BaseModel):
    entitas: str
    entitas_id: int
    ertekek: dict[int, Optional[str]]  # mezo_id -> érték (üres/None = törlés)


# --- Címkék / kampányok ---------------------------------------------------------------


class CimkeCreate(BaseModel):
    nev: str


class CimkeResponse(BaseModel):
    id: int
    nev: str
    ugyfel_szam: int = 0


class UgyfelCimkePut(BaseModel):
    cimke_ids: list[int]


class KampanyCreate(BaseModel):
    nev: str
    targy: str
    uzenet: str
    cimke_id: Optional[int] = None


class KampanyResponse(BaseModel):
    id: int
    nev: str
    targy: str
    uzenet: str
    cimke_id: Optional[int]
    cimke_nev: Optional[str] = None
    cimzettek_szama: int
    elkuldve_szama: int
    created_at: datetime


# --- Jegyek ----------------------------------------------------------------------------


class JegyCreate(BaseModel):
    ugyfel_id: int
    projekt_id: Optional[int] = None
    targy: str
    leiras: Optional[str] = None
    prioritas: JegyPrioritas = JegyPrioritas.NORMAL
    felelos_id: Optional[int] = None


class JegyUpdate(BaseModel):
    targy: Optional[str] = None
    leiras: Optional[str] = None
    allapot: Optional[JegyAllapot] = None
    prioritas: Optional[JegyPrioritas] = None
    felelos_id: Optional[int] = None


class JegyResponse(BaseModel):
    id: int
    ugyfel_id: int
    ugyfel_nev: Optional[str] = None
    projekt_id: Optional[int]
    targy: str
    leiras: Optional[str]
    allapot: JegyAllapot
    prioritas: JegyPrioritas
    felelos_id: Optional[int]
    felelos: Optional[UserBrief]
    created_at: datetime
    lezarva_at: Optional[datetime]


# --- Előrejelzés ---------------------------------------------------------------------------


class ElorejelzesHonap(BaseModel):
    honap: str  # "YYYY-MM"
    nyitott_osszeg: Decimal
    sulyozott_osszeg: Decimal
    nyert_osszeg: Decimal
    cel: Optional[Decimal]


class TeljesitmenyItem(BaseModel):
    felelos: Optional[str]
    nyert_db: int
    nyert_osszeg: Decimal
    nyitott_sulyozott: Decimal


class ElorejelzesValasz(BaseModel):
    honapok: list[ElorejelzesHonap]
    datum_nelkul_sulyozott: Decimal  # nincs várható lezárás vagy már elmúlt hónap
    sulyozott_osszesen: Decimal
    teljesitmeny: list[TeljesitmenyItem]
    valoszinusegek: dict[str, int]  # szakasz -> % súly


class CelPut(BaseModel):
    honap: str
    osszeg: Decimal
