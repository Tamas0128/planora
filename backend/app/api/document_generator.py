import logging
import uuid
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session, joinedload, selectinload

from app.api import documents as documents_api
from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import BuildingType, Project, User, UserRole
from app.models_crm import Contract
from app.models_documents import (
    DocumentFamily,
    DocumentTemplate,
    GeneratedDocument,
    GeneratedDocumentStatus,
    TigDocumentSubtype,
)
from app.models_finance import SubcontractorContract, Tig
from app.schemas_documents import (
    DocumentTemplateResponse,
    DocumentTemplateUpdate,
    GeneratedDocumentCreate,
    GeneratedDocumentResponse,
)
from app.services.audit import log_change
from app.services.document_generation import (
    build_client_contract_context,
    build_subcontractor_contract_context,
    build_tig_context,
    convert_to_pdf,
    render_docx,
)
from app.services.document_templates import NoActiveTemplateError, TemplateNotFoundError, select_template
from app.services.scoping import can_view_project, scoped_contract_query

router = APIRouter(tags=["document-generator"])

logger = logging.getLogger("planora.document_generator")

TEMPLATE_ALLOWED_EXTENSIONS = {".docx"}
TEMPLATE_MAX_BYTES = 20 * 1024 * 1024  # 20 MB
S3_PREFIX = "document-generator"


def _can_generate_for_project(user: User, project: Project) -> bool:
    """TIG / alvállalkozói szerződés dokumentumgenerálás jogosultsága — a
    finance.py::_can_edit_tig mintája (pénzügyi szerepkör, vagy a projekt
    saját PM-je), külön másolva mert finance.py-ban privát (_-prefixű).
    """
    if user.role in (UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.BILLING):
        return True
    return user.role == UserRole.PROJECT_MANAGER and project.project_manager_id == user.id


def _to_response(doc: GeneratedDocument) -> GeneratedDocumentResponse:
    resp = GeneratedDocumentResponse.model_validate(doc)
    resp.has_pdf = doc.pdf_s3_key is not None
    return resp


# --- Admin template management ------------------------------------------


