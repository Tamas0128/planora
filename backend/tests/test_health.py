from datetime import date, timedelta

from tests.conftest import TestingSessionLocal, create_project


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
    # Delivery date must be far enough out that the backward-scheduled first
    # activity's prep_date (duration_days sum + prep_days workdays before
    # delivery) doesn't fall in the past relative to today, which would
    # spuriously trip the overdue-prep warning. See schedule_engine.py's
    # backward scheduling from delivery_date.
    delivery_date = (date.today() + timedelta(days=400)).isoformat()
    project = create_project(client, admin_headers, delivery_date=delivery_date)
    listing = client.get("/api/projects", headers=admin_headers).json()
    card = next(p for p in listing if p["id"] == project["id"])
    assert card["health"] == "ok"


def test_blocked_activity_makes_project_critical(client, admin_headers):
    from app.models import ActivityStatus

    project = create_project(client, admin_headers, delivery_date="2027-01-01")
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

    project = create_project(client, admin_headers, delivery_date="2027-01-01")
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
    delivery_date = (date.today() + timedelta(days=400)).isoformat()
    project = create_project(client, admin_headers, delivery_date=delivery_date)
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

    project = create_project(client, admin_headers, delivery_date="2027-01-01")
    db = TestingSessionLocal()
    try:
        overdue = date.today() - timedelta(days=1)
        _set_activity_status(db, project["id"], 0, ActivityStatus.PENDING, prep_date=overdue)
    finally:
        db.close()
    detail = client.get(f"/api/projects/{project['id']}", headers=admin_headers).json()
    assert detail["delay_risk"] == "warning"
    assert "előkészítés" in detail["delay_risk_reason"]
