import re
import uuid
from urllib.parse import quote

import boto3
from botocore.client import Config
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models import Document, Project, User
from app.schemas import DocumentResponse

router = APIRouter(prefix="/projects", tags=["documents"])

ALLOWED_EXTENSIONS = {".pdf", ".dwg", ".xlsx", ".docx", ".jpg", ".jpeg", ".png"}


def get_s3_client():
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
        config=Config(signature_version="s3v4"),
    )


def get_public_s3_client():
    """Client used only to sign download URLs the browser will call directly.

    In Docker, s3_endpoint is the internal hostname (e.g. http://minio:9000),
    which the browser can't resolve. s3_public_endpoint is the host-reachable
    address used to sign presigned URLs so they work from outside the network.
    """
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_public_endpoint,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
        config=Config(signature_version="s3v4"),
    )


_bucket_ready = False


def ensure_bucket():
    global _bucket_ready
    if _bucket_ready:
        return
    client = get_s3_client()
    try:
        client.head_bucket(Bucket=settings.s3_bucket)
    except Exception:
        client.create_bucket(Bucket=settings.s3_bucket)
    # Versioning is required by spec section 13 ("verziózott tárolás") and
    # protects the daily mirror snapshot from silently propagating deletes.
    # Only needs doing once per process, not on every upload.
    client.put_bucket_versioning(
        Bucket=settings.s3_bucket,
        VersioningConfiguration={"Status": "Enabled"},
    )
    _bucket_ready = True


@router.get("/{project_id}/documents", response_model=list[DocumentResponse])
def list_documents(
    project_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return (
        db.query(Document)
        .filter(Document.project_id == project_id)
        .order_by(Document.created_at.desc())
        .all()
    )


def _content_disposition(filename: str) -> str:
    # Hungarian filenames routinely contain accented characters (Szerződés.pdf),
    # which the plain ASCII `filename=` parameter can't represent and which
    # could otherwise smuggle a stray `"` into the header. Provide both an
    # ASCII-safe fallback and the RFC 6266 UTF-8 form for browsers that use it.
    ascii_fallback = re.sub(r'[^\x20-\x7e]', "_", filename).replace('"', "'")
    encoded = quote(filename, safe="")
    return f'attachment; filename="{ascii_fallback}"; filename*=UTF-8\'\'{encoded}'


@router.get("/{project_id}/documents/{document_id}/download")
def download_document(
    project_id: int,
    document_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    doc = db.query(Document).filter(
        Document.id == document_id, Document.project_id == project_id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    client = get_public_s3_client()
    url = client.generate_presigned_url(
        "get_object",
        Params={
            "Bucket": settings.s3_bucket,
            "Key": doc.s3_key,
            "ResponseContentDisposition": _content_disposition(doc.original_filename),
        },
        ExpiresIn=300,
    )
    return {"url": url}


@router.delete("/{project_id}/documents/{document_id}")
def delete_document(
    project_id: int,
    document_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    doc = db.query(Document).filter(
        Document.id == document_id, Document.project_id == project_id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    client = get_s3_client()
    try:
        client.delete_object(Bucket=settings.s3_bucket, Key=doc.s3_key)
    except Exception:
        pass
    db.delete(doc)
    db.commit()
    return {"ok": True}


@router.post("/{project_id}/documents", response_model=DocumentResponse)
async def upload_document(
    project_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = db.query(Project).get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    ext = "." + file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type not allowed: {ext}")

    content = await file.read()
    ensure_bucket()
    key = f"projects/{project_id}/{uuid.uuid4()}{ext}"

    existing = (
        db.query(Document)
        .filter(Document.project_id == project_id, Document.original_filename == file.filename)
        .order_by(Document.version.desc())
        .first()
    )
    version = (existing.version + 1) if existing else 1

    client = get_s3_client()
    client.put_object(
        Bucket=settings.s3_bucket,
        Key=key,
        Body=content,
        ContentType=file.content_type or "application/octet-stream",
    )

    doc = Document(
        project_id=project_id,
        filename=key.split("/")[-1],
        original_filename=file.filename or "unknown",
        content_type=file.content_type or "application/octet-stream",
        file_size=len(content),
        s3_key=key,
        version=version,
        uploaded_by_id=user.id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc
