import csv
import io
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import User, UserRole
from app.models_crm import (
    CommunicationEvent,
    Contract,
    Customer,
    CustomerRelation,
    CustomerStatus,
    CustomerType,
    CrmTask,
    Quote,
    RelationshipType,
)
from app.schemas_crm import (
    CustomerCreate,
    CustomerCreateResponse,
    CustomerImportResult,
    CustomerImportRowResult,
    CustomerResponse,
    CustomerUpdate,
)
from app.services.audit import log_change
from app.services.crm_project_bridge import ensure_project_for_customer
from app.services.numbering import next_sequence_number
from app.services.scoping import scoped_customer_query

router = APIRouter(prefix="/crm/customers", tags=["crm-customers"])

PERSON_ONLY_FIELDS = (
    "phone",
    "email",
    "tax_number",
    "billing_address",
    "mailing_address",
    "company_registry_number",
    "bank_account_number",
    "representative_name",
    "representative_title",
    "contact_name",
)
# CustomerUpdate extends ProjectCreationFields so the "Megrendelő" transition
# can carry them in the same request — but they aren't Customer columns, so
# they must never reach the generic setattr loop below.
PROJECT_FIELD_NAMES = ("project_code", "settlement", "address", "floor_area_sqm", "delivery_date", "lot_number")

CSV_FIELDNAMES = [
    "customer_number",
    "type",
    "relationship_type",
    "name",
    "status",
    "owner_id",
    "phone",
    "email",
    "tax_number",
    "billing_address",
    "mailing_address",
    "company_registry_number",
    "bank_account_number",
    "representative_name",
    "representative_title",
    "contact_name",
]


def _reject_person_contact_fields(type_: CustomerType, values: dict) -> None:
    """Enforce the BRS 6.1 rule: a PERSON customer stores no personal data
    beyond the name. API-level, not just a UI hint — see dev plan 4.1.
    """
    if type_ != CustomerType.PERSON:
        return
    offending = [f for f in PERSON_ONLY_FIELDS if values.get(f) not in (None, "")]
    if offending:
        raise HTTPException(
            status_code=422,
            detail=(
                "Magánszemély ügyfélnél kizárólag a név tárolható — "
                f"nem engedélyezett mező(k): {', '.join(offending)}"
            ),
        )


def _resolve_owner_id(user: User, requested_owner_id: Optional[int]) -> int:
    if user.role in (UserRole.ADMIN, UserRole.MANAGEMENT):
        if requested_owner_id is None:
            raise HTTPException(status_code=422, detail="owner_id kötelező")
        return requested_owner_id
    return user.id


def _has_related_records(db: Session, customer_id: int) -> bool:
    if db.query(Quote).filter(Quote.customer_id == customer_id).first():
        return True
    if db.query(Contract).filter(Contract.customer_id == customer_id).first():
        return True
    if db.query(CommunicationEvent).filter(CommunicationEvent.customer_id == customer_id).first():
        return True
    if db.query(CrmTask).filter(CrmTask.customer_id == customer_id).first():
        return True
    if (
        db.query(CustomerRelation)
        .filter(
            (CustomerRelation.company_customer_id == customer_id)
            | (CustomerRelation.person_customer_id == customer_id)
        )
        .first()
    ):
        return True
    return False


@router.get("", response_model=list[CustomerResponse])
def list_customers(
    name: Optional[str] = Query(None),
    type: Optional[CustomerType] = Query(None),
    status: Optional[CustomerStatus] = Query(None),
    owner_id: Optional[int] = Query(None),
    created_from: Optional[date] = Query(None),
    created_to: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = scoped_customer_query(db, user)
    if name:
        q = q.filter(Customer.name.ilike(f"%{name}%"))
    if type:
        q = q.filter(Customer.type == type)
    if status:
        q = q.filter(Customer.status == status)
    if owner_id:
        q = q.filter(Customer.owner_id == owner_id)
    if created_from:
        q = q.filter(Customer.created_at >= created_from)
    if created_to:
        q = q.filter(Customer.created_at <= created_to)
    return q.order_by(Customer.created_at.desc()).all()


@router.get("/export")
def export_customers(
    name: Optional[str] = Query(None),
    type: Optional[CustomerType] = Query(None),
    status: Optional[CustomerStatus] = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = scoped_customer_query(db, user)
    if name:
        q = q.filter(Customer.name.ilike(f"%{name}%"))
    if type:
        q = q.filter(Customer.type == type)
    if status:
        q = q.filter(Customer.status == status)
    customers = q.order_by(Customer.customer_number).all()

    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=CSV_FIELDNAMES)
    writer.writeheader()
    for c in customers:
        writer.writerow(
            {
                "customer_number": c.customer_number,
                "type": c.type.value,
                "relationship_type": c.relationship_type.value,
                "name": c.name,
                "status": c.status.value,
                "owner_id": c.owner_id,
                "phone": c.phone or "",
                "email": c.email or "",
                "tax_number": c.tax_number or "",
                "billing_address": c.billing_address or "",
                "mailing_address": c.mailing_address or "",
                "company_registry_number": c.company_registry_number or "",
                "bank_account_number": c.bank_account_number or "",
                "representative_name": c.representative_name or "",
                "representative_title": c.representative_title or "",
                "contact_name": c.contact_name or "",
            }
        )
    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=ugyfelek.csv"},
    )


