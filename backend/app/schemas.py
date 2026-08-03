from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field

from app.models import (
    ActivityCategory,
    ActivityStatus,
    BuildingType,
    DocumentationSubtype,
    NotificationType,
    ProjectStatus,
    UserRole,
)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    username: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class UserCreate(BaseModel):
    username: str
    email: EmailStr
    full_name: str
    password: str
    role: UserRole = UserRole.PROJECT_MANAGER


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    full_name: str
    role: UserRole
    is_active: bool
    has_avatar: bool = False

    model_config = {"from_attributes": True}


class ProjectCreate(BaseModel):
    name: str
    # Auto-generated from building_type when omitted (see
    # services/numbering.py::generate_project_code) — still overridable.
    project_code: Optional[str] = None
    settlement: str
    address: str
    lot_number: Optional[str] = None
    client_name: str
    client_phone: Optional[str] = None
    client_email: Optional[EmailStr] = None
    client_phone_2: Optional[str] = None
    client_email_2: Optional[EmailStr] = None
    building_type: BuildingType = BuildingType.LIGHT_STEEL
    floor_area_sqm: float
    delivery_date: date
    status: ProjectStatus = ProjectStatus.PLANNING
    project_manager_id: Optional[int] = None
    site_manager_id: Optional[int] = None
    procurement_id: Optional[int] = None
    billing_id: Optional[int] = None
    subcontractors: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    status_text: Optional[str] = None
    waiting_deadline: Optional[date] = None
    planning_deadline: Optional[date] = None
    foundation_deadline: Optional[date] = None
    structure_deadline: Optional[date] = None
    exterior_done_deadline: Optional[date] = None
    turnkey_deadline: Optional[date] = None
    with_schedule: bool = True


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    settlement: Optional[str] = None
    address: Optional[str] = None
    lot_number: Optional[str] = None
    client_name: Optional[str] = None
    client_phone: Optional[str] = None
    client_email: Optional[EmailStr] = None
    client_phone_2: Optional[str] = None
    client_email_2: Optional[EmailStr] = None
    building_type: Optional[BuildingType] = None
    floor_area_sqm: Optional[float] = None
    delivery_date: Optional[date] = None
    status: Optional[ProjectStatus] = None
    project_manager_id: Optional[int] = None
    site_manager_id: Optional[int] = None
    procurement_id: Optional[int] = None
    billing_id: Optional[int] = None
    subcontractors: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    status_text: Optional[str] = None
    waiting_deadline: Optional[date] = None
    planning_deadline: Optional[date] = None
    foundation_deadline: Optional[date] = None
    structure_deadline: Optional[date] = None
    exterior_done_deadline: Optional[date] = None
    turnkey_deadline: Optional[date] = None


class ProjectCard(BaseModel):
    id: int
    name: str
    project_code: str
    settlement: str
    client_name: str
    building_type: BuildingType
    floor_area_sqm: float
    status: ProjectStatus
    delivery_date: date
    completion_percent: float
    project_manager_name: Optional[str] = None
    site_manager_name: Optional[str] = None
    has_thumbnail: bool = False
    is_favorite: bool = False
    health: str = "ok"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    waiting_deadline: Optional[date] = None
    planning_deadline: Optional[date] = None
    foundation_deadline: Optional[date] = None
    structure_deadline: Optional[date] = None
    exterior_done_deadline: Optional[date] = None
    turnkey_deadline: Optional[date] = None

    model_config = {"from_attributes": True}


class ProjectDetail(ProjectCard):
    delay_risk: str = "ok"
    delay_risk_reason: str = ""
    address: str
    lot_number: Optional[str] = None
    client_phone: Optional[str] = None
    client_email: Optional[str] = None
    client_phone_2: Optional[str] = None
    client_email_2: Optional[str] = None
    project_manager_id: Optional[int] = None
    site_manager_id: Optional[int] = None
    procurement_id: Optional[int] = None
    procurement_name: Optional[str] = None
    billing_id: Optional[int] = None
    billing_name: Optional[str] = None
    subcontractors: Optional[str] = None
    status_text: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class ActivityResponse(BaseModel):
    id: int
    name: str
    duration_days: int
    prep_days: int
    responsible_role: UserRole
    assignee_id: Optional[int] = None
    assignee_name: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    prep_date: Optional[date] = None
    status: ActivityStatus
    is_active: bool = True
    sort_order: int = 0
    prerequisite_ids: list[int] = []
    category: ActivityCategory = ActivityCategory.OTHER
    documentation_subtype: Optional[DocumentationSubtype] = None
    notes: Optional[str] = None
    status_text: Optional[str] = None
    reminder_date: Optional[date] = None

    model_config = {"from_attributes": True}


