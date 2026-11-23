from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, EmailStr

from app.models import (
    AjanlatkeresAllapot,
    ErdeklodesAllapot,
    KommunikacioTipus,
    DokumentumSablonTipus,
    MunkanemCsoport,
    ProjektAllapot,
    ProjektSzerepTipus,
    RendelesAllapot,
    SzamlaAllapot,
    SzemelySzervezet,
    TetelEsemenyAllapot,
    TetelEsemenyTipus,
    TetelSzakasz,
    VallalasTipus,
    VatTipus,
)
from app.schemas import UserBrief

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


class SzemelyProjektSzerepResponse(BaseModel):
    """Egy projekt, amin a személy szerepet tölt be — a személy kártya
    szekciójához."""

    projekt_id: int
    projekt_nev: str
    szerep: ProjektSzerepTipus


class SzemelyTetelResponse(BaseModel):
    """Egy tétel, amire a személy ki van jelölve."""

    tetel_id: int
    munkanem_nev: str
    projekt_id: int
    projekt_nev: str
    szakasz: TetelSzakasz


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


class AlvallalkozoTetelResponse(BaseModel):
    """Egy tétel, amin az alvállalkozó vállalásban szerepel — az
    alvállalkozó kártya "hol dolgozik" szekciójához."""

    vallalas_id: int
    tetel_id: int
    munkanem_nev: str
    projekt_id: int
    projekt_nev: str
    szakasz: TetelSzakasz


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


class UgyfelProjektLinkResponse(BaseModel):
    """Egy ügyfél kártyáján megjelenő, kapcsolódó projekt — a fordított
    irány a ProjektUgyfelResponse-hoz képest (ott a projekt oldaláról,
    itt az ügyfél oldaláról nézzük ugyanazt a projekt_ugyfelek sort)."""

    id: int
    projekt_id: int
    projekt_nev: str
    allapot: ProjektAllapot
    epitesi_cim: Optional[str]
    szerep: Optional[str]

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
    projekt_tipus_id: Optional[int] = None
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
    completion_percent: Decimal
    projekt_tipus_id: Optional[int]
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
    felelos_szerep: Optional[ProjektSzerepTipus] = None
    kijelolt_id: Optional[int] = None
    info: Optional[str] = None
    extra_megjegyzes: Optional[str] = None
    potmunka: bool = False
    potmunka_osszeg: Optional[Decimal] = None
    tig: Optional[str] = None
    varhato_szoveg: Optional[str] = None
    varhato_datum: Optional[date] = None
    szakasz: TetelSzakasz = TetelSzakasz.AJANLAT
    duration_days: Optional[int] = None
    prep_days: int = 0
    vallalasok: list[VallalasCreate] = []


class ProjektTetelUpdate(BaseModel):
    sorrend: Optional[int] = None
    felelos_szerep: Optional[ProjektSzerepTipus] = None
    kijelolt_id: Optional[int] = None
    info: Optional[str] = None
    extra_megjegyzes: Optional[str] = None
    potmunka: Optional[bool] = None
    potmunka_osszeg: Optional[Decimal] = None
    tig: Optional[str] = None
    varhato_szoveg: Optional[str] = None
    varhato_datum: Optional[date] = None
    szakasz: Optional[TetelSzakasz] = None
    duration_days: Optional[int] = None
    prep_days: Optional[int] = None
    tenyleges_kezdes: Optional[date] = None
    tenyleges_befejezes: Optional[date] = None


class TetelFuggosegCreate(BaseModel):
    prerequisite_id: int


class TetelFuggosegResponse(BaseModel):
    id: int
    prerequisite_id: int
    prerequisite_nev: str

    model_config = _from_attrs


class BeszallitoiAjanlatCreate(BaseModel):
    netto: Decimal
    afa_tipus: VatTipus
    ervenyesseg_datum: Optional[date] = None
    szallitasi_ido_nap: Optional[int] = None
    megjegyzes: Optional[str] = None


class BeszallitoiAjanlatResponse(BaseModel):
    id: int
    netto: Decimal
    afa_tipus: VatTipus
    afa: Decimal
    brutto: Decimal
    ervenyesseg_datum: Optional[date]
    szallitasi_ido_nap: Optional[int]
    megjegyzes: Optional[str]

    model_config = _from_attrs


class AjanlatkeresCreate(BaseModel):
    cimzett_nev: str
    cimzett_email: Optional[EmailStr] = None
    alvallalkozo_id: Optional[int] = None
    kuldes_datum: Optional[date] = None
    hatarido: Optional[date] = None


