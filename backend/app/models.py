import enum
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    PROJECT_MANAGER = "project_manager"
    MANAGEMENT = "management"
    PROCUREMENT = "procurement"
    BILLING = "billing"


class ProjectStatus(str, enum.Enum):
    PLANNING = "planning"
    FOUNDATION = "foundation"
    STRUCTURE = "structure"
    EXTERIOR_DONE = "exterior_done"
    TURNKEY = "turnkey"


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


PROJECT_STATUS_LABELS = {
    ProjectStatus.PLANNING: "Tervezés alatt",
    ProjectStatus.FOUNDATION: "Alapozás",
    ProjectStatus.STRUCTURE: "Szerkezetállítás",
    ProjectStatus.EXTERIOR_DONE: "Kívülről kész",
    ProjectStatus.TURNKEY: "Kulcsrakész",
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
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    managed_projects: Mapped[list["Project"]] = relationship(
        back_populates="project_manager", foreign_keys="Project.project_manager_id"
    )


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

    building_type: Mapped[BuildingType] = mapped_column(
        Enum(BuildingType), default=BuildingType.LIGHT_STEEL
    )
    floor_area_sqm: Mapped[float] = mapped_column(Float)

    status: Mapped[ProjectStatus] = mapped_column(
        Enum(ProjectStatus), default=ProjectStatus.PLANNING
    )
    delivery_date: Mapped[date] = mapped_column(Date)
    completion_percent: Mapped[float] = mapped_column(Float, default=0.0)

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
    subcontractors: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    project_manager: Mapped["User | None"] = relationship(
        back_populates="managed_projects", foreign_keys=[project_manager_id]
    )
    activities: Mapped[list["Activity"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    documents: Mapped[list["Document"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    audit_logs: Mapped[list["AuditLog"]] = relationship(back_populates="project")


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


class Activity(Base):
    __tablename__ = "activities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    template_id: Mapped[int | None] = mapped_column(
        ForeignKey("activity_templates.id"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(255))
    duration_days: Mapped[int] = mapped_column(Integer)
    sort_order: Mapped[int] = mapped_column(Integer)
    prep_days: Mapped[int] = mapped_column(Integer, default=14)
    responsible_role: Mapped[UserRole] = mapped_column(Enum(UserRole))

    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    prep_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[ActivityStatus] = mapped_column(
        Enum(ActivityStatus), default=ActivityStatus.PENDING
    )

    project: Mapped["Project"] = relationship(back_populates="activities")
    template: Mapped["ActivityTemplate | None"] = relationship()
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
    activity_id: Mapped[int] = mapped_column(ForeignKey("activities.id"), index=True)
    prerequisite_id: Mapped[int] = mapped_column(ForeignKey("activities.id"), index=True)

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


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id"), nullable=True)
    entity_type: Mapped[str] = mapped_column(String(100))
    entity_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    field_name: Mapped[str] = mapped_column(String(100))
    old_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    project: Mapped["Project | None"] = relationship(back_populates="audit_logs")
