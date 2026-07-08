import uuid
from datetime import date

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session, joinedload

# Imported as a module (not `from app.api.documents import get_s3_client`) so
# that tests monkeypatching `app.api.documents.get_s3_client` etc. (see
# conftest.py's fake_s3 fixture) are observed here too — a plain name import
# would bind to the original function object at import time and silently
# bypass the fake S3 client in tests.
from app.api import documents as documents_api
from app.api.documents import MAX_UPLOAD_BYTES, _require_project_access
from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models import Photo, User
from app.schemas import PhotoResponse

router = APIRouter(prefix="/projects", tags=["photos"])

ALLOWED_PHOTO_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def _photo_to_response(photo: Photo) -> PhotoResponse:
    return PhotoResponse(
        id=photo.id,
        filename=photo.filename,
        content_type=photo.content_type,
        file_size=photo.file_size,
        taken_at=photo.taken_at,
        comment=photo.comment,
        uploaded_by_name=photo.uploaded_by.full_name if photo.uploaded_by else None,
        created_at=photo.created_at,
    )


@router.get("/{project_id}/photos", response_model=list[PhotoResponse])
def list_photos(
    project_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_project_access(project_id, user, db)
    photos = (
        db.query(Photo)
        .options(joinedload(Photo.uploaded_by))
        .filter(Photo.project_id == project_id)
        .order_by(Photo.taken_at.desc(), Photo.created_at.desc())
        .all()
    )
    return [_photo_to_response(p) for p in photos]


@router.post("/{project_id}/photos", response_model=PhotoResponse)
async def upload_photo(
    project_id: int,
    file: UploadFile = File(...),
    taken_at: date = Form(...),
    comment: str | None = Form(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_project_access(project_id, user, db)

    ext = "." + file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else ""
    if ext not in ALLOWED_PHOTO_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type not allowed: {ext}")

    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 50 MB)")

    documents_api.ensure_bucket()
    key = f"projects/{project_id}/photos/{uuid.uuid4()}{ext}"
    client = documents_api.get_s3_client()
    client.put_object(
        Bucket=settings.s3_bucket,
        Key=key,
        Body=content,
        ContentType=file.content_type or "application/octet-stream",
    )

    photo = Photo(
        project_id=project_id,
        filename=file.filename or "unknown",
        content_type=file.content_type or "application/octet-stream",
        file_size=len(content),
        s3_key=key,
        taken_at=taken_at,
        comment=comment,
        uploaded_by_id=user.id,
    )
    db.add(photo)
    db.commit()
    db.refresh(photo)
    return _photo_to_response(photo)


@router.get("/{project_id}/photos/{photo_id}/download")
def download_photo(
    project_id: int,
    photo_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_project_access(project_id, user, db)
    photo = db.query(Photo).filter(
        Photo.id == photo_id, Photo.project_id == project_id
    ).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    client = documents_api.get_public_s3_client()
    url = client.generate_presigned_url(
        "get_object",
        Params={
            "Bucket": settings.s3_bucket,
            "Key": photo.s3_key,
            "ResponseContentDisposition": documents_api._content_disposition(photo.filename),
        },
        ExpiresIn=300,
    )
    return {"url": url}


@router.delete("/{project_id}/photos/{photo_id}")
def delete_photo(
    project_id: int,
    photo_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_project_access(project_id, user, db, edit=True)
    photo = db.query(Photo).filter(
        Photo.id == photo_id, Photo.project_id == project_id
    ).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    client = documents_api.get_s3_client()
    try:
        client.delete_object(Bucket=settings.s3_bucket, Key=photo.s3_key)
    except Exception:
        pass
    db.delete(photo)
    db.commit()
    return {"ok": True}
