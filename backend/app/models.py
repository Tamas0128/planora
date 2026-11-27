import enum
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    event,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.orm.attributes import get_history

from app.database import Base
from app.models_finance import VatType


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    PROJECT_MANAGER = "project_manager"
    MANAGEMENT = "management"
    PROCUREMENT = "procurement"
    BILLING = "billing"
    SITE_MANAGER = "site_manager"
    SUBCONTRACTOR = "subcontractor"


class ProjectStatus(str, enum.Enum):
    WAITING = "waiting"
    PLANNING = "planning"
    FOUNDATION = "foundation"
    STRUCTURE = "structure"
    EXTERIOR_DONE = "exterior_done"
    TURNKEY = "turnkey"
    # Terminal, manually-triggered status — a separate "Lezárás" action, not a
    # kanban column everyone drags into (admin/management/project_manager
    # only, see projects.py's close_project endpoint).
    CLOSED = "closed"


class BuildingType(str, enum.Enum):
    LIGHT_STEEL = "light_steel"
    CLT = "clt"
    TIMBER_FRAME = "timber_frame"
    OTHER = "other"


class ActivityStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    DONE = "done"
    BLOCKED = "blocked"


class ActivityCategory(str, enum.Enum):
    FOUNDATION = "foundation"
    TIMBER_FRAME = "timber_frame"
    ROOFING = "roofing"
    EXTERIOR_OPENINGS = "exterior_openings"
    ELECTRICAL = "electrical"
    MECHANICAL = "mechanical"
    INSULATION = "insulation"
    FLOORING = "flooring"
    INTERIOR = "interior"
    FINISHING = "finishing"
    FACADE = "facade"
    LANDSCAPING = "landscaping"
    PROCUREMENT = "procurement"
    PLANNING = "planning"
    DOCUMENTATION = "documentation"
    OTHER = "other"


class DocumentationSubtype(str, enum.Enum):
    CONTRACT = "contract"
    PURCHASE_ORDER = "purchase_order"
    COMPLETION_CERTIFICATE = "completion_certificate"
    INVOICE = "invoice"
    PLAN = "plan"
    LETTER_OF_INTENT = "letter_of_intent"


PROJECT_STATUS_LABELS = {
    ProjectStatus.WAITING: "Várakozik",
    ProjectStatus.PLANNING: "Tervezés alatt",
    ProjectStatus.FOUNDATION: "Alapozás",
    ProjectStatus.STRUCTURE: "Szerkezetállítás",
    ProjectStatus.EXTERIOR_DONE: "Kívülről kész",
    ProjectStatus.TURNKEY: "Kulcsrakész",
    ProjectStatus.CLOSED: "Lezárva",
}

