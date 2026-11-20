from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel

from app.models import VatTipus
from app.models_finance import (
    AlvallalkozoiSzamlaAllapot,
    SzerzodesAllapot,
    TigAllapot,
    UgyfelSzamlaAllapot,
)
from app.schemas_crm import AlvallalkozoResponse, UgyfelResponse

_from_attrs = {"from_attributes": True}


# --- TIG + alvállalkozói számla ---------------------------------------------


class TigCreate(BaseModel):
    alvallalkozo_id: int
    datum: date
    idoszak_kezdet: date
    idoszak_veg: date
    netto: Decimal
    afa_tipus: VatTipus
    megjegyzes: Optional[str] = None


class TigUpdate(BaseModel):
    allapot: Optional[TigAllapot] = None
    megjegyzes: Optional[str] = None


class TigResponse(BaseModel):
    id: int
    projekt_id: int
    alvallalkozo_id: int
    alvallalkozo: AlvallalkozoResponse
    datum: date
    idoszak_kezdet: date
    idoszak_veg: date
    netto: Decimal
    afa_tipus: VatTipus
    afa: Decimal
    brutto: Decimal
    allapot: TigAllapot
    megjegyzes: Optional[str]
    created_at: datetime

    model_config = _from_attrs


class AlvallalkozoiSzamlaCreate(BaseModel):
    alvallalkozo_id: int
    tig_id: Optional[int] = None
    szamlaszam: str
    teljesites_datum: date
    kiallitas_datum: date
    esedekesseg: date
    netto: Decimal
    afa_tipus: VatTipus
    megjegyzes: Optional[str] = None


class AlvallalkozoiSzamlaUpdate(BaseModel):
    allapot: Optional[AlvallalkozoiSzamlaAllapot] = None
    fizetes_datum: Optional[date] = None
    fizetett_osszeg: Optional[Decimal] = None
    megjegyzes: Optional[str] = None


class AlvallalkozoiSzamlaResponse(BaseModel):
    id: int
    projekt_id: int
    alvallalkozo_id: int
    alvallalkozo: AlvallalkozoResponse
    tig_id: Optional[int]
    szamlaszam: str
    teljesites_datum: date
    kiallitas_datum: date
    esedekesseg: date
    fizetes_datum: Optional[date]
    netto: Decimal
    afa_tipus: VatTipus
    afa: Decimal
    brutto: Decimal
    fizetett_osszeg: Optional[Decimal]
    hatralek: Decimal
    allapot: AlvallalkozoiSzamlaAllapot
    megjegyzes: Optional[str]
    created_at: datetime

    model_config = _from_attrs


# --- Szerződés + ütemezett részlet ------------------------------------------


class SzerzodesReszletCreate(BaseModel):
    megnevezes: str
    osszeg: Decimal
    esedekesseg: date


class SzerzodesReszletUpdate(BaseModel):
    megnevezes: Optional[str] = None
    osszeg: Optional[Decimal] = None
    esedekesseg: Optional[date] = None


class SzerzodesReszletResponse(BaseModel):
    id: int
    megnevezes: str
    osszeg: Decimal
    esedekesseg: date
    kiallitott_szamla_id: Optional[int]

    model_config = _from_attrs


class SzerzodesCreate(BaseModel):
    ugyfel_id: int
    szerzodesszam: str
    osszeg: Decimal
    afa_tipus: VatTipus = VatTipus.AFA_27
    kezdes: date
    befejezes: date
    megjegyzes: Optional[str] = None
    reszletek: list[SzerzodesReszletCreate] = []


class SzerzodesUpdate(BaseModel):
    allapot: Optional[SzerzodesAllapot] = None
    megjegyzes: Optional[str] = None


class SzerzodesResponse(BaseModel):
    id: int
    projekt_id: int
    ugyfel_id: int
    ugyfel: UgyfelResponse
    szerzodesszam: str
    osszeg: Decimal
    afa_tipus: VatTipus
    kezdes: date
    befejezes: date
    allapot: SzerzodesAllapot
    megjegyzes: Optional[str]
    created_at: datetime
    reszletek: list[SzerzodesReszletResponse]

    model_config = _from_attrs


