"""Bankkivonat (xlsx) feldolgozás: oszlop-felismerés, sor-kiolvasás és
automatikus projekt/számla-egyeztetés. A tényleges jóváírás/terhelés
(fizetés rögzítése a megfelelő Ugyfel/AlvallalkozoiSzamla sorokon) külön,
a felhasználó kézi jóváhagyása utáni lépés — ez a modul csak elemez és
javasol, nem ír adatbázist."""

import io
import re
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from openpyxl import load_workbook
from sqlalchemy.orm import Session, joinedload

from app.models_finance import AlvallalkozoiSzamla, UgyfelSzamla

_DATE_HEADER_HINTS = ["dátum", "datum", "könyvelés", "konyveles", "értéknap", "ertéknap"]
_CREDIT_HEADER_HINTS = ["jóváírás", "jovairas", "credit"]
_DEBIT_HEADER_HINTS = ["terhelés", "terheles", "debit"]
_AMOUNT_HEADER_HINTS = ["összeg", "osszeg", "amount"]
_MEMO_HEADER_HINTS = ["közlemény", "kozlemeny", "megjegyzés", "megjegyzes", "partner", "ellenoldali", "név", "nev"]

_MAX_HEADER_SCAN_ROWS = 10


@dataclass
class ParsedRow:
    sor: int
    datum: date
    osszeg: Decimal  # előjeles: pozitív = bevétel (jóváírás), negatív = kiadás (terhelés)
    kozlemeny: str


class BankkivonatParseError(Exception):
    pass


def _norm(s: str) -> str:
    return (s or "").strip().lower()


def _parse_osszeg(value) -> Decimal | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return Decimal(str(value))
    text = str(value).strip()
    if not text:
        return None
    # Magyar formátum: "1 234 567,89" vagy "1.234.567,89" -> "1234567.89"
    text = text.replace("\xa0", " ").replace(" ", "")
    if "," in text:
        text = text.replace(".", "").replace(",", ".")
    try:
        return Decimal(text)
    except InvalidOperation:
        return None


_DATE_FORMATS = ["%Y.%m.%d.", "%Y.%m.%d", "%Y-%m-%d", "%Y/%m/%d", "%d.%m.%Y", "%Y%m%d"]


def _parse_datum(value) -> date | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = str(value).strip()
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def _find_header_row(rows: list[tuple]) -> tuple[int, dict[str, int]] | None:
    """Megkeresi az első sort, ami fejlécnek tűnik (van benne dátum- és
    összeg-jellegű oszlop), és visszaadja az oszlop-indexeket."""
    for ri, row in enumerate(rows[:_MAX_HEADER_SCAN_ROWS]):
        cols: dict[str, int] = {}
        for ci, cell in enumerate(row):
            if cell is None:
                continue
            label = _norm(str(cell))
            if "datum_col" not in cols and any(h in label for h in _DATE_HEADER_HINTS):
                cols["datum_col"] = ci
            if "credit_col" not in cols and any(h in label for h in _CREDIT_HEADER_HINTS):
                cols["credit_col"] = ci
            if "debit_col" not in cols and any(h in label for h in _DEBIT_HEADER_HINTS):
                cols["debit_col"] = ci
            if "amount_col" not in cols and any(h in label for h in _AMOUNT_HEADER_HINTS):
                cols["amount_col"] = ci
            if "memo_col" not in cols and any(h in label for h in _MEMO_HEADER_HINTS):
                cols["memo_col"] = ci
        has_amount = "amount_col" in cols or ("credit_col" in cols and "debit_col" in cols) or "credit_col" in cols or "debit_col" in cols
        if "datum_col" in cols and has_amount:
            return ri, cols
    return None