@router.post("/import", response_model=CustomerImportResult)
def import_customers(
    file: UploadFile,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGEMENT)),
):
    raw = file.file.read().decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(raw))
    results: list[CustomerImportRowResult] = []
    for idx, row in enumerate(reader, start=2):  # header is row 1
        try:
            type_raw = (row.get("type") or "").strip()
            name = (row.get("name") or "").strip()
            owner_raw = (row.get("owner_id") or "").strip()
            if not type_raw or not name or not owner_raw:
                raise ValueError("type, name és owner_id kötelező")
            type_ = CustomerType(type_raw)
            owner_id = int(owner_raw)
            # Driven by PERSON_ONLY_FIELDS (not a hardcoded subset) so a
            # future field added there is automatically importable too,
            # instead of silently staying JSON-API-only.
            values = {field: (row.get(field) or "").strip() or None for field in PERSON_ONLY_FIELDS}
            _reject_person_contact_fields(type_, values)
            relationship_type = RelationshipType((row.get("relationship_type") or "customer").strip())
            status = CustomerStatus((row.get("status") or "new").strip())

            customer = Customer(
                customer_number=next_sequence_number(db, Customer, "customer_number", "UGY"),
                type=type_,
                relationship_type=relationship_type,
                name=name,
                status=status,
                owner_id=owner_id,
                **values,
            )
            db.add(customer)
            db.flush()
            log_change(db, user, "customer", "imported", None, customer.name, None, customer.id)
            db.commit()  # per-row commit — one bad row must not roll back earlier good ones
            results.append(
                CustomerImportRowResult(
                    row=idx, success=True, customer_number=customer.customer_number, name=name
                )
            )
        except Exception as exc:  # noqa: BLE001 — per-row isolation is the point
            db.rollback()
            results.append(CustomerImportRowResult(row=idx, success=False, error=str(exc)))
            continue
    return CustomerImportResult(results=results)


@router.post("", response_model=CustomerCreateResponse)
def create_customer(
    body: CustomerCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _reject_person_contact_fields(
        body.type,
        {field: getattr(body, field) for field in PERSON_ONLY_FIELDS},
    )
    owner_id = _resolve_owner_id(user, body.owner_id)
    duplicate = db.query(Customer).filter(Customer.name == body.name).first() is not None

    customer = Customer(
        customer_number=next_sequence_number(db, Customer, "customer_number", "UGY"),
        type=body.type,
        relationship_type=body.relationship_type,
        name=body.name,
        owner_id=owner_id,
        phone=body.phone,
        email=body.email,
        tax_number=body.tax_number,
        billing_address=body.billing_address,
        mailing_address=body.mailing_address,
        company_registry_number=body.company_registry_number,
        bank_account_number=body.bank_account_number,
        representative_name=body.representative_name,
        representative_title=body.representative_title,
        contact_name=body.contact_name,
        source=body.source,
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)
    log_change(db, user, "customer", "created", None, customer.name, None, customer.id)
    db.commit()
    return CustomerCreateResponse(
        **CustomerResponse.model_validate(customer).model_dump(),
        duplicate_name_warning=duplicate,
    )


@router.get("/{customer_id}", response_model=CustomerResponse)
def get_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    customer = scoped_customer_query(db, user).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Ügyfél nem található")
    return customer


@router.patch("/{customer_id}", response_model=CustomerResponse)
def update_customer(
    customer_id: int,
    body: CustomerUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    customer = scoped_customer_query(db, user).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Ügyfél nem található")
    all_updates = body.model_dump(exclude_unset=True)
    updates = {k: v for k, v in all_updates.items() if k not in PROJECT_FIELD_NAMES}
    effective_type = updates.get("type", customer.type)
    effective_values = {
        f: updates.get(f, getattr(customer, f)) for f in PERSON_ONLY_FIELDS
    }
    _reject_person_contact_fields(effective_type, effective_values)

    old_status = customer.status
    for field, value in updates.items():
        old_value = getattr(customer, field)
        if old_value != value:
            log_change(
                db, user, "customer", field, str(old_value), str(value), None, customer.id
            )
            setattr(customer, field, value)

    # Reaching "Megrendelő" for the first time is the pipeline's final stage
    # — auto-create the construction project (user's simplification,
    # 2026-07-31: no separate Contract-activation step needed for this).
    if updates.get("status") == CustomerStatus.ORDERED and old_status != CustomerStatus.ORDERED:
        ensure_project_for_customer(db, user, customer, body)

    db.commit()
    db.refresh(customer)
    return customer


@router.delete("/{customer_id}")
def delete_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGEMENT)),
):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Ügyfél nem található")
    if _has_related_records(db, customer_id):
        raise HTTPException(
            status_code=409,
            detail="Az ügyfél nem törölhető, mert kapcsolódó rekordja van — archiválja helyette",
        )
    log_change(db, user, "customer", "deleted", customer.name, None, None, customer_id)
    db.delete(customer)
    db.commit()
    return {"ok": True}
