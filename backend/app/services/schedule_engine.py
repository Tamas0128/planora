from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.models import Activity, ActivityDependency, ActivityTemplate, Project


DEFAULT_ACTIVITIES: list[dict] = [
    {"name": "Terület rendezése", "duration_days": 2, "role": "project_manager"},
    {"name": "Fogadószint építése", "duration_days": 15, "role": "project_manager"},
    {"name": "Daruzás", "duration_days": 5, "role": "project_manager"},
    {"name": "Bádogos munkák", "duration_days": 3, "role": "project_manager"},
    {"name": "Tetőfedés", "duration_days": 6, "role": "project_manager"},
    {"name": "Kémény szerelés", "duration_days": 3, "role": "project_manager", "deps": ["Bádogos munkák", "Tetőfedés"]},
    {"name": "Külső nyílászárók", "duration_days": 5, "role": "project_manager"},
    {"name": "Villanyszerelési alapszerelés", "duration_days": 5, "role": "project_manager"},
    {"name": "Gépészeti alapszerelés", "duration_days": 5, "role": "project_manager"},
    {"name": "Padlószigetelés", "duration_days": 7, "role": "project_manager"},
    {"name": "Padlófűtés szerelés", "duration_days": 4, "role": "project_manager"},
    {"name": "Nyomáspróba", "duration_days": 2, "role": "project_manager"},
    {"name": "Estrich készítés", "duration_days": 2, "role": "project_manager"},
    {"name": "Falak kifújása", "duration_days": 2, "role": "project_manager"},
    {"name": "Gipszkartonozás", "duration_days": 4, "role": "project_manager"},
    {"name": "Vakolás/Glettelés", "duration_days": 3, "role": "project_manager"},
    {"name": "Festés", "duration_days": 1, "role": "project_manager"},
    {"name": "Gépészeti szerelések", "duration_days": 4, "role": "project_manager"},
    {"name": "Villanyszerelések", "duration_days": 2, "role": "project_manager"},
    {"name": "Burkolás", "duration_days": 5, "role": "project_manager"},
    {"name": "Végfestés", "duration_days": 1, "role": "project_manager"},
    {"name": "Terasz építés", "duration_days": 5, "role": "project_manager"},
    {"name": "Épület szigetelés", "duration_days": 3, "role": "project_manager"},
    {"name": "Épület színezés", "duration_days": 8, "role": "project_manager"},
]

ROLE_MAP = {
    "admin": "admin",
    "project_manager": "project_manager",
    "management": "management",
    "procurement": "procurement",
    "billing": "billing",
}


def is_workday(d: date) -> bool:
    return d.weekday() < 5


def subtract_workdays(end: date, days: int) -> date:
    if days <= 0:
        return end
    current = end
    remaining = days
    while remaining > 0:
        current -= timedelta(days=1)
        if is_workday(current):
            remaining -= 1
    return current


def add_workdays(start: date, days: int) -> date:
    if days <= 0:
        return start
    current = start
    remaining = days - 1
    while remaining > 0:
        current += timedelta(days=1)
        if is_workday(current):
            remaining -= 1
    return current


def seed_activity_templates(db: Session) -> None:
    if db.query(ActivityTemplate).count() > 0:
        return
    for i, item in enumerate(DEFAULT_ACTIVITIES):
        from app.models import UserRole

        role = UserRole.PROJECT_MANAGER
        if item.get("role") == "procurement":
            role = UserRole.PROCUREMENT
        db.add(
            ActivityTemplate(
                name=item["name"],
                duration_days=item["duration_days"],
                sort_order=i,
                default_prep_days=14,
                responsible_role=role,
            )
        )
    db.commit()


def create_project_activities(db: Session, project: Project) -> list[Activity]:
    templates = (
        db.query(ActivityTemplate).order_by(ActivityTemplate.sort_order).all()
    )
    if not templates:
        seed_activity_templates(db)
        templates = (
            db.query(ActivityTemplate).order_by(ActivityTemplate.sort_order).all()
        )

    activities: list[Activity] = []
    for tmpl in templates:
        activity = Activity(
            project_id=project.id,
            template_id=tmpl.id,
            name=tmpl.name,
            duration_days=tmpl.duration_days,
            sort_order=tmpl.sort_order,
            prep_days=tmpl.default_prep_days,
            responsible_role=tmpl.responsible_role,
        )
        db.add(activity)
        activities.append(activity)
    db.flush()

    name_to_activity = {a.name: a for a in activities}
    for item in DEFAULT_ACTIVITIES:
        if "deps" not in item:
            continue
        activity = name_to_activity.get(item["name"])
        if not activity:
            continue
        for dep_name in item["deps"]:
            prereq = name_to_activity.get(dep_name)
            if prereq:
                db.add(
                    ActivityDependency(
                        activity_id=activity.id,
                        prerequisite_id=prereq.id,
                    )
                )
    db.flush()
    return activities


def recalculate_schedule(db: Session, project: Project) -> None:
    activities = (
        db.query(Activity)
        .filter(Activity.project_id == project.id)
        .order_by(Activity.sort_order.desc())
        .all()
    )
    if not activities:
        return

    activity_map = {a.id: a for a in activities}
    end_dates: dict[int, date] = {}

    for activity in activities:
        deps = (
            db.query(ActivityDependency)
            .filter(ActivityDependency.activity_id == activity.id)
            .all()
        )
        if deps:
            latest_end = max(
                end_dates.get(d.prerequisite_id, project.delivery_date)
                for d in deps
            )
            activity_end = add_workdays(latest_end, 1)
            activity_end = add_workdays(activity_end, activity.duration_days - 1)
        else:
            activity_end = subtract_workdays(
                project.delivery_date, activity.duration_days - 1
            )

        activity_start = subtract_workdays(activity_end, activity.duration_days - 1)
        activity.start_date = activity_start
        activity.end_date = activity_end
        activity.prep_date = subtract_workdays(activity_start, activity.prep_days)
        end_dates[activity.id] = activity_end

    done_count = sum(1 for a in activities if a.status.value == "done")
    project.completion_percent = round((done_count / len(activities)) * 100, 1)
    db.flush()