def parse_bankkivonat(content: bytes) -> list[ParsedRow]:
    try:
        wb = load_workbook(io.BytesIO(content), data_only=True, read_only=True)
    except Exception as exc:  # noqa: BLE001 — openpyxl rosszul formázott fájlra sokféle kivételt dobhat
        raise BankkivonatParseError(f"Nem sikerült megnyitni az xlsx fájlt: {exc}") from exc

    sheet = wb.active
    rows = [tuple(row) for row in sheet.iter_rows(values_only=True)]
    if not rows:
        raise BankkivonatParseError("A fájl üres.")

    found = _find_header_row(rows)
    if not found:
        raise BankkivonatParseError(
            "Nem találtam felismerhető fejlécet (dátum + összeg oszlopot) az első "
            f"{_MAX_HEADER_SCAN_ROWS} sorban. Elvárt oszlopnevek pl.: „Könyvelés dátuma”, "
            "„Összeg” (vagy „Jóváírás”/„Terhelés” külön), „Közlemény”."
        )
    header_idx, cols = found

    parsed: list[ParsedRow] = []
    for ri, row in enumerate(rows[header_idx + 1 :], start=header_idx + 2):
        datum = _parse_datum(row[cols["datum_col"]]) if cols["datum_col"] < len(row) else None
        if datum is None:
            continue

        osszeg: Decimal | None = None
        if "amount_col" in cols and cols["amount_col"] < len(row):
            osszeg = _parse_osszeg(row[cols["amount_col"]])
        else:
            credit = _parse_osszeg(row[cols["credit_col"]]) if "credit_col" in cols and cols["credit_col"] < len(row) else None
            debit = _parse_osszeg(row[cols["debit_col"]]) if "debit_col" in cols and cols["debit_col"] < len(row) else None
            if credit or debit:
                osszeg = (credit or Decimal(0)) - abs(debit or Decimal(0))
        if osszeg is None or osszeg == 0:
            continue

        kozlemeny = ""
        if "memo_col" in cols and cols["memo_col"] < len(row) and row[cols["memo_col"]] is not None:
            kozlemeny = str(row[cols["memo_col"]])

        parsed.append(ParsedRow(sor=ri, datum=datum, osszeg=osszeg, kozlemeny=kozlemeny))

    if not parsed:
        raise BankkivonatParseError("A fejléc után nem találtam feldolgozható (dátum+összeg) sort.")
    return parsed


@dataclass
class MatchResult:
    forras_tipus: str  # "ugyfel_szamla" | "alvallalkozoi_szamla"
    forras_id: int
    projekt_id: int
    projekt_nev: str
    partner_nev: str
    szamlaszam: str
    hatralek: Decimal
    biztos: bool  # True = számlaszám alapján, False = csak partnernév alapján


def find_match(db: Session, irany: str, kozlemeny: str) -> tuple[MatchResult | None, list[MatchResult]]:
    """Visszaadja a legjobb találatot (vagy None-t), plusz az összes további
    lehetséges jelöltet (ha a partnernév több nyitott számlára is illik)."""
    text = _norm(kozlemeny)
    if not text:
        return None, []

    if irany == "bevetel":
        nyitott = (
            db.query(UgyfelSzamla)
            .options(joinedload(UgyfelSzamla.ugyfel), joinedload(UgyfelSzamla.projekt))
            .filter(UgyfelSzamla.fizetes_datum.is_(None))
            .all()
        )

        def to_result(sz: UgyfelSzamla) -> MatchResult:
            return MatchResult(
                forras_tipus="ugyfel_szamla",
                forras_id=sz.id,
                projekt_id=sz.projekt_id,
                projekt_nev=sz.projekt.projekt_nev,
                partner_nev=sz.ugyfel.nev,
                szamlaszam=sz.szamlaszam,
                hatralek=sz.hatralek,
                biztos=True,
            )

        def partner_nev(sz: UgyfelSzamla) -> str:
            return sz.ugyfel.nev
    else:
        nyitott = (
            db.query(AlvallalkozoiSzamla)
            .options(joinedload(AlvallalkozoiSzamla.alvallalkozo), joinedload(AlvallalkozoiSzamla.projekt))
            .filter(AlvallalkozoiSzamla.fizetes_datum.is_(None))
            .all()
        )

        def to_result(sz: AlvallalkozoiSzamla) -> MatchResult:
            return MatchResult(
                forras_tipus="alvallalkozoi_szamla",
                forras_id=sz.id,
                projekt_id=sz.projekt_id,
                projekt_nev=sz.projekt.projekt_nev,
                partner_nev=sz.alvallalkozo.nev,
                szamlaszam=sz.szamlaszam,
                hatralek=sz.hatralek,
                biztos=True,
            )

        def partner_nev(sz: AlvallalkozoiSzamla) -> str:
            return sz.alvallalkozo.nev

    szamlaszam_talalatok = [sz for sz in nyitott if sz.szamlaszam and _norm(sz.szamlaszam) in text]
    if len(szamlaszam_talalatok) == 1:
        return to_result(szamlaszam_talalatok[0]), []

    partner_talalatok = [sz for sz in nyitott if partner_nev(sz) and _norm(partner_nev(sz)) in text]
    if len(partner_talalatok) == 1:
        r = to_result(partner_talalatok[0])
        r.biztos = False
        return r, []
    if len(partner_talalatok) > 1:
        alternativak = [to_result(sz) for sz in partner_talalatok]
        for a in alternativak:
            a.biztos = False
        return None, alternativak

    return None, []