@router.get("/document-templates", response_model=list[DocumentTemplateResponse])
def list_document_templates(
    family: Optional[DocumentFamily] = None,
    active_only: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Any authenticated user can list templates (metadata only, no s3_key in
    # the response) — needed so the generate-document dialog can offer a
    # manual template picker to whoever is allowed to generate, not just
    # admins. Creating/editing templates stays admin-only below.
    q = db.query(DocumentTemplate)
    if family:
        q = q.filter(DocumentTemplate.family == family)
    if active_only:
        q = q.filter(DocumentTemplate.is_active.is_(True))
    return q.order_by(DocumentTemplate.family, DocumentTemplate.doc_subtype).all()


@router.post("/document-templates", response_model=DocumentTemplateResponse)
async def create_document_template(
    family: DocumentFamily = Form(...),
    doc_subtype: TigDocumentSubtype = Form(TigDocumentSubtype.NORMAL),
    building_type: Optional[BuildingType] = Form(None),
    is_delay_variant: bool = Form(False),
    name: str = Form(...),
    input_schema: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN)),
):
    ext = "." + file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else ""
    if ext not in TEMPLATE_ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Csak .docx sablon tölthető fel")
    content = await file.read()
    if len(content) > TEMPLATE_MAX_BYTES:
        raise HTTPException(status_code=413, detail="A sablon túl nagy (max 20 MB)")

    documents_api.ensure_bucket()
    key = f"{S3_PREFIX}/templates/{uuid.uuid4()}{ext}"
    client = documents_api.get_s3_client()
    client.put_object(
        Bucket=settings.s3_bucket,
        Key=key,
        Body=content,
        ContentType=file.content_type or "application/octet-stream",
    )

    existing = (
        db.query(DocumentTemplate)
        .filter(
            DocumentTemplate.family == family,
            DocumentTemplate.doc_subtype == doc_subtype,
            DocumentTemplate.building_type == building_type,
            DocumentTemplate.is_delay_variant == is_delay_variant,
        )
        .order_by(DocumentTemplate.version.desc())
        .first()
    )
    template = DocumentTemplate(
        family=family,
        doc_subtype=doc_subtype,
        building_type=building_type,
        is_delay_variant=is_delay_variant,
        name=name,
        input_schema=input_schema,
        s3_key=key,
        version=(existing.version + 1) if existing else 1,
        uploaded_by_id=user.id,
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    log_change(db, user, "document_template", "TEMPLATE_UPDATE", None, template.name, None, template.id)
    db.commit()
    return template


@router.patch("/document-templates/{template_id}", response_model=DocumentTemplateResponse)
def update_document_template(
    template_id: int,
    body: DocumentTemplateUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN)),
):
    template = db.query(DocumentTemplate).get(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Sablon nem található")
    updates = body.model_dump(exclude_unset=True)
    for field_name, value in updates.items():
        setattr(template, field_name, value)
    if updates:
        log_change(
            db, user, "document_template", "TEMPLATE_UPDATE", None, ",".join(updates.keys()), None, template.id
        )
    db.commit()
    db.refresh(template)
    return template


# --- Generation ------------------------------------------------------------


def _convert_and_store_pdf_background(generated_document_id: int) -> None:
    # Deferred import, re-resolved at call time — same reason
    # services/geocoding.py::geocode_project_in_background does this rather
    # than importing SessionLocal at module load: tests monkeypatch
    # "app.database.SessionLocal" to redirect background-task DB access to
    # the test database, which only works if the name is looked up fresh on
    # each call rather than bound once at import time.
    from app.database import SessionLocal

    db = SessionLocal()
    try:
        doc = db.query(GeneratedDocument).get(generated_document_id)
        if not doc:
            return
        try:
            client = documents_api.get_s3_client()
            docx_obj = client.get_object(Bucket=settings.s3_bucket, Key=doc.docx_s3_key)
            docx_bytes = docx_obj["Body"].read()
            pdf_bytes = convert_to_pdf(docx_bytes)
            pdf_key = doc.docx_s3_key.rsplit(".", 1)[0] + ".pdf"
            client.put_object(
                Bucket=settings.s3_bucket, Key=pdf_key, Body=pdf_bytes, ContentType="application/pdf"
            )
        except Exception:
            # Covers S3 fetch/put failures too, not just PdfConversionError —
            # any failure here must still flip status to FAILED, otherwise
            # the frontend's "pending" poll loop spins forever with no way
            # for the user to learn generation failed.
            logger.exception("PDF generation failed for generated_document_id=%s", generated_document_id)
            doc.status = GeneratedDocumentStatus.FAILED
            db.commit()
            return
        doc.pdf_s3_key = pdf_key
        doc.status = GeneratedDocumentStatus.READY
        db.commit()
    finally:
        db.close()


@router.post("/generated-documents", response_model=GeneratedDocumentResponse)
def generate_document(
    body: GeneratedDocumentCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project: Optional[Project] = None
    building_type: Optional[BuildingType] = None
    doc_subtype = TigDocumentSubtype.NORMAL
    delay_reason = None
    context: dict

    if body.family == DocumentFamily.TIG:
        tig = (
            db.query(Tig)
            .options(
                joinedload(Tig.project).joinedload(Project.customer),
                joinedload(Tig.partner),
                joinedload(Tig.subcontractor_contract),
                selectinload(Tig.subcontractor_invoices),
            )
            .filter(Tig.id == body.source_id)
            .first()
        )
        if not tig:
            raise HTTPException(status_code=404, detail="TIG nem található")
        project = tig.project
        if not _can_generate_for_project(user, project):
            raise HTTPException(status_code=403, detail="Access denied")
        building_type = project.building_type
        doc_subtype = body.doc_subtype
        delay_reason = body.delay_reason if doc_subtype == TigDocumentSubtype.NORMAL else None
        context = build_tig_context(project, tig, delay_reason)

    elif body.family == DocumentFamily.SUBCONTRACTOR_CONTRACT:
        sc_contract = (
            db.query(SubcontractorContract)
            .options(
                joinedload(SubcontractorContract.project),
                joinedload(SubcontractorContract.partner),
                joinedload(SubcontractorContract.own_company),
            )
            .filter(SubcontractorContract.id == body.source_id)
            .first()
        )
        if not sc_contract:
            raise HTTPException(status_code=404, detail="Alvállalkozói szerződés nem található")
        project = sc_contract.project
        if not _can_generate_for_project(user, project):
            raise HTTPException(status_code=403, detail="Access denied")
        building_type = project.building_type
        context = build_subcontractor_contract_context(sc_contract, sc_contract.partner, project)

    elif body.family == DocumentFamily.CLIENT_CONTRACT:
        contract = (
            scoped_contract_query(db, user)
            .options(joinedload(Contract.customer), joinedload(Contract.own_company))
            .filter(Contract.id == body.source_id)
            .first()
        )
        if not contract:
            raise HTTPException(status_code=404, detail="Szerződés nem található")
        customer = contract.customer
        # A customer shouldn't normally have more than one project, but
        # nothing enforces that at the DB layer — order explicitly so the
        # pick is deterministic (most recently created) rather than
        # whatever order Postgres happens to return.
        project = (
            db.query(Project)
            .filter(Project.customer_id == customer.id)
            .order_by(Project.created_at.desc())
            .first()
        )
        building_type = project.building_type if project else None
        context = build_client_contract_context(contract, customer, project)

    else:
        raise HTTPException(status_code=400, detail="Ismeretlen dokumentumcsalád")

    try:
        template = select_template(
            db, body.family, doc_subtype, building_type, project, override_template_id=body.template_id
        )
    except TemplateNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except NoActiveTemplateError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    if body.template_id is not None and body.family == DocumentFamily.TIG:
        # A manually-picked template can carry a different doc_subtype than
        # what the form requested (e.g. a Helyesbítő template chosen while
        # Altípus=Normál) — align the persisted value with the template
        # that's actually rendered, not the request, so the document list
        # and audit trail never disagree with the generated content. Only
        # doc_subtype is corrected here, not delay_reason/context — the
        # context dict (and CSUSZAS_INDOKLAS inside it) was already built
        # above from the original doc_subtype, and that's what the docx
        # actually renders; the template just may or may not reference it.
        doc_subtype = template.doc_subtype

    client = documents_api.get_s3_client()
    template_obj = client.get_object(Bucket=settings.s3_bucket, Key=template.s3_key)
    template_bytes = template_obj["Body"].read()
    docx_bytes = render_docx(template_bytes, context)

    documents_api.ensure_bucket()
    project_segment = str(project.id) if project else "no-project"
    docx_key = f"{S3_PREFIX}/generated/{project_segment}/{uuid.uuid4()}.docx"
    client.put_object(
        Bucket=settings.s3_bucket,
        Key=docx_key,
        Body=docx_bytes,
        ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )

    existing_count = (
        db.query(GeneratedDocument)
        .filter(GeneratedDocument.family == body.family, GeneratedDocument.source_id == body.source_id)
        .count()
    )
    doc = GeneratedDocument(
        family=body.family,
        source_id=body.source_id,
        project_id=project.id if project else None,
        template_id=template.id,
        doc_subtype=doc_subtype,
        delay_reason=delay_reason,
        status=GeneratedDocumentStatus.PENDING,
        docx_s3_key=docx_key,
        version=existing_count + 1,
        generated_by_id=user.id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    log_change(
        db, user, "generated_document", "DOC_GENERATE", None, body.family.value, doc.project_id, doc.id
    )
    db.commit()

    background_tasks.add_task(_convert_and_store_pdf_background, doc.id)
    return _to_response(doc)


# --- Listing -----------------------------------------------------------


@router.get("/projects/{project_id}/generated-documents", response_model=list[GeneratedDocumentResponse])
def list_project_generated_documents(
    project_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = db.query(Project).get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not can_view_project(user, project):
        raise HTTPException(status_code=403, detail="Access denied")
    docs = (
        db.query(GeneratedDocument)
        .filter(GeneratedDocument.project_id == project_id)
        .order_by(GeneratedDocument.created_at.desc())
        .all()
    )
    return [_to_response(d) for d in docs]


@router.get(
    "/crm/customers/{customer_id}/generated-documents", response_model=list[GeneratedDocumentResponse]
)
def list_customer_generated_documents(
    customer_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    contract_ids = [
        c.id for c in scoped_contract_query(db, user).filter(Contract.customer_id == customer_id).all()
    ]
    if not contract_ids:
        return []
    docs = (
        db.query(GeneratedDocument)
        .filter(
            GeneratedDocument.family == DocumentFamily.CLIENT_CONTRACT,
            GeneratedDocument.source_id.in_(contract_ids),
        )
        .order_by(GeneratedDocument.created_at.desc())
        .all()
    )
    return [_to_response(d) for d in docs]


# --- Download / delete ---------------------------------------------------


@router.get("/generated-documents/{doc_id}/download")
def download_generated_document(
    doc_id: int,
    format: str = "pdf",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    doc = db.query(GeneratedDocument).get(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Dokumentum nem található")
    if doc.project_id:
        project = db.query(Project).get(doc.project_id)
        if project and not can_view_project(user, project):
            raise HTTPException(status_code=403, detail="Access denied")
    elif doc.family == DocumentFamily.CLIENT_CONTRACT:
        contract = scoped_contract_query(db, user).filter(Contract.id == doc.source_id).first()
        if not contract:
            raise HTTPException(status_code=403, detail="Access denied")

    if format == "docx":
        key = doc.docx_s3_key
    elif format == "pdf":
        if not doc.pdf_s3_key:
            raise HTTPException(status_code=409, detail="A PDF még nem áll készen")
        key = doc.pdf_s3_key
    else:
        raise HTTPException(status_code=400, detail="Ismeretlen formátum")

    client = documents_api.get_public_s3_client()
    filename = f"dokumentum_{doc.id}.{format}"
    url = client.generate_presigned_url(
        "get_object",
        Params={
            "Bucket": settings.s3_bucket,
            "Key": key,
            "ResponseContentDisposition": documents_api._content_disposition(filename),
        },
        ExpiresIn=300,
    )
    return {"url": url}


@router.delete("/generated-documents/{doc_id}")
def delete_generated_document(
    doc_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN)),
):
    doc = db.query(GeneratedDocument).get(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Dokumentum nem található")
    client = documents_api.get_s3_client()
    for key in (doc.docx_s3_key, doc.pdf_s3_key):
        if key:
            try:
                client.delete_object(Bucket=settings.s3_bucket, Key=key)
            except Exception:
                logger.exception(
                    "Failed to delete S3 object key=%s for generated_document_id=%s — object may be orphaned",
                    key, doc.id,
                )
    log_change(
        db, user, "generated_document", "DOC_DELETE", None, doc.family.value, doc.project_id, doc.id
    )
    db.delete(doc)
    db.commit()
    return {"ok": True}