class AjanlatkeresUpdate(BaseModel):
    allapot: Optional[AjanlatkeresAllapot] = None
    hatarido: Optional[date] = None


class AjanlatkeresResponse(BaseModel):
    id: int
    cimzett_nev: str
    cimzett_email: Optional[str]
    alvallalkozo_id: Optional[int]
    kuldes_datum: Optional[date]
    hatarido: Optional[date]
    allapot: AjanlatkeresAllapot
    ajanlatok: list[BeszallitoiAjanlatResponse]

    model_config = _from_attrs


class AnyagRendelesCreate(BaseModel):
    megnevezes: str
    mennyiseg: Optional[Decimal] = None
    mertekegyseg: Optional[str] = None
    szukseges_datum: Optional[date] = None
    felelos_id: Optional[int] = None
    megjegyzes: Optional[str] = None


class AnyagRendelesUpdate(BaseModel):
    megnevezes: Optional[str] = None
    mennyiseg: Optional[Decimal] = None
    mertekegyseg: Optional[str] = None
    szukseges_datum: Optional[date] = None
    felelos_id: Optional[int] = None
    beszallito: Optional[str] = None
    allapot: Optional[RendelesAllapot] = None
    megrendeles_datum: Optional[date] = None
    visszaigazolt_datum: Optional[date] = None
    tenyleges_erkezes: Optional[date] = None
    atvett_mennyiseg: Optional[Decimal] = None
    eltere_megjegyzes: Optional[str] = None
    po_szam: Optional[str] = None
    jovahagyva: Optional[bool] = None
    jovahagyas_datum: Optional[date] = None
    szamla_szam: Optional[str] = None
    szamla_allapot: Optional[SzamlaAllapot] = None
    szamla_osszeg: Optional[Decimal] = None
    szamla_fizetesi_hatarido: Optional[date] = None
    szamla_fizetes_datum: Optional[date] = None
    megjegyzes: Optional[str] = None


class UgyfelArUpdate(BaseModel):
    ugyfel_netto: Decimal
    ugyfel_afa_tipus: VatTipus


class AjanlatValasztas(BaseModel):
    ajanlat_id: int


class AnyagRendelesResponse(BaseModel):
    id: int
    megnevezes: str
    mennyiseg: Optional[Decimal]
    mertekegyseg: Optional[str]
    felelos_id: Optional[int]
    szukseges_datum: Optional[date]
    allapot: RendelesAllapot
    beszallito: Optional[str]
    kivalasztott_ajanlat_id: Optional[int]
    beszerzesi_brutto: Optional[Decimal]
    megrendeles_datum: Optional[date]
    visszaigazolt_datum: Optional[date]
    tenyleges_erkezes: Optional[date]
    atvett_mennyiseg: Optional[Decimal]
    eltere_megjegyzes: Optional[str]
    po_szam: Optional[str]
    jovahagyva: bool
    jovahagyas_datum: Optional[date]
    szamla_szam: Optional[str]
    szamla_allapot: SzamlaAllapot
    szamla_osszeg: Optional[Decimal]
    szamla_fizetesi_hatarido: Optional[date]
    szamla_fizetes_datum: Optional[date]
    ugyfel_netto: Optional[Decimal]
    ugyfel_afa_tipus: Optional[VatTipus]
    ugyfel_afa: Optional[Decimal]
    ugyfel_brutto: Optional[Decimal]
    megjegyzes: Optional[str]
    ajanlatkeresek: list[AjanlatkeresResponse]

    model_config = _from_attrs


class ProjektTetelResponse(BaseModel):
    id: int
    munkanem_id: int
    munkanem: MunkanemResponse
    sorrend: int
    felelos_szerep: Optional[ProjektSzerepTipus]
    kijelolt_id: Optional[int]
    kijelolt: Optional[SzemelyResponse]
    info: Optional[str]
    extra_megjegyzes: Optional[str]
    potmunka: bool
    potmunka_osszeg: Optional[Decimal]
    tig: Optional[str]
    varhato_szoveg: Optional[str]
    varhato_datum: Optional[date]
    szakasz: TetelSzakasz
    duration_days: Optional[int]
    prep_days: int
    start_date: Optional[date]
    end_date: Optional[date]
    prep_date: Optional[date]
    terv_kezdes: Optional[date]
    terv_befejezes: Optional[date]
    tenyleges_kezdes: Optional[date]
    tenyleges_befejezes: Optional[date]
    vallalasok: list[VallalasResponse]
    esemenyek: list[TetelEsemenyResponse]
    specifikaciok: list[SpecifikacioResponse]
    fuggosegek: list[TetelFuggosegResponse]
    rendelesek: list[AnyagRendelesResponse]

    model_config = _from_attrs


