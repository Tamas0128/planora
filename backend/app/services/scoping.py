from sqlalchemy import false
from sqlalchemy.orm import Session

from app.models import Activity, Project, User, UserRole
from app.models_crm import CommunicationEvent, Contract, CrmTask, Customer, Quote


def scoped_activity_query(db: Session, user: User):
    """Base Activity+Project query restricted to what `user` is allowed to see.

    Admin/management see everything, project managers see their own
    projects' activities, procurement/billing see activities assigned to
    their role. Shared by the prep-center/my-tasks endpoints and the daily
    email digest so the scoping rules can't drift apart between them.
    """
    q = (
        db.query(Activity, Project)
        .join(Project, Activity.project_id == Project.id)
        .filter(Activity.is_active.is_(True))
    )
    if user.role == UserRole.PROJECT_MANAGER:
        q = q.filter(Project.project_manager_id == user.id)
    elif user.role == UserRole.SITE_MANAGER:
        q = q.filter(Project.site_manager_id == user.id)
    elif user.role in (UserRole.PROCUREMENT, UserRole.BILLING, UserRole.SUBCONTRACTOR):
        q = q.filter(Activity.responsible_role == user.role)
    return q


def scoped_customer_query(db: Session, user: User):
    """Base Customer query restricted to what `user` is allowed to see —
    and, since every CRM write endpoint (create/update communications,
    relations, quotes, tasks) also uses this as its "can I touch this
    customer" gate via each file's own `_visible_customer` helper, this is
    effectively an EDIT scope too, not just read. Do not broaden this for a
    role that should stay read-only — add a dedicated read-only variant
    instead (see scoped_customer_query_readonly below).

    Mirrors scoped_activity_query's shape but for the CRM role mapping in
    docs/CRM_modul_fejlesztesi_terv.md 11.1: admin/management see everything,
    PROJECT_MANAGER ("Értékesítő") and SITE_MANAGER ("Ügyintéző") see only
    customers they own. Every other role (BILLING/PROCUREMENT/SUBCONTRACTOR)
    has no general customer visibility — BILLING's CRM access is limited to
    contracts, scoped separately in crm_contracts.py.
    """
    q = db.query(Customer)
    if user.role in (UserRole.ADMIN, UserRole.MANAGEMENT):
        return q
    if user.role in (UserRole.PROJECT_MANAGER, UserRole.SITE_MANAGER):
        return q.filter(Customer.owner_id == user.id)
    return q.filter(false())


def scoped_customer_query_readonly(db: Session, user: User):
    """Same as scoped_customer_query, plus BILLING can view (never write)
    every customer — so it can navigate to the contracts it already has
    full unscoped access to via scoped_contract_query, since a contract has
    no standalone page, only a tab on its customer's detail page. Only wire
    this into GET (list/detail/export) endpoints; every write endpoint must
    keep using scoped_customer_query so BILLING can't create/edit CRM
    records it merely has read access to browse.
    """
    if user.role == UserRole.BILLING:
        return db.query(Customer)
    return scoped_customer_query(db, user)


def scoped_quote_query(db: Session, user: User):
    """Quote has no owner of its own — visibility follows its Customer's
    owner, same "owner-chain" pattern as documents.py's project access check.
    """
    q = db.query(Quote).join(Customer, Quote.customer_id == Customer.id)
    if user.role in (UserRole.ADMIN, UserRole.MANAGEMENT):
        return q
    if user.role in (UserRole.PROJECT_MANAGER, UserRole.SITE_MANAGER):
        return q.filter(Customer.owner_id == user.id)
    return q.filter(false())


def scoped_contract_query(db: Session, user: User):
    """Contract has no owner of its own — visibility follows its Customer's
    owner. BILLING ("Operáció") sees ALL contracts, unscoped — per
    docs/CRM_modul_fejlesztesi_terv.md 11.2, its CRM access is contracts-only
    but not owner-restricted within that.
    """
    q = db.query(Contract).join(Customer, Contract.customer_id == Customer.id)
    if user.role in (UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.BILLING):
        return q
    if user.role in (UserRole.PROJECT_MANAGER, UserRole.SITE_MANAGER):
        return q.filter(Customer.owner_id == user.id)
    return q.filter(false())


def scoped_communication_event_query(db: Session, user: User):
    """CommunicationEvent has no owner of its own — visibility follows its
    Customer's owner, same owner-chain pattern as scoped_quote_query.
    """
    q = db.query(CommunicationEvent).join(Customer, CommunicationEvent.customer_id == Customer.id)
    if user.role in (UserRole.ADMIN, UserRole.MANAGEMENT):
        return q
    if user.role in (UserRole.PROJECT_MANAGER, UserRole.SITE_MANAGER):
        return q.filter(Customer.owner_id == user.id)
    return q.filter(false())


def _has_subcontractor_activity(project: Project) -> bool:
    """A SUBCONTRACTOR-role user only "works on" a project if it has at
    least one active Activity assigned to their role — same role-class
    match scoped_activity_query already uses, not a per-individual link
    (there's no Activity->specific-subcontractor-user FK in this system).
    """
    return any(
        a.responsible_role == UserRole.SUBCONTRACTOR and a.is_active for a in project.activities
    )


def can_view_project(user: User, project: Project) -> bool:
    if user.role in (UserRole.ADMIN, UserRole.MANAGEMENT):
        return True
    if user.role == UserRole.PROJECT_MANAGER:
        return project.project_manager_id == user.id
    if user.role == UserRole.SITE_MANAGER:
        return project.site_manager_id == user.id
    if user.role == UserRole.SUBCONTRACTOR:
        return _has_subcontractor_activity(project)
    return True


def can_edit_project(user: User, project: Project) -> bool:
    if user.role in (UserRole.ADMIN, UserRole.MANAGEMENT):
        return True
    if user.role == UserRole.PROJECT_MANAGER:
        return project.project_manager_id == user.id
    if user.role == UserRole.SITE_MANAGER:
        return project.site_manager_id == user.id
    return False


def scoped_crm_task_query(db: Session, user: User):
    """CrmTask carries its own owner_id (the assignee), unlike Quote/Contract/
    CommunicationEvent — visibility is by direct assignment rather than by the
    parent Customer's owner. Mirrors crm_tasks.py's list_tasks: admin/
    management see everything, everyone else only tasks assigned to them.
    """
    q = db.query(CrmTask)
    if user.role in (UserRole.ADMIN, UserRole.MANAGEMENT):
        return q
    return q.filter(CrmTask.owner_id == user.id)
