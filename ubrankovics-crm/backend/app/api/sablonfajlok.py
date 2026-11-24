"""Feltölthető .docx dokumentumsablonok és a projekt-dokumentum generálás belőlük."""

import io
import os
import re
import uuid
import zipfile
from datetime import datetime
from typing import Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.services import storage
from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import DokumentumSablonTipus, Projekt, ProjektTetel, User, UserRole
from app.models_projekt import SablonFajl
from app.services.audit import log_audit
from app.services.docx_generalas import MINTA_CONTEXT, VALTOZOK, build_context, render_docx

router = APIRouter(tags=["sablonfajlok"])

MAX_BYTES = 5 * 1024 * 1024
DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
TIPUSOK = [t.value for t in DokumentumSablonTipus]


class SablonInfo(BaseModel):
    tipus: str
    feltoltve: bool
    eredeti_nev: Optional[str] = None
    meret: Optional[int] = None
    feltoltve_at: Optional[datetime] = None


class SablonLista(BaseModel):
    sablonok: list[SablonInfo]
    valtozok: list[dict[str, str]]


class DocxGeneralas(BaseModel):
    tipus: DokumentumSablonTipus
    tetel_ids: list[int] = []
    uzenet: Optional[str] = None


def _info(tipus: str, s: SablonFajl | None) -> SablonInfo:
    if not s:
        return SablonInfo(tipus=tipus, feltoltve=False)
    return SablonInfo(tipus=tipus, feltoltve=True, eredeti_nev=s.eredeti_nev, meret=s.meret, feltoltve_at=s.created_at)


def _tipus_ellenorzes(tipus: str) -> None:
    if tipus not in TIPUSOK:
        raise HTTPException(status_code=404, detail="Ismeretlen sablontípus")


def _content_disposition(filename: str) -> str:
    ascii_fallback = re.sub(r"[^\x20-\x7e]", "_", filename).replace('"', "'")
    return f"attachment; filename=\"{ascii_fallback}\"; filename*=UTF-8''{quote(filename, safe='')}"


@router.get("/sablonfajlok", response_model=SablonLista)
def lista(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    by_tipus = {s.tipus: s for s in db.query(SablonFajl).all()}
    return SablonLista(
        sablonok=[_info(t, by_tipus.get(t)) for t in TIPUSOK],
        valtozok=[{"nev": n, "leiras": d} for n, d in VALTOZOK],
    )


@router.post("/sablonfajlok/{tipus}", response_model=SablonInfo, status_code=201)
async def feltoltes(
    tipus: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.VEZETES)),
):
    _tipus_ellenorzes(tipus)
    if not (file.filename or "").lower().endswith(".docx"):
        raise HTTPException(status_code=400, detail="Csak .docx fájl tölthető fel")
    content = await file.read()
    if len(content) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="A sablon túl nagy (max 5 MB)")
    if not zipfile.is_zipfile(io.BytesIO(content)):
        raise HTTPException(status_code=400, detail="A fájl nem érvényes .docx dokumentum")
    # próbakitöltés: a hibás {{ }} / {% %} szintaxist már feltöltéskor jelezzük
    try:
        render_docx(content, MINTA_CONTEXT)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"A sablon nem tölthető ki: {exc}") from exc

    stored = f"sablon-{tipus}-{uuid.uuid4()}.docx"
    storage.save(stored, content, DOCX_MIME)
    regi = db.query(SablonFajl).filter(SablonFajl.tipus == tipus).first()
    if regi:
        storage.delete(regi.utvonal)
        db.delete(regi)
        db.flush()
    s = SablonFajl(tipus=tipus, utvonal=stored, eredeti_nev=file.filename, meret=len(content), feltolto_id=user.id)
    db.add(s)
    log_audit(db, user, "sablon", None, "feltoltes", f"{tipus}: {file.filename}")
    db.commit()
    db.refresh(s)
    return _info(tipus, s)


@router.get("/sablonfajlok/{tipus}/letoltes")
def letoltes(tipus: str, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    _tipus_ellenorzes(tipus)
    s = db.query(SablonFajl).filter(SablonFajl.tipus == tipus).first()
    if not s:
        raise HTTPException(status_code=404, detail="Ehhez a típushoz nincs feltöltött sablon")
    try:
        data = storage.read(s.utvonal)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="A sablonfájl nem található")
    return Response(data, media_type=DOCX_MIME, headers={"Content-Disposition": _content_disposition(s.eredeti_nev)})


@router.delete("/sablonfajlok/{tipus}", status_code=204)
def torles(
    tipus: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.VEZETES)),
):
    _tipus_ellenorzes(tipus)
    s = db.query(SablonFajl).filter(SablonFajl.tipus == tipus).first()
    if not s:
        raise HTTPException(status_code=404, detail="Ehhez a típushoz nincs feltöltött sablon")
    storage.delete(s.utvonal)
    log_audit(db, user, "sablon", None, "torles", tipus)
    db.delete(s)
    db.commit()


@router.post("/projektek/{projekt_id}/dokumentum-docx")
def dokumentum_generalas(
    projekt_id: int,
    body: DocxGeneralas,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """A feltöltött sablonból .docx-et tölt ki a projekt (és a kijelölt, ill. összes tétel) adataival."""
    projekt = db.query(Projekt).get(projekt_id)
    if not projekt:
        raise HTTPException(status_code=404, detail="Projekt not found")
    s = db.query(SablonFajl).filter(SablonFajl.tipus == body.tipus.value).first()
    if not s:
        raise HTTPException(status_code=409, detail="Ehhez a típushoz nincs feltöltött .docx sablon (Törzsadatok → Dokumentumsablonok)")
    q = (
        db.query(ProjektTetel)
        .options(joinedload(ProjektTetel.munkanem), joinedload(ProjektTetel.specifikaciok))
        .filter(ProjektTetel.projekt_id == projekt_id)
    )
    if body.tetel_ids:
        q = q.filter(ProjektTetel.id.in_(body.tetel_ids))
    tetelek = q.order_by(ProjektTetel.sorrend, ProjektTetel.id).all()
    try:
        sablon_bajt = storage.read(s.utvonal)
    except FileNotFoundError:
        raise HTTPException(status_code=409, detail="A sablonfájl hiányzik a tárolóból, töltsd fel újra")
    try:
        data = render_docx(sablon_bajt, build_context(projekt, tetelek, body.uzenet))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=422, detail=f"A sablon kitöltése sikertelen: {exc}") from exc
    log_audit(db, user, "projekt", projekt.id, "dokumentum_generalas", body.tipus.value)
    db.commit()
    nev = re.sub(r"[^\w\-]+", "_", projekt.projekt_nev, flags=re.UNICODE).strip("_") or "projekt"
    return Response(
        data,
        media_type=DOCX_MIME,
        headers={"Content-Disposition": _content_disposition(f"{body.tipus.value}-{nev}.docx")},
    )