# --- Dokumentum -----------------------------------------------------------------------


class DokumentumResponse(BaseModel):
    id: int
    tipus: str
    eredeti_nev: Optional[str]
    tartalom_tipus: Optional[str]
    meret: Optional[int]
    feltoltotte_id: Optional[int]
    megjegyzes: Optional[str]
    created_at: datetime

    model_config = _from_attrs


# --- Projekttípus-sablon (fázis/lépés checklist) --------------------------------------


class ProjektTipusLepesResponse(BaseModel):
    id: int
    nev: str
    sorrend: int
    merfoldko: bool

    model_config = _from_attrs


class ProjektTipusFazisResponse(BaseModel):
    id: int
    nev: str
    sorrend: int
    lepesek: list[ProjektTipusLepesResponse]

    model_config = _from_attrs


class ProjektTipusResponse(BaseModel):
    id: int
    nev: str
    fazisok: list[ProjektTipusFazisResponse]

    model_config = _from_attrs


# --- Projekt fázis / lépés (a sablonból másolt, önállóan szerkeszthető példány) --------


class ProjektLepesCreate(BaseModel):
    nev: str
    merfoldko: bool = False


class ProjektLepesUpdate(BaseModel):
    nev: Optional[str] = None
    kesz: Optional[bool] = None
    datum: Optional[date] = None


class ProjektLepesResponse(BaseModel):
    id: int
    nev: str
    sorrend: int
    merfoldko: bool
    kesz: bool
    datum: Optional[date]

    model_config = _from_attrs


class ProjektFazisCreate(BaseModel):
    nev: str


class ProjektFazisResponse(BaseModel):
    id: int
    nev: str
    sorrend: int
    lepesek: list[ProjektLepesResponse]

    model_config = _from_attrs


# --- Dokumentum-sablon előnézet / e-mail küldés ----------------------------------------


class SablonElonezetRequest(BaseModel):
    tipus: DokumentumSablonTipus
    tetel_ids: list[int]
    uzenet: Optional[str] = None


class SablonElonezetResponse(BaseModel):
    targy: str
    html: str


class EmailKuldesCreate(BaseModel):
    tipus: DokumentumSablonTipus
    tetel_ids: list[int]
    cimzett: EmailStr
    targy: Optional[str] = None
    uzenet: Optional[str] = None


class KikuldottEmailResponse(BaseModel):
    id: int
    tipus: DokumentumSablonTipus
    cimzett: str
    targy: str
    tetel_ids: Optional[str]
    uzenet: Optional[str]
    elkuldve_at: datetime

    model_config = _from_attrs


# --- Feladat -------------------------------------------------------------------


class FeladatCreate(BaseModel):
    cim: str
    leiras: Optional[str] = None
    hatarido: Optional[date] = None
    felelos_id: Optional[int] = None
    projekt_id: Optional[int] = None


class FeladatUpdate(BaseModel):
    cim: Optional[str] = None
    leiras: Optional[str] = None
    hatarido: Optional[date] = None
    felelos_id: Optional[int] = None
    projekt_id: Optional[int] = None
    kesz: Optional[bool] = None


class FeladatResponse(BaseModel):
    id: int
    cim: str
    leiras: Optional[str]
    hatarido: Optional[date]
    felelos_id: Optional[int]
    felelos: Optional[UserBrief]
    projekt_id: Optional[int]
    projekt_nev: Optional[str] = None
    letrehozo_id: int
    kesz: bool
    created_at: datetime

    model_config = _from_attrs


# --- Riportok ------------------------------------------------------------------


class SzakaszMegoszlasItem(BaseModel):
    """Egy szakasz (ajánlat→szerződés→beszerzés→kivitelezés→kész) tétel-
    száma és az ügyfélnek kiajánlott érték összesen — az "értékesítési
    állapot" riport soronkénti bontása."""

    szakasz: TetelSzakasz
    tetel_szam: int
    ertek_osszesen: Decimal


