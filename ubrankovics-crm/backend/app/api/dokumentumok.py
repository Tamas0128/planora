"""Projekt dokumentumok — valódi fájlfeltöltés helyi lemezes tárba
(UPLOAD_DIR, named Docker volume-ra kötve, ld. docker-compose.yml).

Nem S3/MinIO, mert ennek az appnak jelenleg nincs ilyen infrastruktúrája —
a planora `crm_documents.py`-ja S3-at használ, de itt a cél az egyszerűség,
nem a két kódbázis közötti megosztott tárhely."""

import os
import re
import uuid
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models import Dokumentum, Projekt, User
from app.schemas_crm import DokumentumResponse

router = APIRouter(prefix="/projektek/{projekt_id}", tags=["dokumentumok"])

MAX_UPLOAD_BYTES = 25 * 1024 * 1024  # 25 MB
ALLOWED_EXTENSIONS = {
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".jpg", ".jpeg", ".png", ".dwg", ".zip", ".txt",
}


def _content_disposition(filename: str) -> str:
    # Magyar fájlnevek rendszeresen tartalmaznak ékezetes karaktereket, amit
    # a sima ASCII filename= paraméter nem tud reprezentálni — ASCII-biztos
    # fallback + RFC 6266 UTF-8 forma (ugyanaz a minta, mint gantt.py-ban).
    ascii_fallback = re.sub(r"[^\x20-\x7e]", "_", filename).replace('"', "'")
    encoded = quote(filename, safe="")
    return f'attachment; filename="{ascii_fallback}"; filename*=UTF-8\'\'{encoded}'


def _get_projekt_or_404(db: Session, projekt_id: int) -> Projekt:
    projekt = db.query(Projekt).get(projekt_id)
    if not projekt:
        raise HTTPException(status_code=404, detail="Projekt not found")
    return projekt


def _get_dokumentum_or_404(db: Session, projekt_id: int, dokumentum_id: int) -> Dokumentum:
    dok = (
        db.query(Dokumentum)
        .filter(Dokumentum.id == dokumentum_id, Dokumentum.projekt_id == projekt_id)
        .first()
    )
    if not dok:
        raise HTTPException(status_code=404, detail="Dokumentum not found")
    return dok


@router.get("/dokumentumok", response_model=list[DokumentumResponse])
def list_dokumentumok(
    projekt_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    _get_projekt_or_404(db, projekt_id)
    return (
        db.query(Dokumentum)
        .filter(Dokumentum.projekt_id == projekt_id)
        .order_by(Dokumentum.created_at.desc())
        .all()
    )


@router.post("/dokumentumok", response_model=DokumentumResponse, status_code=201)
async def upload_dokumentum(
    projekt_id: int,
    tipus: str = Form(...),
    megjegyzes: str | None = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _get_projekt_or_404(db, projekt_id)
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Nem engedélyezett fájltípus: {ext or '(nincs kiterjesztés)'}")
    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="A fájl túl nagy (max 25 MB)")

    os.makedirs(settings.upload_dir, exist_ok=True)
    stored_name = f"{uuid.uuid4()}{ext}"
    with open(os.path.join(settings.upload_dir, stored_name), "wb") as f:
        f.write(content)

    dok = Dokumentum(
        projekt_id=projekt_id,
        tipus=tipus,
        utvonal=stored_name,
        eredeti_nev=file.filename,
        tartalom_tipus=file.content_type,
        meret=len(content),
        feltoltotte_id=user.id,
        megjegyzes=megjegyzes,
    )
    db.add(dok)
    db.commit()
    db.refresh(dok)
    return dok


@router.get("/dokumentumok/{dokumentum_id}/letoltes")
def download_dokumentum(
    projekt_id: int,
    dokumentum_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    dok = _get_dokumentum_or_404(db, projekt_id, dokumentum_id)
    path = os.path.join(settings.upload_dir, dok.utvonal)
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="A fájl nem található a tárolóban")
    return FileResponse(
        path,
        media_type=dok.tartalom_tipus or "application/octet-stream",
        headers={"Content-Disposition": _content_disposition(dok.eredeti_nev or dok.utvonal)},
    )


@router.delete("/dokumentumok/{dokumentum_id}", status_code=204)
def delete_dokumentum(
    projekt_id: int,
    dokumentum_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    dok = _get_dokumentum_or_404(db, projekt_id, dokumentum_id)
    path = os.path.join(settings.upload_dir, dok.utvonal)
    if os.path.isfile(path):
        os.remove(path)
    db.delete(dok)
    db.commit()