class ActivityCreate(BaseModel):
    name: str
    duration_days: int
    prep_days: int = 14
    responsible_role: UserRole = UserRole.PROJECT_MANAGER
    assignee_id: Optional[int] = None
    category: ActivityCategory = ActivityCategory.OTHER
    documentation_subtype: Optional[DocumentationSubtype] = None
    notes: Optional[str] = None
    status_text: Optional[str] = None
    reminder_date: Optional[date] = None


class ActivityUpdate(BaseModel):
    name: Optional[str] = None
    duration_days: Optional[int] = None
    prep_days: Optional[int] = None
    responsible_role: Optional[UserRole] = None
    assignee_id: Optional[int] = None
    status: Optional[ActivityStatus] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None
    category: Optional[ActivityCategory] = None
    documentation_subtype: Optional[DocumentationSubtype] = None
    notes: Optional[str] = None
    status_text: Optional[str] = None
    reminder_date: Optional[date] = None


class DependencyCreate(BaseModel):
    prerequisite_id: int


class ActivityTemplateResponse(BaseModel):
    id: int
    name: str
    duration_days: int
    sort_order: int
    default_prep_days: int
    responsible_role: UserRole
    prerequisite_template_ids: list[int] = []
    include_by_default: bool = True
    category: ActivityCategory = ActivityCategory.OTHER
    documentation_subtype: Optional[DocumentationSubtype] = None

    model_config = {"from_attributes": True}


class ActivityTemplateCreate(BaseModel):
    name: str
    duration_days: int
    default_prep_days: int = 14
    responsible_role: UserRole = UserRole.PROJECT_MANAGER
    include_by_default: bool = True
    category: ActivityCategory = ActivityCategory.OTHER
    documentation_subtype: Optional[DocumentationSubtype] = None


class ActivityTemplateUpdate(BaseModel):
    name: Optional[str] = None
    duration_days: Optional[int] = None
    default_prep_days: Optional[int] = None
    responsible_role: Optional[UserRole] = None
    sort_order: Optional[int] = None
    include_by_default: Optional[bool] = None
    category: Optional[ActivityCategory] = None
    documentation_subtype: Optional[DocumentationSubtype] = None


class ActivityTemplateIncludeAll(BaseModel):
    include_by_default: bool


class TemplateDependencyCreate(BaseModel):
    prerequisite_template_id: int


class PrepTaskItem(BaseModel):
    project_id: int
    project_name: str
    client_name: str
    activity_id: int
    activity_name: str
    prep_date: Optional[date]
    start_date: Optional[date]
    responsible_role: UserRole
    status: ActivityStatus
    status_text: Optional[str] = None
    reminder_date: Optional[date] = None
    is_overdue: bool
    days_until: Optional[int] = None


class TaskBoardItem(BaseModel):
    activity_id: int
    activity_name: str
    status: ActivityStatus
    responsible_role: UserRole
    duration_days: int
    category: ActivityCategory = ActivityCategory.OTHER
    documentation_subtype: Optional[DocumentationSubtype] = None
    notes: Optional[str] = None
    status_text: Optional[str] = None
    reminder_date: Optional[date] = None
    assignee_id: Optional[int] = None
    assignee_name: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    prep_date: Optional[date] = None
    project_id: int
    project_name: str
    project_code: str
    client_name: str
    settlement: str
    delivery_date: date
    project_status: ProjectStatus
    project_manager_name: Optional[str] = None
    site_manager_name: Optional[str] = None
    has_thumbnail: bool = False


class UserBrief(BaseModel):
    id: int
    full_name: str
    role: UserRole

    model_config = {"from_attributes": True}


class WeeklyWorkloadItem(BaseModel):
    week_start: date
    activity_count: int


class DashboardStats(BaseModel):
    overdue_tasks: int
    upcoming_prep_7d: int
    upcoming_prep_14d: int
    slipping_projects: int
    total_projects: int
    on_time_delivery_pct: float
    handovers_this_month: int
    open_prep_tasks_total: int
    weekly_workload: list[WeeklyWorkloadItem] = []


class AuditLogResponse(BaseModel):
    id: int
    user_id: int
    user_name: Optional[str] = None
    project_id: Optional[int]
    project_name: Optional[str] = None
    entity_type: str
    entity_id: Optional[int] = None
    field_name: str
    old_value: Optional[str]
    new_value: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class DocumentResponse(BaseModel):
    id: int
    filename: str
    original_filename: str
    content_type: str
    file_size: int
    version: int
    created_at: datetime

    model_config = {"from_attributes": True}


class PhotoResponse(BaseModel):
    id: int
    filename: str
    content_type: str
    file_size: int
    taken_at: date
    comment: Optional[str] = None
    uploaded_by_name: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class DigestPreview(BaseModel):
    overdue: list[PrepTaskItem]
    upcoming: list[PrepTaskItem]


class NotificationResponse(BaseModel):
    id: int
    type: NotificationType
    title: str
    body: str
    related_project_id: Optional[int] = None
    related_project_name: Optional[str] = None
    created_at: datetime
    read_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
