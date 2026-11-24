"""Építési napló: napi bejegyzések fotókkal (mobilról kamerával is)."""

import io
import os
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from PIL import Image, ImageOps
from sqlalchemy.orm import Session, joinedload

from app.services import storage
from app.database import get_db
from app.dependencies import get_current_user
from app.models import Projekt, User
from app.models_projekt import NaploBejegyzes, NaploFoto
from app.schemas_projekt import NaploCreate, NaploResponse, NaploUpdate
from app.services.audit import log_audit

router = APIRouter(tags=["naplo"])

MAX_FOTO_BYTES = 15 * 1024 * 1024
FOTO_EXT = {".jpg", ".jpeg", ".png", ".webp", ".heic"}


def _q(db: Session):
    return db.query(NaploBejegyzes).options(joinedload(NaploBejegyzes.szerzo), joinedload(NaploBejegyzes.fotok))


def _bejegyzes(db: Session, bid: int) -> NaploBejegyzes:
    b = _q(db).filter(NaploBejegyzes.id == bid).first()
    if not b:
        raise HTTPException(status_code=404, detail="Napló bejegyzés not found")
    return b


@router.get("/projektek/{projekt_id}/naplo", response_model=list[NaploResponse])
def list_naplo(projekt_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    if not db.query(Projekt).get(projekt_id):
        raise HTTPException(status_code=404, detail="Projekt not found")
    return (
        _q(db)
        .filter(NaploBejegyzes.projekt_id == projekt_id)
        .order_by(NaploBejegyzes.datum.desc(), NaploBejegyzes.id.desc())
        .all()
    )


@router.post("/projektek/{projekt_id}/naplo", response_model=NaploResponse, status_code=201)
def create_naplo(
    projekt_id: int,
    body: NaploCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not db.query(Projekt).get(projekt_id):
        raise HTTPException(status_code=404, detail="Projekt not found")
    b = NaploBejegyzes(projekt_id=projekt_id, szerzo_id=user.id, **body.model_dump())
    db.add(b)
    db.flush()
    log_audit(db, user, "naplo", b.id, "letrehozas")
    db.commit()
    return _bejegyzes(db, b.id)


@router.patch("/naplo/{bejegyzes_id}", response_model=NaploResponse)
def update_naplo(
    bejegyzes_id: int,
    body: NaploUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    b = _bejegyzes(db, bejegyzes_id)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(b, k, v)
    log_audit(db, user, "naplo", b.id, "modositas")
    db.commit()
    return _bejegyzes(db, bejegyzes_id)


@router.delete("/naplo/{bejegyzes_id}", status_code=204)
def delete_naplo(bejegyzes_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    b = _bejegyzes(db, bejegyzes_id)
    for f in b.fotok:
        _remove_file(f.utvonal)
    log_audit(db, user, "naplo", b.id, "torles")
    db.delete(b)
    db.commit()


def _thumb_name(name: str) -> str:
    return f"thumb-{name}.jpg"


def _remove_file(name: str) -> None:
    for n in (name, _thumb_name(name)):
        storage.delete(n)


def _make_thumb(content: bytes, stored: str) -> None:
    """320 px-es JPEG miniatűr; ha a formátum nem olvasható (pl. HEIC), nincs miniatűr, és az eredeti szolgál."""
    try:
        with Image.open(io.BytesIO(content)) as im:
            im = ImageOps.exif_transpose(im).convert("RGB")
            im.thumbnail((320, 320))
            buf = io.BytesIO()
            im.save(buf, "JPEG", quality=78)
        storage.save(_thumb_name(stored), buf.getvalue(), "image/jpeg")
    except Exception:  # noqa: BLE001 — a miniatűr csak optimalizáció
        pass


@router.post("/naplo/{bejegyzes_id}/fotok", response_model=NaploResponse, status_code=201)
async def upload_foto(
    bejegyzes_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    b = _bejegyzes(db, bejegyzes_id)
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in FOTO_EXT:
        raise HTTPException(status_code=400, detail=f"Csak képfájl tölthető fel ({', '.join(sorted(FOTO_EXT))})")
    content = await file.read()
    if len(content) > MAX_FOTO_BYTES:
        raise HTTPException(status_code=413, detail="A fotó túl nagy (max 15 MB)")
    stored = f"naplo-{uuid.uuid4()}{ext}"
    storage.save(stored, content, file.content_type)
    _make_thumb(content, stored)
    db.add(
        NaploFoto(
            bejegyzes_id=b.id,
            utvonal=stored,
            eredeti_nev=file.filename,
            tartalom_tipus=file.content_type,
            meret=len(content),
        )
    )
    log_audit(db, user, "naplo", b.id, "foto", file.filename)
    db.commit()
    db.expire_all()
    return _bejegyzes(db, bejegyzes_id)


@router.get("/naplo-fotok/{foto_id}")
def get_foto(foto_id: int, thumb: bool = False, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    f = db.query(NaploFoto).get(foto_id)
    if not f:
        raise HTTPException(status_code=404, detail="Fotó not found")
    if thumb:
        try:
            return Response(storage.read(_thumb_name(f.utvonal)), media_type="image/jpeg")
        except FileNotFoundError:
            pass
    try:
        data = storage.read(f.utvonal)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="A fájl nem található")
    return Response(data, media_type=f.tartalom_tipus or "image/jpeg")


@router.delete("/naplo-fotok/{foto_id}", status_code=204)
def delete_foto(foto_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    f = db.query(NaploFoto).get(foto_id)
    if not f:
        raise HTTPException(status_code=404, detail="Fotó not found")
    _remove_file(f.utvonal)
    log_audit(db, user, "naplo", f.bejegyzes_id, "foto_torles", f.eredeti_nev)
    db.delete(f)
    db.commit()