class SzerzodesReszletKiallitas(BaseModel):
    """Egy ütemezett részletből tényleges UgyfelSzamla kiállítása — a
    "tervezett" cash-flow réteg tétele innentől a "tényleges" rétegbe kerül."""

    szamlaszam: str
    kiallitas_datum: date
    teljesites_datum: date
    esedekesseg: date


# --- Ügyfél számla -----------------------------------------------------------


class UgyfelSzamlaCreate(BaseModel):
    ugyfel_id: int
    szerzodes_id: Optional[int] = None
    szamlaszam: str
    kiallitas_datum: date
    teljesites_datum: date
    esedekesseg: date
    netto: Decimal
    afa_tipus: VatTipus
    megjegyzes: Optional[str] = None


class UgyfelSzamlaUpdate(BaseModel):
    allapot: Optional[UgyfelSzamlaAllapot] = None
    fizetes_datum: Optional[date] = None
    fizetett_osszeg: Optional[Decimal] = None
    megjegyzes: Optional[str] = None


class UgyfelSzamlaResponse(BaseModel):
    id: int
    projekt_id: int
    ugyfel_id: int
    ugyfel: UgyfelResponse
    szerzodes_id: Optional[int]
    szamlaszam: str
    kiallitas_datum: date
    teljesites_datum: date
    esedekesseg: date
    fizetes_datum: Optional[date]
    netto: Decimal
    afa_tipus: VatTipus
    afa: Decimal
    brutto: Decimal
    fizetett_osszeg: Optional[Decimal]
    hatralek: Decimal
    allapot: UgyfelSzamlaAllapot
    megjegyzes: Optional[str]
    created_at: datetime

    model_config = _from_attrs


# --- Tervezett bérköltség + bankegyenleg -------------------------------------


class TervezettBerkoltsegCreate(BaseModel):
    honap: date
    osszeg: Decimal
    megjegyzes: Optional[str] = None


class TervezettBerkoltsegUpdate(BaseModel):
    osszeg: Optional[Decimal] = None
    megjegyzes: Optional[str] = None


class TervezettBerkoltsegResponse(BaseModel):
    id: int
    honap: date
    osszeg: Decimal
    megjegyzes: Optional[str]

    model_config = _from_attrs


class BankEgyenlegCreate(BaseModel):
    datum: date
    egyenleg: Decimal


class BankEgyenlegResponse(BaseModel):
    id: int
    datum: date
    egyenleg: Decimal
    rogzitette_id: Optional[int]
    created_at: datetime

    model_config = _from_attrs


# --- Gördülő cash-flow --------------------------------------------------------


class CashflowItem(BaseModel):
    """Egy bucketbe eső konkrét tétel — a drill-down (9.3 "egységes cash flow
    input" alak) adja a forrás-azonosítót, hogy a UI vissza tudjon linkelni
    az eredeti számlára/rendelésre."""

    irany: str  # "bevetel" | "kiadas"
    reteg: str  # "teny" | "terv"
    leiras: str
    osszeg: Decimal
    esedekesseg: date
    lejart: bool
    forras_tipus: str  # "ugyfel_szamla" | "alvallalkozoi_szamla" | "anyagrendeles" | "szerzodes_reszlet" | "berkoltseg"
    forras_id: int
    projekt_id: Optional[int]


class CashflowBucket(BaseModel):
    kezdo_datum: date
    vege_datum: date
    nyito: Decimal
    bevetel_teny: Decimal
    bevetel_terv: Decimal
    kiadas_teny: Decimal
    kiadas_terv: Decimal
    netto: Decimal
    zaro: Decimal
    negativ: bool


class CashflowRollingResponse(BaseModel):
    bucket_meret: str  # "het" | "honap"
    horizont: int
    nyito_egyenleg_datuma: Optional[date]
    bucketek: list[CashflowBucket]
