from datetime import date

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import BuildingType, Project, User, UserRole
from app.models_crm import Customer
from app.schemas_crm import ProjectCreationFields
from app.services.audit import log_change
from app.services.schedule_engine import create_project_activities, recalculate_schedule


def create_project_for_customer(
    db: Session,
    user: User,
    customer: Customer,
    *,
    project_code: str,
    settlement: str,
    address: str,
    floor_area_sqm: float,
    delivery_date: date,
    building_type: BuildingType = BuildingType.LIGHT_STEEL,
    lot_number: str | None = None,
) -> Project:
    """Auto-project-creation triggered by Customer.status reaching ORDERED
    for a customer that doesn't have a project yet (replaces the earlier
    Lead->WON trigger once Lead/Opportunity were dropped from the module).

    Deliberately doesn't call the projects.py HTTP handler — that would mean
    an internal self-call. Instead reuses the same building blocks it uses
    (schedule_engine + log_change) so the two creation paths can't drift.
    Sets Project.customer_id (additive FK, dev plan 0/6, 2.2.1) in addition to
    the existing free-text client_* fields, which stay populated the same way
    manual project creation already populates them.
    """
    project = Project(
        name=f"{customer.name} — {settlement}",
        project_code=project_code,
        settlement=settlement,
        address=address,
        lot_number=lot_number,
        client_name=customer.name,
        client_phone=customer.phone,
        client_email=customer.email,
        building_type=building_type,
        floor_area_sqm=floor_area_sqm,
        delivery_date=delivery_date,
        customer_id=customer.id,
    )
    if user.role == UserRole.PROJECT_MANAGER:
        project.project_manager_id = user.id
    db.add(project)
    db.flush()
    create_project_activities(db, project)
    recalculate_schedule(db, project)
    log_change(db, user, "project", "created", None, project.name, project.id, project.id)
    return project


def ensure_project_for_customer(
    db: Session, user: User, customer: Customer, fields: ProjectCreationFields
) -> Project | None:
    """Called when Customer.status reaches ORDERED ("Megrendelő") — the
    pipeline's final stage is the "deal is won" moment (user's simplification,
    2026-07-31, replacing the earlier Contract-activation trigger). Idempotent:
    if the customer already has a project, does nothing and returns None.
    Otherwise requires the project fields and creates one.
    """
    existing = db.query(Project).filter(Project.customer_id == customer.id).first()
    if existing:
        return None
    missing = [
        f
        for f in ("project_code", "settlement", "address", "floor_area_sqm", "delivery_date")
        if getattr(fields, f) is None
    ]
    if missing:
        raise HTTPException(
            status_code=422,
            detail=f"A projekt létrehozásához hiányzó mező(k): {', '.join(missing)}",
        )
    if db.query(Project).filter(Project.project_code == fields.project_code).first():
        raise HTTPException(status_code=400, detail="Ez a projektazonosító már foglalt")
    return create_project_for_customer(
        db,
        user,
        customer,
        project_code=fields.project_code,
        settlement=fields.settlement,
        address=fields.address,
        floor_area_sqm=fields.floor_area_sqm,
        delivery_date=fields.delivery_date,
        lot_number=fields.lot_number,
    )
