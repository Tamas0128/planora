from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.models import (
    Activity,
    ActivityDependency,
    ActivityTemplate,
    ActivityTemplateDependency,
    Project,
)


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
    from app.models import UserRole

    name_to_template: dict[str, ActivityTemplate] = {}
    for i, item in enumerate(DEFAULT_ACTIVITIES):
        role = UserRole.PROJECT_MANAGER
        if item.get("role") == "procurement":
            role = UserRole.PROCUREMENT
        tmpl = ActivityTemplate(
            name=item["name"],
            duration_days=item["duration_days"],
            sort_order=i,
            default_prep_days=14,
            responsible_role=role,
        )
        db.add(tmpl)
        name_to_template[item["name"]] = tmpl
    db.flush()

    for item in DEFAULT_ACTIVITIES:
        if "deps" not in item:
            continue
        tmpl = name_to_template[item["name"]]
        for dep_name in item["deps"]:
            prereq = name_to_template.get(dep_name)
            if prereq:
                db.add(
                    ActivityTemplateDependency(
                        template_id=tmpl.id,
                        prerequisite_template_id=prereq.id,
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
    template_id_to_activity: dict[int, Activity] = {}
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
        template_id_to_activity[tmpl.id] = activity
    db.flush()

    template_deps = (
        db.query(ActivityTemplateDependency)
        .filter(ActivityTemplateDependency.template_id.in_(template_id_to_activity.keys()))
        .all()
    )
    for dep in template_deps:
        activity = template_id_to_activity.get(dep.template_id)
        prereq = template_id_to_activity.get(dep.prerequisite_template_id)
        if activity and prereq:
            db.add(
                ActivityDependency(
                    activity_id=activity.id,
                    prerequisite_id=prereq.id,
                )
            )
    db.flush()
    return activities


def cascade_from_activity(db: Session, project: Project, changed_activity: Activity) -> None:
    """After manually setting start_date on changed_activity, recompute its end_date/prep_date
    and forward-propagate only to transitively dependent activities.
    """
    from datetime import timedelta

    all_activities = (
        db.query(Activity)
        .filter(Activity.project_id == project.id)
        .all()
    )
    all_deps = (
        db.query(ActivityDependency)
        .filter(ActivityDependency.activity_id.in_([a.id for a in all_activities]))
        .all()
    )
    successors: dict[int, set[int]] = {a.id: set() for a in all_activities}
    predecessors: dict[int, set[int]] = {a.id: set() for a in all_activities}
    for dep in all_deps:
        successors[dep.prerequisite_id].add(dep.activity_id)
        predecessors[dep.activity_id].add(dep.prerequisite_id)

    # BFS: find all activities reachable from changed_activity via successor edges
    affected: set[int] = set()
    bfs_queue = list(successors.get(changed_activity.id, set()))
    while bfs_queue:
        node = bfs_queue.pop()
        if node in affected:
            continue
        affected.add(node)
        bfs_queue.extend(successors.get(node, set()))

    # Recompute changed_activity's own end_date and prep_date
    if changed_activity.start_date:
        changed_activity.end_date = add_workdays(changed_activity.start_date, changed_activity.duration_days - 1)
        changed_activity.prep_date = subtract_workdays(changed_activity.start_date, changed_activity.prep_days)

    activity_map = {a.id: a for a in all_activities}
    end_date_map: dict[int, object] = {a.id: a.end_date for a in all_activities}
    end_date_map[changed_activity.id] = changed_activity.end_date

    # Topological sort of affected nodes (Kahn's algorithm)
    in_degree: dict[int, int] = {aid: 0 for aid in affected}
    for aid in affected:
        for pred_id in predecessors.get(aid, set()):
            if pred_id in affected:
                in_degree[aid] += 1

    topo_queue = [aid for aid in affected if in_degree[aid] == 0]
    topo_order: list[int] = []
    while topo_queue:
        node = topo_queue.pop(0)
        topo_order.append(node)
        for succ_id in successors.get(node, set()):
            if succ_id in affected:
                in_degree[succ_id] -= 1
                if in_degree[succ_id] == 0:
                    topo_queue.append(succ_id)

    # Propagate forward: only push start dates forward, never pull them back
    for act_id in topo_order:
        act = activity_map[act_id]
        pred_ends = [end_date_map[pid] for pid in predecessors.get(act_id, set()) if end_date_map.get(pid)]
        if not pred_ends:
            end_date_map[act_id] = act.end_date
            continue
        latest_pred_end = max(pred_ends)  # type: ignore[type-var]
        candidate_start = latest_pred_end + timedelta(days=1)  # type: ignore[operator]
        while not is_workday(candidate_start):  # type: ignore[arg-type]
            candidate_start += timedelta(days=1)
        if act.start_date is None or candidate_start > act.start_date:
            act.start_date = candidate_start
            act.end_date = add_workdays(candidate_start, act.duration_days - 1)
            act.prep_date = subtract_workdays(candidate_start, act.prep_days)
        end_date_map[act_id] = act.end_date

    db.flush()


def recalculate_schedule(db: Session, project: Project) -> None:
    # Load activities in ascending sort_order (0 = first in sequence, last = final).
    # Inactive activities are excluded entirely — treated as if they don't
    # exist for date computation and completion_percent.
    activities = (
        db.query(Activity)
        .filter(Activity.project_id == project.id, Activity.is_active.is_(True))
        .order_by(Activity.sort_order)
        .all()
    )
    if not activities:
        return

    # Load all dependency edges in one query
    all_deps = (
        db.query(ActivityDependency)
        .filter(ActivityDependency.activity_id.in_([a.id for a in activities]))
        .all()
    )
    # successor_map[id] = set of activity IDs that list id as a prerequisite
    successor_map: dict[int, set[int]] = {a.id: set() for a in activities}
    for dep in all_deps:
        successor_map[dep.prerequisite_id].add(dep.activity_id)

    activity_map = {a.id: a for a in activities}
    start_dates: dict[int, date] = {}
    end_dates: dict[int, date] = {}

    # BACKWARD SCHEDULING: process from last activity to first (reversed sort_order).
    # Each activity ends as late as possible:
    #   - activities with no successors use the rolling slot (which starts at delivery_date)
    #   - activities whose successors have explicit dependency constraints end just
    #     before the earliest successor starts
    # The slot cursor advances backward after each activity so sequentially ordered
    # activities tile backward from the delivery date without gaps.
    slot = project.delivery_date

    for activity in reversed(activities):
        succ_ids = successor_map.get(activity.id, set())
        processed_succs = [sid for sid in succ_ids if sid in start_dates]

        if processed_succs:
            # Must finish before the earliest successor starts
            earliest_succ_start = min(start_dates[sid] for sid in processed_succs)
            activity.end_date = subtract_workdays(earliest_succ_start, 1)
        else:
            # No explicit successor constraint — use sequential slot
            activity.end_date = slot

        activity.start_date = subtract_workdays(activity.end_date, activity.duration_days - 1)
        activity.prep_date = subtract_workdays(activity.start_date, activity.prep_days)
        start_dates[activity.id] = activity.start_date
        end_dates[activity.id] = activity.end_date

        # Advance the slot past this activity's start for the next (earlier) activity
        slot = subtract_workdays(activity.start_date, 1)

    done_count = sum(1 for a in activities if a.status.value == "done")
    project.completion_percent = round((done_count / len(activities)) * 100, 1)
    db.flush()
