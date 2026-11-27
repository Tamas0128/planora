"""Best-effort Excel import for the two free-form, project-level tracking
sheets construction sites actually keep on their own computers: a
munkanem-by-munkanem subcontractor status tracker ("ütem+info" style) and
a technical/gyártástervezési adatlap (grouped label→value spec sheet,
"Szerkezetkész" style).

Both are two-step, stateless, same shape as price_catalog_import.py's TERC
import: `parse_*` reads the file once and returns a best-guess, already
mapped preview; the caller (frontend) lets the user fix anything in the
preview table and re-submits those exact rows to `commit`. Unlike the
price catalog there is no column-mapping step to confirm — every target
field here is free text, so a wrong guess is just as easy to fix directly
in the preview/edit table afterwards, and real site trackers vary too much
row-to-row (merged cells, continuation lines, stray notes) for a strict
mapping UI to earn its keep.
"""

import io
import re
import unicodedata
from typing import Optional

import openpyxl

from app.schemas import ProjectSpecItemCreate, TradeItemCreate


def _norm(s) -> str:
    s = unicodedata.normalize("NFKD", str(s or "")).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def _txt(v) -> Optional[str]:
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def _load_rows(filename: str, content: bytes, sheet_name: Optional[str], name_hints: tuple[str, ...]) -> tuple[list[list[Optional[str]]], list[str], str]:
    workbook = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    sheet_names = workbook.sheetnames
    sheet = None
    if sheet_name and sheet_name in sheet_names:
        sheet = workbook[sheet_name]
    else:
        for name in sheet_names:
            if any(hint in _norm(name) for hint in name_hints):
                sheet = workbook[name]
                break
    if sheet is None:
        sheet = workbook.active
    rows = [[None if c is None else str(c) for c in row] for row in sheet.iter_rows(values_only=True)]
    return rows, sheet_names, sheet.title


# --- Trade/alvállalkozó status tracker ("ütem+info") ------------------------

_TRADE_HEADER_KEYWORDS: dict[str, tuple[str, ...]] = {
    "name": ("megnevez",),
    "contractor": ("ubr", "vallalkozo", "kivitelezo"),
    "info": ("info",),
    "offer_status": ("ajanlat",),
    "contract_status": ("szerzodes",),
    "material_status": ("alapanyag",),
    "expected_timing": ("varhato", "hatarido"),
    "tig": ("tig",),
    "cross_trade_note": ("extra",),
    "extra_work_note": ("potmunka",),
}


def _score_as_header(row: list[Optional[str]]) -> int:
    lowered = [_norm(c) for c in row]
    score = 0
    for keywords in _TRADE_HEADER_KEYWORDS.values():
        if any(any(kw in col for kw in keywords) for col in lowered):
            score += 1
    return score


def parse_trade_items(filename: str, content: bytes, sheet_name: Optional[str] = None) -> dict:
    rows, sheet_names, sheet_used = _load_rows(filename, content, sheet_name, ("utem", "info", "allapot"))
    warnings: list[str] = []

    header_idx = max(range(min(5, len(rows))), key=lambda i: _score_as_header(rows[i])) if rows else 0
    if _score_as_header(rows[header_idx]) < 2:
        warnings.append(
            "Nem sikerült biztosan beazonosítani a fejléc sort — az első sort használtam fejlécként, "
            "ellenőrizd az eredményt."
        )
        header_idx = 0

    header = [_norm(c) for c in rows[header_idx]]
    mapping: dict[str, int] = {}
    for field, keywords in _TRADE_HEADER_KEYWORDS.items():
        for idx, col in enumerate(header):
            if any(kw in col for kw in keywords):
                mapping[field] = idx
                break

    if "name" not in mapping:
        warnings.append("Nem találtam 'Megnevezés' oszlopot — az első oszlopot használtam névként.")
        mapping["name"] = 0

    def cell(row: list[Optional[str]], field: str) -> Optional[str]:
        idx = mapping.get(field)
        return _txt(row[idx]) if idx is not None and idx < len(row) else None

    out: list[TradeItemCreate] = []
    skipped: list[str] = []
    for row in rows[header_idx + 1:]:
        name = cell(row, "name")
        if not name:
            leftover = next((v for v in row if _txt(v)), None)
            if leftover:
                skipped.append(leftover[:60])
            continue
        out.append(
            TradeItemCreate(
                name=name,
                contractor=cell(row, "contractor"),
                info=cell(row, "info"),
                offer_status=cell(row, "offer_status"),
                contract_status=cell(row, "contract_status"),
                material_status=cell(row, "material_status"),
                expected_timing=cell(row, "expected_timing"),
                tig=cell(row, "tig"),
                cross_trade_note=cell(row, "cross_trade_note"),
                extra_work_note=cell(row, "extra_work_note"),
            )
        )

    if skipped:
        warnings.append(
            f"{len(skipped)} megnevezés nélküli sort kihagytam (pl. {skipped[0]!r})."
        )

    return {
        "rows": out,
        "sheet_used": sheet_used,
        "sheet_names": sheet_names,
        "warnings": warnings,
    }


# --- Technical/gyártástervezési adatlap ("Szerkezetkész") -------------------

_NUMERIC_RE = re.compile(r"^\d+$")
# A lone date/datetime in column A (e.g. a "file generated on" stamp, or an
# Excel date cell whose serial number got stringified upstream) isn't a
# section title either — same reasoning as the plain-number guard above.
_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}(\s|$)")


def parse_spec_items(filename: str, content: bytes, sheet_name: Optional[str] = None) -> dict:
    rows, sheet_names, sheet_used = _load_rows(filename, content, sheet_name, ("szerkezet", "adatlap", "specifikacio"))
    warnings: list[str] = []

    out: list[ProjectSpecItemCreate] = []
    current_group = "Alapadatok"
    last_item: Optional[ProjectSpecItemCreate] = None

    for row in rows:
        col0 = _txt(row[0]) if len(row) > 0 else None
        col1 = _txt(row[1]) if len(row) > 1 else None
        col2 = _txt(row[2]) if len(row) > 2 else None
        col3 = _txt(row[3]) if len(row) > 3 else None

        if col0 and not col1 and not col2:
            # Section header row — but skip bare-number "ids" or stray
            # title lines sometimes left above the real sections.
            if not _NUMERIC_RE.match(col0) and not _DATE_RE.match(col0):
                current_group = col0
                last_item = None
            continue

        if not col0 and not col1 and not col2 and not col3:
            continue

        if col1:
            label = col1.rstrip(" :")
            item = ProjectSpecItemCreate(group_name=current_group, label=label, value=col2, note=col3)
            out.append(item)
            last_item = item
            continue

        # Continuation line: no label, but a value/note to attach to the
        # item just above it (real adatlapok often wrap a long value or add
        # a side-remark on the next row without repeating the label).
        if last_item is not None and (col2 or col3):
            if col2:
                last_item.value = f"{last_item.value}; {col2}" if last_item.value else col2
            if col3:
                last_item.note = f"{last_item.note}; {col3}" if last_item.note else col3
        elif col2 or col3:
            out.append(ProjectSpecItemCreate(group_name=current_group, label="(megjegyzés)", value=col2, note=col3))

    if not out:
        warnings.append("Nem találtam feldolgozható sort ezen a lapon — ellenőrizd, hogy a jó munkalapot választottad-e.")

    return {
        "rows": out,
        "sheet_used": sheet_used,
        "sheet_names": sheet_names,
        "warnings": warnings,
    }
