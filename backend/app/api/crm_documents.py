import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.api import documents as documents_api
from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.models_crm import CrmDocument, CrmDocumentLink, CrmDocumentType
from app.schemas_crm import CrmDocumentResponse

router = APIRouter(prefix="/crm/documents", tags=["crm-documents"])

MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50 MB
ALLOWED_EXTENSIONS = {".pdf", ".dwg", ".xlsx", ".docx", ".jpg", ".jpeg", ".png"}
S3_PREFIX = "crm"


@router.get("", response_model=list[CrmDocumentResponse])
def list_documents(
    entity_type: str,
    entity_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    doc_ids = (
        db.query(CrmDocumentLink.document_id)
        .filter(CrmDocumentLink.entity_type == entity_type, CrmDocumentLink.entity_id == entity_id)
        .scalar_subquery()
    )
    return (
        db.query(CrmDocument)
        .filter(CrmDocument.id.in_(doc_ids))
        .order_by(CrmDocument.created_at.desc())
        .all()
    )


@router.post("", response_model=CrmDocumentResponse)
async def upload_document(
    entity_type: str = Form(...),
    entity_id: int = Form(...),
    document_type: CrmDocumentType = Form(CrmDocumentType.OTHER),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ext = "." + file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type not allowed: {ext}")
    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 50 MB)")

    documents_api.ensure_bucket()
    key = f"{S3_PREFIX}/{entity_type}/{entity_id}/{uuid.uuid4()}{ext}"
    client = documents_api.get_s3_client()
    client.put_object(
        Bucket=settings.s3_bucket,
        Key=key,
        Body=content,
        ContentType=file.content_type or "application/octet-stream",
    )

    doc = CrmDocument(
        filename=key.split("/")[-1],
        original_filename=file.filename or "unknown",
        content_type=file.content_type or "application/octet-stream",
        file_size=len(content),
        s3_key=key,
        document_type=document_type,
        uploaded_by_id=user.id,
    )
    db.add(doc)
    db.flush()
    db.add(CrmDocumentLink(document_id=doc.id, entity_type=entity_type, entity_id=entity_id))
    db.commit()
    db.refresh(doc)
    return doc


@router.post("/{document_id}/link")
def link_document(
    document_id: int,
    entity_type: str = Form(...),
    entity_id: int = Form(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    doc = db.query(CrmDocument).filter(CrmDocument.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Dokumentum nem található")
    existing = (
        db.query(CrmDocumentLink)
        .filter(
            CrmDocumentLink.document_id == document_id,
            CrmDocumentLink.entity_type == entity_type,
            CrmDocumentLink.entity_id == entity_id,
        )
        .first()
    )
    if not existing:
        db.add(CrmDocumentLink(document_id=document_id, entity_type=entity_type, entity_id=entity_id))
        db.commit()
    return {"ok": True}


@router.delete("/{document_id}/link")
def unlink_document(
    document_id: int,
    entity_type: str,
    entity_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    db.query(CrmDocumentLink).filter(
        CrmDocumentLink.document_id == document_id,
        CrmDocumentLink.entity_type == entity_type,
        CrmDocumentLink.entity_id == entity_id,
    ).delete()
    db.commit()
    return {"ok": True}


@router.get("/{document_id}/download")
def download_document(
    document_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    doc = db.query(CrmDocument).filter(CrmDocument.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Dokumentum nem található")
    client = documents_api.get_public_s3_client()
    url = client.generate_presigned_url(
        "get_object",
        Params={
            "Bucket": settings.s3_bucket,
            "Key": doc.s3_key,
            "ResponseContentDisposition": documents_api._content_disposition(doc.original_filename),
        },
        ExpiresIn=300,
    )
    return {"url": url}


@router.delete("/{document_id}")
def delete_document(
    document_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    doc = db.query(CrmDocument).filter(CrmDocument.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Dokumentum nem található")
    client = documents_api.get_s3_client()
    try:
        client.delete_object(Bucket=settings.s3_bucket, Key=doc.s3_key)
    except Exception:
        pass
    db.delete(doc)
    db.commit()
    return {"ok": True}
