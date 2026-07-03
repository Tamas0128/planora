from tests.conftest import create_project, create_user, login


def test_dashboard_stats_counts_overdue_and_total(client, admin_headers):
    project = create_project(client, admin_headers, delivery_date="2026-12-01")
    resp = client.get("/api/dashboard/stats", headers=admin_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_projects"] == 1
    assert isinstance(data["overdue_tasks"], int)
    assert project["id"]


def test_audit_logs_forbidden_for_procurement(client, admin_headers):
    create_user(client, admin_headers, "proc1", "procurement")
    headers = login(client, "proc1")
    resp = client.get("/api/audit-logs", headers=headers)
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
