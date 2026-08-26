"""TERC (or any Ft price-list) Excel/CSV import for the price catalog —
Phase 3 of the Költségbecslés module. Two-step, stateless: parse_upload
reads the file once and returns every row plus a best-guess column
mapping; the caller (frontend) lets the admin adjust the mapping and
re-submits the same rows to commit_import — no server-side temp storage
needed between the two calls.
"""

import csv
import io
from decimal import Decimal, InvalidOperation
from typing import Optional

import openpyxl
from sqlalchemy.orm import Session

from app.models_estimate import PriceCatalogItem, PriceCatalogSource

_HEADER_KEYWORDS: dict[str, tuple[str, ...]] = {
    "code": ("kód", "kod", "code", "tételszám", "azonosító"),
    "description": ("megnevezés", "megnevezes", "description", "leírás", "leiras", "name"),
    "unit": ("mennyiségi egység", "menny. egys", "egység", "egyseg", "unit"),
    "chapter": ("munkanem", "fejezet", "chapter", "csoport"),
    "unit_price_material": ("anyagár", "anyag ár", "anyag", "material"),
    "unit_price_labor": ("díjár", "díj", "dij", "munkadíj", "labor", "fee"),
    "unit_price": ("egységár", "egysegar", "ár", "price", "összesen"),
}

CHAPTER_COLUMN_LABEL = "Felismert munkanem (szekció)"


def _guess_mapping(columns: list[str]) -> dict[str, int]:
    """First-match-wins per target field, scanning columns left to right —
    good enough for typical TERC exports where headers are short and
    distinct; the admin can always fix a wrong guess in the mapping UI."""
    mapping: dict[str, int] = {}
    lowered = [c.strip().lower() for c in columns]
    for field, keywords in _HEADER_KEYWORDS.items():
        for idx, col in enumerate(lowered):
            if any(kw in col for kw in keywords):
                mapping[field] = idx
                break
    return mapping


def _read_all_rows(
    filename: str, content: bytes, sheet_name: Optional[str]
) -> tuple[list[list[Optional[str]]], list[str], str]:
    """Returns every raw row of the chosen sheet/file, completely
    unprocessed (title rows, blank rows, section headers and all) — header
    detection and section collapsing happen afterwards, once, shared
    between the xlsx and csv paths.
    """
    if filename.lower().endswith((".xlsx", ".xlsm")):
        workbook = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
        sheet_names = workbook.sheetnames
        sheet = workbook[sheet_name] if sheet_name and sheet_name in sheet_names else workbook.active
        rows = [[None if c is None else str(c) for c in row] for row in sheet.iter_rows(values_only=True)]
        return rows, sheet_names, sheet.title

    # CSV (or anything else) fallback — sniff the delimiter since TERC-style
    # exports vary between comma and semicolon depending on locale.
    text = content.decode("utf-8-sig", errors="replace")
    try:
        dialect = csv.Sniffer().sniff(text[:2048], delimiters=",;\t")
    except csv.Error:
        dialect = csv.excel
    rows = list(csv.reader(io.StringIO(text), dialect))
    return rows, [], ""


def _score_row_as_header(row: list[Optional[str]]) -> int:
    lowered = [str(c).strip().lower() if c is not None else "" for c in row]
    score = 0
    for keywords in _HEADER_KEYWORDS.values():
        if any(any(kw in col for kw in keywords) for col in lowered):
            score += 1
    return score


def _find_header_index(rows: list[list[Optional[str]]]) -> int:
    """Real-world exports often carry a title/legend above the actual
    column-header row (e.g. two title lines + a blank line before the
    'TERC-kód | Megnevezés | ...' row). Score the first 15 rows by how many
    target fields they look like a header for, and pick the best one —
    falling back to row 0 (the old fixed assumption) when nothing scores
    well, so a plain single-header CSV still works exactly as before.
    """
    best_idx, best_score = 0, -1
    for i, row in enumerate(rows[:15]):
        score = _score_row_as_header(row)
        if score > best_score:
            best_idx, best_score = i, score
    return best_idx if best_score >= 2 else 0


