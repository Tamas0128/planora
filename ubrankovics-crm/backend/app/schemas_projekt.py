from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field

from app.models_projekt import AjanlatAllapot, AtvetelAllapot
from app.schemas import UserBrief

# --- Átvétel -------------------------------------------------------------------------------


class AtvetelCreate(BaseModel):
    datum: date
    atado_nev: str = Field(min_length=1)
    atvevo_nev: str = Field(min_length=1)
    hibak: Optional[str] = None
    megjegyzes: Optional[str] = None
    garancia_honap: int = Field(default=24, ge=0, le=240)


class AtvetelUpdate(BaseModel):
    datum: Optional[date] = None
    atado_nev: Optional[str] = None
    atvevo_nev: Optional[str] = None
    hibak: Optional[str] = None
    megjegyzes: Optional[str] = None
    garancia_honap: Optional[int] = Field(default=None, ge=0, le=240)


class AtvetelResponse(BaseModel):
    id: int
    projekt_id: int
    datum: date
    atado_nev: str
    atvevo_nev: str
    hibak: Optional[str]
    megjegyzes: Optional[str]
    garancia_honap: int
    allapot: AtvetelAllapot
    alairva_at: Optional[datetime]
    garancia_lejar: Optional[date]
    garancia_aktiv: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


class GaranciaHiba(BaseModel):
    targy: str = Field(min_length=1)
    leiras: Optional[str] = None


# --- Építési napló ------------------------------------------------------------------------


class NaploFotoResponse(BaseModel):
    id: int
    eredeti_nev: Optional[str]
    meret: Optional[int]

    model_config = {"from_attributes": True}


class NaploCreate(BaseModel):
    datum: date
    idojaras: Optional[str] = None
    letszam: Optional[int] = Field(default=None, ge=0)
    munka: str = Field(min_length=1)
    megjegyzes: Optional[str] = None


class NaploUpdate(BaseModel):
    datum: Optional[date] = None
    idojaras: Optional[str] = None
    letszam: Optional[int] = Field(default=None, ge=0)
    munka: Optional[str] = None
    megjegyzes: Optional[str] = None


class NaploResponse(BaseModel):
    id: int
    projekt_id: int
    datum: date
    idojaras: Optional[str]
    letszam: Optional[int]
    munka: str
    megjegyzes: Optional[str]
    szerzo: Optional[UserBrief]
    fotok: list[NaploFotoResponse]
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Vevői ajánlat ------------------------------------------------------------------------


class AjanlatSorIn(BaseModel):
    megnevezes: str = Field(min_length=1)
    mennyiseg: Decimal = Field(default=Decimal(1), ge=0)
    egyseg: Optional[str] = None
    egysegar: Decimal = Field(default=Decimal(0), ge=0)


class AjanlatSorResponse(AjanlatSorIn):
    id: int
    sorrend: int

    model_config = {"from_attributes": True}


class AjanlatVerzioIn(BaseModel):
    sorok: list[AjanlatSorIn]
    megjegyzes: Optional[str] = None
    ervenyes_ig: Optional[date] = None


class AjanlatCreate(AjanlatVerzioIn):
    cim: str = Field(min_length=1)


class AjanlatAllapotUpdate(BaseModel):
    allapot: AjanlatAllapot


class AjanlatVerzioResponse(BaseModel):
    id: int
    verzio: int
    allapot: AjanlatAllapot
    ervenyes_ig: Optional[date]
    megjegyzes: Optional[str]
    netto_osszeg: Decimal
    created_at: datetime
    sorok: list[AjanlatSorResponse]

    model_config = {"from_attributes": True}


class AjanlatResponse(BaseModel):
    id: int
    projekt_id: int
    cim: str
    created_at: datetime
    verziok: list[AjanlatVerzioResponse]

    model_config = {"from_attributes": True}
