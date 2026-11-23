"""Ügyfél adatkezelés: CSV/XLSX export, CSV/XLSX import, duplikátum-keresés
és egyesítés. A /ugyfelek/{id} útvonal elé kell regisztrálni (main.py)."""

import csv
import io
from collections import defaultdict

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from openpyxl import Workbook, load_workbook
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Erdeklodes, Kommunikacio, ProjektUgyfel, Ugyfel, User
from app.services.audit import log_audit
from app.schemas_crm import (
    UgyfelDuplikatumCsoport,
    UgyfelEgyesitesRequest,
    UgyfelImportValasz,
    UgyfelResponse,
)

router = APIRouter(prefix="/ugyfelek", tags=["ugyfel-adatok"])

_FEJLEC = ["nev", "telefon", "email"]


@router.get("/export")
def export_ugyfelek(
    format: str = "csv",
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    sorok = [[u.nev, u.telefon or "", u.email or ""] for u in db.query(Ugyfel).order_by(Ugyfel.nev).all()]
    if format == "xlsx":
        wb = Workbook()
        ws = wb.active
        ws.title = "Ügyfelek"
        ws.append(_FEJLEC)
        for s in sorok:
            ws.append(s)
        buf = io.BytesIO()
        wb.save(buf)
        return Response(
            content=buf.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": 'attachment; filename="ugyfelek.xlsx"'},
        )
    if format != "csv":
        raise HTTPException(status_code=400, detail="format: csv vagy xlsx")
    buf = io.StringIO()
    w = csv.writer(buf, delimiter=";")
    w.writerow(_FEJLEC)
    w.writerows(sorok)
    # BOM, hogy az Excel az ékezeteket helyesen nyissa meg
    return Response(
        content="﻿" + buf.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="ugyfelek.csv"'},
    )


def _beolvas(filename: str, content: bytes) -> list[list[str]]:
    name = (filename or "").lower()
    if name.endswith(".xlsx"):
        try:
            ws = load_workbook(io.BytesIO(content), read_only=True, data_only=True).active
            return [["" if c is None else str(c).strip() for c in row] for row in ws.iter_rows(values_only=True)]
        except Exception as exc:
            raise HTTPException(status_code=400, detail="Az xlsx fájl nem olvasható") from exc
    if name.endswith(".csv"):
        try:
            text = content.decode("utf-8-sig")
        except UnicodeDecodeError:
            text = content.decode("cp1250", errors="replace")
        lines = text.splitlines()
        if not lines:
            return []
        delim = ";" if lines[0].count(";") >= lines[0].count(",") else ","
        return [[c.strip() for c in row] for row in csv.reader(io.StringIO(text), delimiter=delim)]
    raise HTTPException(status_code=400, detail="Csak .csv vagy .xlsx fájl tölthető fel")


@router.post("/import", response_model=UgyfelImportValasz)
async def import_ugyfelek(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Oszlopok (fejléc kötelező): nev, telefon, email. Azonos e-mail, vagy
    e-mail nélkül azonos név esetén a sort duplikátumként kihagyja."""
    sorok = _beolvas(file.filename or "", await file.read())
    if not sorok:
        raise HTTPException(status_code=400, detail="Üres fájl")
    fejlec = [h.strip().lower() for h in sorok[0]]
    if "nev" not in fejlec:
        raise HTTPException(status_code=400, detail="Hiányzik a 'nev' oszlop a fejlécből")
    idx = {k: (fejlec.index(k) if k in fejlec else None) for k in _FEJLEC}

    def cell(row: list[str], key: str) -> str:
        i = idx[key]
        return row[i].strip() if i is not None and i < len(row) else ""

    letezo_email = {e.lower() for (e,) in db.query(Ugyfel.email).filter(Ugyfel.email.isnot(None)) if e}
    letezo_nev = {n.lower() for (n,) in db.query(Ugyfel.nev)}
    letrehozva = 0
    kihagyva = 0
    hibas: list[str] = []
    for n, row in enumerate(sorok[1:], start=2):
        if not any(row):
            continue
        nev, telefon, email = cell(row, "nev"), cell(row, "telefon"), cell(row, "email")
        if not nev:
            hibas.append(f"{n}. sor: hiányzó név")
            continue
        if (email and email.lower() in letezo_email) or (not email and nev.lower() in letezo_nev):
            kihagyva += 1
            continue
        db.add(Ugyfel(nev=nev, telefon=telefon or None, email=email or None))
        letezo_nev.add(nev.lower())
        if email:
            letezo_email.add(email.lower())
        letrehozva += 1
    log_audit(db, user, "ugyfel", None, "import", f"{letrehozva} új, {kihagyva} kihagyva")
    db.commit()
    return UgyfelImportValasz(letrehozva=letrehozva, kihagyva_duplikatum=kihagyva, hibas_sorok=hibas)


@router.get("/duplikatumok", response_model=list[UgyfelDuplikatumCsoport])
def duplikatumok(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    nevek: dict[str, list[Ugyfel]] = defaultdict(list)
    emailek: dict[str, list[Ugyfel]] = defaultdict(list)
    for u in db.query(Ugyfel).order_by(Ugyfel.id).all():
        nevek[u.nev.strip().lower()].append(u)
        if u.email:
            emailek[u.email.strip().lower()].append(u)
    csoportok: list[UgyfelDuplikatumCsoport] = []
    for ok, gyujtemeny in (("azonos név", nevek), ("azonos e-mail", emailek)):
        for lista in gyujtemeny.values():
            if len(lista) > 1:
                csoportok.append(
                    UgyfelDuplikatumCsoport(ok=ok, ugyfelek=[UgyfelResponse.model_validate(u) for u in lista])
                )
    return csoportok


@router.post("/{cel_id}/egyesites", response_model=UgyfelResponse)
def egyesites(
    cel_id: int,
    body: UgyfelEgyesitesRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """A forrás ügyfél projektjeit, naplóját, érdeklődőit a célhoz köti, a
    hiányzó elérhetőségeket átveszi, majd a forrást törli."""
    if cel_id == body.forras_id:
        raise HTTPException(status_code=400, detail="Egy ügyfél nem egyesíthető önmagával")
    cel = db.query(Ugyfel).get(cel_id)
    forras = db.query(Ugyfel).get(body.forras_id)
    if not cel or not forras:
        raise HTTPException(status_code=404, detail="Ügyfél not found")
    cel.telefon = cel.telefon or forras.telefon
    cel.email = cel.email or forras.email
    db.query(ProjektUgyfel).filter(ProjektUgyfel.ugyfel_id == forras.id).update({"ugyfel_id": cel.id})
    db.query(Kommunikacio).filter(Kommunikacio.ugyfel_id == forras.id).update({"ugyfel_id": cel.id})
    db.query(Erdeklodes).filter(Erdeklodes.ugyfel_id == forras.id).update({"ugyfel_id": cel.id})
    db.flush()
    log_audit(db, user, "ugyfel", cel.id, "egyesites", f"#{forras.id} {forras.nev} beolvasztva")
    db.expire(forras)
    db.delete(forras)
    db.commit()
    db.refresh(cel)
    return cel
