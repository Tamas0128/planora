from datetime import date, timedelta

from tests.conftest import TestingSessionLocal, create_project

# A fixed literal date (e.g. "2027-01-01") eventually stops being "safely far
# in the future" as real time passes — the default activity template's
# combined duration (~100 workdays across all activities, see
# services/schedule_engine.py's DEFAULT_ACTIVITIES) needs enough runway
# between project creation and delivery for every auto-generated activity's
# prep_date to land after today, or these "healthy project" tests start
# seeing a false "overdue prep" and flip from ok/warning to warning/critical.
# Computed relative to date.today() so this file doesn't rot again.
FAR_FUTURE_DELIVERY_DATE = (date.today() + timedelta(days=730)).isoformat()


def _set_activity_status(db, project_id, index, status, prep_date=None):
    from app.models import Activity

    activity = (
        db.query(Activity)
        .filter(Activity.project_id == project_id)
        .order_by(Activity.sort_order)
        .offset(index)
        .first()
    )
    activity.status = status
    if prep_date is not None:
        activity.prep_date = prep_date
    db.commit()


def test_healthy_project_is_ok(client, admin_headers):
    project = create_project(client, admin_headers, delivery_date=FAR_FUTURE_DELIVERY_DATE)
    listing = client.get("/api/projects", headers=admin_headers).json()
    card = next(p for p in listing if p["id"] == project["id"])
    assert card["health"] == "ok"


def test_blocked_activity_makes_project_critical(client, admin_headers):
    from app.models import ActivityStatus

    project = create_project(client, admin_headers, delivery_date=FAR_FUTURE_DELIVERY_DATE)
    db = TestingSessionLocal()
    try:
        _set_activity_status(db, project["id"], 0, ActivityStatus.BLOCKED)
    finally:
        db.close()
    listing = client.get("/api/projects", headers=admin_headers).json()
    card = next(p for p in listing if p["id"] == project["id"])
    assert card["health"] == "critical"


def test_late_project_is_critical(client, admin_headers):
    project = create_project(client, admin_headers, delivery_date="2024-01-01")
    listing = client.get("/api/projects", headers=admin_headers).json()
    card = next(p for p in listing if p["id"] == project["id"])
    assert card["health"] == "critical"


def test_few_overdue_preps_is_warning(client, admin_headers):
    from app.models import ActivityStatus

    project = create_project(client, admin_headers, delivery_date=FAR_FUTURE_DELIVERY_DATE)
    db = TestingSessionLocal()
    try:
        overdue = date.today() - timedelta(days=1)
        _set_activity_status(db, project["id"], 0, ActivityStatus.PENDING, prep_date=overdue)
    finally:
        db.close()
    listing = client.get("/api/projects", headers=admin_headers).json()
    card = next(p for p in listing if p["id"] == project["id"])
    assert card["health"] == "warning"


def test_delay_risk_ok_for_healthy_project(client, admin_headers):
    project = create_project(client, admin_headers, delivery_date=FAR_FUTURE_DELIVERY_DATE)
    detail = client.get(f"/api/projects/{project['id']}", headers=admin_headers).json()
    assert detail["delay_risk"] == "ok"
    assert "nem mutat" in detail["delay_risk_reason"]


def test_delay_risk_critical_for_late_project_with_reason(client, admin_headers):
    project = create_project(client, admin_headers, delivery_date="2024-01-01")
    detail = client.get(f"/api/projects/{project['id']}", headers=admin_headers).json()
    assert detail["delay_risk"] == "critical"
    assert "határidő" in detail["delay_risk_reason"]


def test_delay_risk_warning_for_few_overdue_preps(client, admin_headers):
    from app.models import ActivityStatus

    project = create_project(client, admin_headers, delivery_date=FAR_FUTURE_DELIVERY_DATE)
    db = TestingSessionLocal()
    try:
        overdue = date.today() - timedelta(days=1)
        _set_activity_status(db, project["id"], 0, ActivityStatus.PENDING, prep_date=overdue)
    finally:
        db.close()
    detail = client.get(f"/api/projects/{project['id']}", headers=admin_headers).json()
    assert detail["delay_risk"] == "warning"
    assert "előkészítés" in detail["delay_risk_reason"]
