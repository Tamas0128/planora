from sqlalchemy.orm import Session

from app.models import Activity, Project, User, UserRole


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
