from tests.conftest import create_project, create_user, login


def test_dashboard_stats_counts_overdue_and_total(client, admin_headers):
    project = create_project(client, admin_headers, delivery_date="2026-12-01")
    resp = client.get("/api/dashboard/stats", headers=admin_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_projects"] == 1
    assert isinstance(data["overdue_tasks"], int)
    assert project["id"]


def test_dashboard_stats_includes_new_kpi_fields(client, admin_headers):
    create_project(client, admin_headers, delivery_date="2026-12-01")
    resp = client.get("/api/dashboard/stats", headers=admin_headers).json()
    assert 0 <= resp["on_time_delivery_pct"] <= 100
    assert isinstance(resp["handovers_this_month"], int)
    assert isinstance(resp["open_prep_tasks_total"], int)
    assert len(resp["weekly_workload"]) == 4
    assert all("week_start" in w and "activity_count" in w for w in resp["weekly_workload"])


def test_on_time_delivery_pct_excludes_turnkey_and_reflects_slippage(client, admin_headers):
    create_project(client, admin_headers, delivery_date="2026-12-01", project_code="OT-1")
    late = create_project(client, admin_headers, delivery_date="2024-01-01", project_code="OT-2")
    resp = client.get("/api/dashboard/stats", headers=admin_headers).json()
    # 1 of 2 active (non-turnkey) projects is on time -> 50%
    assert resp["on_time_delivery_pct"] == 50.0
    assert late["id"]


def test_audit_logs_forbidden_for_procurement(client, admin_headers):
    # Confirmed 2026-08-12: this endpoint previously fell through with no
    # filter for any role that isn't admin/management/PM/SM — procurement,
    # billing, and subcontractor got the full, unfiltered org-wide audit
    # log. The frontend only ever hid the nav link for them; the API itself
    # had no gate. Fixed to block these roles outright rather than give them
    # a scoped view, since audit logs aren't part of their job function.
    create_project(client, admin_headers)
    create_user(client, admin_headers, "proc1", "procurement")
    headers = login(client, "proc1")
    resp = client.get("/api/audit-logs", headers=headers)
    assert resp.status_code == 403


def test_audit_logs_forbidden_for_billing_and_subcontractor(client, admin_headers):
    create_project(client, admin_headers)
    for i, role in enumerate(("billing", "subcontractor")):
        create_user(client, admin_headers, f"auditblock{i}", role)
        headers = login(client, f"auditblock{i}")
        resp = client.get("/api/audit-logs", headers=headers)
        assert resp.status_code == 403


def test_audit_logs_scoped_to_own_projects_for_project_manager(client, admin_headers):
    own = create_project(client, admin_headers, project_code="PMOWN-1")
    other = create_project(client, admin_headers, project_code="PMOTHER-1")
    create_user(client, admin_headers, "pmscope1", "project_manager")
    pm_headers = login(client, "pmscope1")
    client.patch(f"/api/projects/{own['id']}", json={"project_manager_id": None}, headers=admin_headers)
    # Assign ownership directly since only admin/management can reassign PM.
    from tests.conftest import TestingSessionLocal

    db = TestingSessionLocal()
    try:
        from app.models import Project, User

        pm_user = db.query(User).filter(User.username == "pmscope1").first()
        db.query(Project).filter(Project.id == own["id"]).update({"project_manager_id": pm_user.id})
        db.commit()
    finally:
        db.close()

    resp = client.get("/api/audit-logs", headers=pm_headers)
    assert resp.status_code == 200
    project_ids = {log["project_id"] for log in resp.json()}
    assert other["id"] not in project_ids


def test_audit_logs_forbidden_for_project_not_owned(client, admin_headers):
    other = create_project(client, admin_headers, project_code="NOACCESS-1")
    create_user(client, admin_headers, "pmscope2", "project_manager")
    pm_headers = login(client, "pmscope2")
    resp = client.get(f"/api/audit-logs?project_id={other['id']}", headers=pm_headers)
    assert resp.status_code == 403


def test_audit_logs_allowed_for_management(client, admin_headers):
    create_project(client, admin_headers)
    create_user(client, admin_headers, "mgmt1", "management")
    headers = login(client, "mgmt1")
    resp = client.get("/api/audit-logs", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


def test_disabled_activity_excluded_from_dashboard_stats(client, admin_headers):
    # delivery_date is in the past relative to "today" in this test environment,
    # so every activity's prep_date lands in the past too — all overdue.
    project = create_project(client, admin_headers, delivery_date="2026-01-01")
    activities = client.get(
        f"/api/projects/{project['id']}/activities", headers=admin_headers
    ).json()
    before = client.get("/api/dashboard/stats", headers=admin_headers).json()
    assert before["overdue_tasks"] >= 1

    overdue = next(a for a in activities if a["prep_date"])
    client.patch(
        f"/api/projects/{project['id']}/activities/{overdue['id']}",
        json={"is_active": False},
        headers=admin_headers,
    )

    after = client.get("/api/dashboard/stats", headers=admin_headers).json()
    assert after["overdue_tasks"] == before["overdue_tasks"] - 1
