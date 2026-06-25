from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field

from app.models import ActivityStatus, BuildingType, ProjectStatus, UserRole


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    username: str
    password: str


class UserCreate(BaseModel):
    username: str
    email: EmailStr
    full_name: str
    password: str
    role: UserRole = UserRole.PROJECT_MANAGER


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    full_name: str
    role: UserRole
    is_active: bool

    model_config = {"from_attributes": True}


class ProjectCreate(BaseModel):
    name: str
    project_code: str
    settlement: str
    address: str
    lot_number: Optional[str] = None
    client_name: str
    client_phone: Optional[str] = None
    client_email: Optional[EmailStr] = None
    building_type: BuildingType = BuildingType.LIGHT_STEEL
    floor_area_sqm: float
    delivery_date: date
    status: ProjectStatus = ProjectStatus.PLANNING
    project_manager_id: Optional[int] = None
    site_manager_id: Optional[int] = None
    procurement_id: Optional[int] = None
    billing_id: Optional[int] = None
    subcontractors: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    settlement: Optional[str] = None
    address: Optional[str] = None
    lot_number: Optional[str] = None
    client_name: Optional[str] = None
    client_phone: Optional[str] = None
    client_email: Optional[EmailStr] = None
    building_type: Optional[BuildingType] = None
    floor_area_sqm: Optional[float] = None
    delivery_date: Optional[date] = None
    status: Optional[ProjectStatus] = None
    project_manager_id: Optional[int] = None
    site_manager_id: Optional[int] = None
    procurement_id: Optional[int] = None
    billing_id: Optional[int] = None
    subcontractors: Optional[str] = None


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

    model_config = {"from_attributes": True}


class ProjectDetail(ProjectCard):
    address: str
    lot_number: Optional[str] = None
    client_phone: Optional[str] = None
    client_email: Optional[str] = None
    procurement_id: Optional[int] = None
    billing_id: Optional[int] = None
    subcontractors: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class ActivityResponse(BaseModel):
    id: int
    name: str
    duration_days: int
    prep_days: int
    responsible_role: UserRole
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    prep_date: Optional[date] = None
    status: ActivityStatus
    prerequisite_ids: list[int] = []

    model_config = {"from_attributes": True}


class ActivityUpdate(BaseModel):
    duration_days: Optional[int] = None
    prep_days: Optional[int] = None
    status: Optional[ActivityStatus] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class DependencyCreate(BaseModel):
    prerequisite_id: int


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
    is_overdue: bool
    days_until: Optional[int] = None


class DashboardStats(BaseModel):
    overdue_tasks: int
    upcoming_prep_7d: int
    upcoming_prep_14d: int
    slipping_projects: int
    total_projects: int


class AuditLogResponse(BaseModel):
    id: int
    user_id: int
    project_id: Optional[int]
    entity_type: str
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
