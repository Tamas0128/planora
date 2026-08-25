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


def parse_upload(filename: str, content: bytes) -> tuple[list[str], list[list[Optional[str]]]]:
    if filename.lower().endswith((".xlsx", ".xlsm")):
        workbook = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
        sheet = workbook.active
        rows_iter = sheet.iter_rows(values_only=True)
        try:
            header = next(rows_iter)
        except StopIteration:
            return [], []
        columns = [str(c).strip() if c is not None else "" for c in header]
        rows = [[None if c is None else str(c) for c in row] for row in rows_iter]
        return columns, rows

    # CSV (or anything else) fallback — sniff the delimiter since TERC-style
    # exports vary between comma and semicolon depending on locale.
    text = content.decode("utf-8-sig", errors="replace")
    try:
        dialect = csv.Sniffer().sniff(text[:2048], delimiters=",;\t")
    except csv.Error:
        dialect = csv.excel
    all_rows = list(csv.reader(io.StringIO(text), dialect))
    if not all_rows:
        return [], []
    return [c.strip() for c in all_rows[0]], all_rows[1:]


def build_parse_response(filename: str, content: bytes) -> dict:
    columns, rows = parse_upload(filename, content)
    return {
        "columns": columns,
        "rows": rows,
        "suggested_mapping": _guess_mapping(columns),
        "row_count": len(rows),
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