class LejartSzamlaItem(BaseModel):
    forras_tipus: str  # "ugyfel_szamla" | "alvallalkozoi_szamla"
    forras_id: int
    projekt_id: int
    projekt_nev: str
    partner_nev: str
    szamlaszam: str
    esedekesseg: date
    hatralek: Decimal


class PenzugyiOsszesito(BaseModel):
    lejart_szamlak: list[LejartSzamlaItem]
    lejart_bevetel_osszesen: Decimal
    lejart_kiadas_osszesen: Decimal
    legutobbi_bankegyenleg_datuma: Optional[date]
    legutobbi_bankegyenleg: Optional[Decimal]


# --- Bankkivonat import ----------------------------------------------------------


class BankkivonatJavaslat(BaseModel):
    forras_tipus: str  # "ugyfel_szamla" | "alvallalkozoi_szamla"
    forras_id: int
    projekt_id: int
    projekt_nev: str
    partner_nev: str
    szamlaszam: str
    hatralek: Decimal
    biztos: bool


class BankkivonatSor(BaseModel):
    sor: int
    datum: date
    osszeg: Decimal
    irany: str  # "bevetel" | "kiadas"
    kozlemeny: str
    javaslat: Optional[BankkivonatJavaslat] = None
    alternativak: list[BankkivonatJavaslat] = []


class BankkivonatElemzesValasz(BaseModel):
    sorok: list[BankkivonatSor]
    sorok_szama: int
    egyeztetett_szama: int


class BankkivonatJovahagyottTetel(BaseModel):
    forras_tipus: str
    forras_id: int
    datum: date
    osszeg: Decimal


class BankkivonatJovahagyasValasz(BaseModel):
    feldolgozott_szama: int
    erintett_projektek: list[int]


# --- Érdeklődő (lead) + pipeline -----------------------------------------------


class ErdeklodesCreate(BaseModel):
    nev: str
    telefon: Optional[str] = None
    email: Optional[str] = None
    forras: Optional[str] = None
    allapot: ErdeklodesAllapot = ErdeklodesAllapot.UJ
    becsult_ertek: Optional[Decimal] = None
    megjegyzes: Optional[str] = None
    owner_id: Optional[int] = None


class ErdeklodesUpdate(BaseModel):
    nev: Optional[str] = None
    telefon: Optional[str] = None
    email: Optional[str] = None
    forras: Optional[str] = None
    allapot: Optional[ErdeklodesAllapot] = None
    becsult_ertek: Optional[Decimal] = None
    megjegyzes: Optional[str] = None
    owner_id: Optional[int] = None


class ErdeklodesResponse(BaseModel):
    id: int
    nev: str
    telefon: Optional[str]
    email: Optional[str]
    forras: Optional[str]
    allapot: ErdeklodesAllapot
    becsult_ertek: Optional[Decimal]
    megjegyzes: Optional[str]
    owner_id: Optional[int]
    owner: Optional[UserBrief]
    ugyfel_id: Optional[int]
    created_at: datetime

    model_config = _from_attrs


class PipelineSzakasz(BaseModel):
    allapot: ErdeklodesAllapot
    darab: int
    ertek_osszesen: Decimal


# --- Kommunikációs napló ---------------------------------------------------------


class KommunikacioCreate(BaseModel):
    ugyfel_id: Optional[int] = None
    erdeklodes_id: Optional[int] = None
    tipus: KommunikacioTipus
    tartalom: str
    datum: Optional[datetime] = None


class KommunikacioResponse(BaseModel):
    id: int
    ugyfel_id: Optional[int]
    erdeklodes_id: Optional[int]
    tipus: KommunikacioTipus
    datum: datetime
    tartalom: str
    user: Optional[UserBrief]

    model_config = _from_attrs


# --- Értesítések -------------------------------------------------------------------


class ErtesitesItem(BaseModel):
    tipus: str  # "feladat" | "szamla"
    szint: str  # "lejart" | "kozeli"
    cim: str
    reszlet: Optional[str] = None
    datum: Optional[date] = None
    link: str


# --- Import / egyesítés ---------------------------------------------------------------


class UgyfelImportValasz(BaseModel):
    letrehozva: int
    kihagyva_duplikatum: int
    hibas_sorok: list[str]


class UgyfelDuplikatumCsoport(BaseModel):
    ok: str  # "azonos nev" | "azonos email"
    ugyfelek: list[UgyfelResponse]


class UgyfelEgyesitesRequest(BaseModel):
    forras_id: int