BUILDING_TYPE_LABELS = {
    BuildingType.LIGHT_STEEL: "Könnyűszerkezetes",
    BuildingType.CLT: "CLT",
    BuildingType.TIMBER_FRAME: "Gerendaház",
    BuildingType.OTHER: "Egyéb",
}


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True)
    full_name: Mapped[str] = mapped_column(String(255))
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.PROJECT_MANAGER)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    avatar_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    managed_projects: Mapped[list["Project"]] = relationship(
        back_populates="project_manager", foreign_keys="Project.project_manager_id"
    )

    @property
    def has_avatar(self) -> bool:
        return self.avatar_key is not None


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    project_code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    settlement: Mapped[str] = mapped_column(String(255))
    address: Mapped[str] = mapped_column(String(500))
    lot_number: Mapped[str | None] = mapped_column(String(100), nullable=True)

    client_name: Mapped[str] = mapped_column(String(255))
    client_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    client_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    client_phone_2: Mapped[str | None] = mapped_column(String(50), nullable=True)
    client_email_2: Mapped[str | None] = mapped_column(String(255), nullable=True)

    building_type: Mapped[BuildingType] = mapped_column(
        Enum(BuildingType), default=BuildingType.LIGHT_STEEL
    )
    floor_area_sqm: Mapped[float] = mapped_column(Float)

    status: Mapped[ProjectStatus] = mapped_column(
        Enum(ProjectStatus), default=ProjectStatus.PLANNING
    )
    delivery_date: Mapped[date] = mapped_column(Date)
    completion_percent: Mapped[float] = mapped_column(Float, default=0.0)

    # Per-phase target dates for the Projects Kanban board — set the first
    # time a card is dragged into that column (prompted if missing), not
    # required up front. Purely informational vs. the schedule engine's own
    # activity dates; nothing here drives recalculation.
    waiting_deadline: Mapped[date | None] = mapped_column(Date, nullable=True)
    planning_deadline: Mapped[date | None] = mapped_column(Date, nullable=True)
    foundation_deadline: Mapped[date | None] = mapped_column(Date, nullable=True)
    structure_deadline: Mapped[date | None] = mapped_column(Date, nullable=True)
    exterior_done_deadline: Mapped[date | None] = mapped_column(Date, nullable=True)
    turnkey_deadline: Mapped[date | None] = mapped_column(Date, nullable=True)

    project_manager_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    site_manager_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    procurement_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    billing_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    # Additive CRM link (see docs/CRM_modul_fejlesztesi_terv.md 0/6, 2.2.1):
    # only ever set by the CRM contract-signed auto-project-creation flow
    # (services/crm_project_bridge.py). The free-text client_name/
    # client_phone/client_email fields above stay untouched for every other
    # project, so nothing here can regress them.
    customer_id: Mapped[int | None] = mapped_column(
        ForeignKey("customers.id", ondelete="SET NULL"), nullable=True
    )
    subcontractors: Mapped[str | None] = mapped_column(Text, nullable=True)
    thumbnail_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Free-text status note alongside the structured `status` enum above —
    # optional, purely informational (e.g. "installer confirmed for Monday").
    status_text: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Contract net/VAT/gross — the financial module's project-level summary
    # (see models_finance.py). gross is always server-derived from net+vat_type,
    # never settable directly (services/finance.py::compute_gross).
    contract_net_value: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    contract_vat_type: Mapped[VatType | None] = mapped_column(Enum(VatType), nullable=True)
    contract_gross_value: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    project_manager: Mapped["User | None"] = relationship(
        back_populates="managed_projects", foreign_keys=[project_manager_id]
    )
    site_manager: Mapped["User | None"] = relationship(foreign_keys=[site_manager_id])
    procurement: Mapped["User | None"] = relationship(foreign_keys=[procurement_id])
    billing: Mapped["User | None"] = relationship(foreign_keys=[billing_id])
    customer: Mapped["Customer | None"] = relationship(foreign_keys=[customer_id])
    activities: Mapped[list["Activity"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    documents: Mapped[list["Document"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    photos: Mapped[list["Photo"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    audit_logs: Mapped[list["AuditLog"]] = relationship(back_populates="project")
    tigs: Mapped[list["Tig"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    subcontractor_invoices: Mapped[list["SubcontractorInvoice"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    customer_invoices: Mapped[list["CustomerInvoice"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    subcontractor_contracts: Mapped[list["SubcontractorContract"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )

    @property
    def has_thumbnail(self) -> bool:
        return self.thumbnail_key is not None


@event.listens_for(Project, "before_update")
def _clear_stale_coordinates(mapper, connection, target: Project) -> None:
    """A project's pin only makes sense for the address it was geocoded
    against — if settlement/address change in this flush and the caller
    didn't also supply new coordinates of their own, drop the now-stale pin
    so it doesn't silently point at the wrong place. Applies to ANY code
    path that mutates a loaded Project instance (not just the two API
    endpoints that happen to touch these fields today), since this runs at
    the ORM flush level rather than being duplicated per call site.
    """
    location_changed = (
        get_history(target, "settlement").has_changes()
        or get_history(target, "address").has_changes()
    )
    coords_supplied = (
        get_history(target, "latitude").has_changes()
        or get_history(target, "longitude").has_changes()
    )
    if location_changed and not coords_supplied:
        target.latitude = None
        target.longitude = None


class ActivityTemplate(Base):
    __tablename__ = "activity_templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), unique=True)
    duration_days: Mapped[int] = mapped_column(Integer)
    sort_order: Mapped[int] = mapped_column(Integer)
    default_prep_days: Mapped[int] = mapped_column(Integer, default=14)
    responsible_role: Mapped[UserRole] = mapped_column(
        Enum(UserRole), default=UserRole.PROJECT_MANAGER
    )
    include_by_default: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    category: Mapped[ActivityCategory] = mapped_column(
        Enum(ActivityCategory), default=ActivityCategory.OTHER, nullable=False
    )
    documentation_subtype: Mapped[DocumentationSubtype | None] = mapped_column(
        Enum(DocumentationSubtype), nullable=True
    )


class ActivityTemplateDependency(Base):
    __tablename__ = "activity_template_dependencies"
    __table_args__ = (
        UniqueConstraint(
            "template_id", "prerequisite_template_id", name="uq_template_prereq"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    template_id: Mapped[int] = mapped_column(
        ForeignKey("activity_templates.id", ondelete="CASCADE"), index=True
    )
    prerequisite_template_id: Mapped[int] = mapped_column(
        ForeignKey("activity_templates.id", ondelete="CASCADE"), index=True
    )


class Activity(Base):
    __tablename__ = "activities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    template_id: Mapped[int | None] = mapped_column(
        ForeignKey("activity_templates.id", ondelete="SET NULL"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(255))
    duration_days: Mapped[int] = mapped_column(Integer)
    sort_order: Mapped[int] = mapped_column(Integer)
    prep_days: Mapped[int] = mapped_column(Integer, default=14)
    responsible_role: Mapped[UserRole] = mapped_column(Enum(UserRole))
    assignee_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    prep_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[ActivityStatus] = mapped_column(
        Enum(ActivityStatus), default=ActivityStatus.PENDING
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    category: Mapped[ActivityCategory] = mapped_column(
        Enum(ActivityCategory), default=ActivityCategory.OTHER, nullable=False
    )
    documentation_subtype: Mapped[DocumentationSubtype | None] = mapped_column(
        Enum(DocumentationSubtype), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Free-text status note alongside the structured `status` enum above —
    # optional, purely informational.
    status_text: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Optional reminder date — picked up by the daily digest job the same way
    # prep_date already is (see services/notifications.py), not a separate
    # real-time scheduler.
    reminder_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    project: Mapped["Project"] = relationship(back_populates="activities")
    template: Mapped["ActivityTemplate | None"] = relationship()
    assignee: Mapped["User | None"] = relationship(foreign_keys=[assignee_id])
    prerequisites: Mapped[list["ActivityDependency"]] = relationship(
        back_populates="activity",
        foreign_keys="ActivityDependency.activity_id",
        cascade="all, delete-orphan",
    )


class ActivityDependency(Base):
    __tablename__ = "activity_dependencies"
    __table_args__ = (
        UniqueConstraint("activity_id", "prerequisite_id", name="uq_activity_prereq"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    activity_id: Mapped[int] = mapped_column(
        ForeignKey("activities.id", ondelete="CASCADE"), index=True
    )
    prerequisite_id: Mapped[int] = mapped_column(
        ForeignKey("activities.id", ondelete="CASCADE"), index=True
    )

    activity: Mapped["Activity"] = relationship(
        back_populates="prerequisites", foreign_keys=[activity_id]
    )


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    filename: Mapped[str] = mapped_column(String(500))
    original_filename: Mapped[str] = mapped_column(String(500))
    content_type: Mapped[str] = mapped_column(String(100))
    file_size: Mapped[int] = mapped_column(Integer)
    s3_key: Mapped[str] = mapped_column(String(1000))
    version: Mapped[int] = mapped_column(Integer, default=1)
    uploaded_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    project: Mapped["Project"] = relationship(back_populates="documents")


class Photo(Base):
    __tablename__ = "photos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    filename: Mapped[str] = mapped_column(String(500))
    content_type: Mapped[str] = mapped_column(String(100))
    file_size: Mapped[int] = mapped_column(Integer)
    s3_key: Mapped[str] = mapped_column(String(1000))
    taken_at: Mapped[date] = mapped_column(Date)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    uploaded_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    project: Mapped["Project"] = relationship(back_populates="photos")
    uploaded_by: Mapped["User"] = relationship()


class NotificationType(str, enum.Enum):
    OVERDUE_TASK = "overdue_task"
    UPCOMING_PREP = "upcoming_prep"
    SLIPPING_PROJECT = "slipping_project"
    CONTRACT_EXPIRING = "contract_expiring"
    TASK_REMINDER = "task_reminder"


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    type: Mapped[NotificationType] = mapped_column(Enum(NotificationType))
    title: Mapped[str] = mapped_column(String(255))
    body: Mapped[str] = mapped_column(Text)
    related_project_id: Mapped[int | None] = mapped_column(
        ForeignKey("projects.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    read_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    related_project: Mapped["Project | None"] = relationship()


class Favorite(Base):
    __tablename__ = "favorites"
    __table_args__ = (
        UniqueConstraint("user_id", "project_id", name="uq_favorite_user_project"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    project_id: Mapped[int | None] = mapped_column(
        ForeignKey("projects.id", ondelete="SET NULL"), nullable=True
    )
    entity_type: Mapped[str] = mapped_column(String(100))
    entity_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    field_name: Mapped[str] = mapped_column(String(100))
    old_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    project: Mapped["Project | None"] = relationship(back_populates="audit_logs")
    user: Mapped["User"] = relationship()
