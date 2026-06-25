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