def _collapse_sections(data_rows: list[list[Optional[str]]]) -> list[list[Optional[str]]]:
    """Folds Hungarian munkanem-style section-header rows (exactly one
    non-empty cell, e.g. "02. Földmunkák") and "...összesen" subtotal
    marker rows (also exactly one non-empty cell) out of the row list,
    appending the most recently seen section header's text as a
    synthesized trailing column on every real data row — the common shape
    of a tételes költségvetés export, where the munkanem is a heading
    above a block of items rather than its own per-row column. A row that
    already carries its chapter as one of several populated cells (the
    flat-CSV case) is untouched apart from gaining the extra, harmless,
    empty trailing column.
    """
    current_chapter = ""
    out_rows: list[list[Optional[str]]] = []
    for row in data_rows:
        non_empty = [c for c in row if c not in (None, "")]
        if not non_empty:
            continue
        if len(non_empty) == 1:
            text = str(non_empty[0])
            if "összesen" not in text.lower():
                current_chapter = text.strip()
            continue
        out_rows.append(list(row) + [current_chapter])
    return out_rows


def parse_upload(filename: str, content: bytes, sheet_name: Optional[str] = None) -> dict:
    all_rows, sheet_names, used_sheet = _read_all_rows(filename, content, sheet_name)
    if not all_rows:
        return {"columns": [], "rows": [], "sheet_names": sheet_names, "sheet_name": used_sheet}
    header_idx = _find_header_index(all_rows)
    columns = [str(c).strip() if c is not None else "" for c in all_rows[header_idx]] + [
        CHAPTER_COLUMN_LABEL
    ]
    rows = _collapse_sections(all_rows[header_idx + 1 :])
    return {"columns": columns, "rows": rows, "sheet_names": sheet_names, "sheet_name": used_sheet}


def build_parse_response(filename: str, content: bytes, sheet_name: Optional[str] = None) -> dict:
    parsed = parse_upload(filename, content, sheet_name)
    return {
        "columns": parsed["columns"],
        "rows": parsed["rows"],
        "suggested_mapping": _guess_mapping(parsed["columns"]),
        "row_count": len(parsed["rows"]),
        "sheet_names": parsed["sheet_names"],
        "sheet_name": parsed["sheet_name"],
    }


def _to_decimal(raw: Optional[str]) -> Decimal:
    if raw is None or raw == "":
        return Decimal("0")
    try:
        return Decimal(str(raw).replace(" ", "").replace(",", "."))
    except InvalidOperation:
        return Decimal("0")


def commit_import(
    db: Session,
    rows: list[list[Optional[str]]],
    mapping: dict[str, int],
    source_reference: str,
) -> dict[str, int]:
    """Upserts by `code` (case-sensitive exact match) so re-importing the
    same price list updates existing rows instead of duplicating them —
    matters because TERC price lists get re-exported periodically with
    updated prices under the same item codes.
    """

    def cell(row: list[Optional[str]], field: str) -> Optional[str]:
        idx = mapping.get(field)
        if idx is None or idx >= len(row):
            return None
        value = row[idx]
        return value.strip() if isinstance(value, str) else value

    created = updated = skipped = 0
    for row in rows:
        code = cell(row, "code")
        description = cell(row, "description")
        if not code or not description:
            skipped += 1
            continue
        unit = cell(row, "unit") or ""
        chapter = cell(row, "chapter") or ""

        material_raw = cell(row, "unit_price_material")
        labor_raw = cell(row, "unit_price_labor")
        if material_raw is not None or labor_raw is not None:
            material = _to_decimal(material_raw)
            labor = _to_decimal(labor_raw)
        else:
            material = _to_decimal(cell(row, "unit_price"))
            labor = Decimal("0")

        existing = db.query(PriceCatalogItem).filter(PriceCatalogItem.code == code).first()
        if existing:
            existing.description = description
            existing.unit = unit or existing.unit
            existing.chapter = chapter or existing.chapter
            existing.unit_price_material = material
            existing.unit_price_labor = labor
            existing.source = PriceCatalogSource.TERC_IMPORT
            existing.source_reference = source_reference
            updated += 1
        else:
            db.add(
                PriceCatalogItem(
                    code=code,
                    description=description,
                    unit=unit,
                    chapter=chapter,
                    unit_price_material=material,
                    unit_price_labor=labor,
                    source=PriceCatalogSource.TERC_IMPORT,
                    source_reference=source_reference,
                )
            )
            created += 1

    db.commit()
    return {"created": created, "updated": updated, "skipped": skipped}
