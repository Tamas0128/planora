from tests.conftest import create_project, create_user, login


def test_prep_center_lists_items_for_admin(client, admin_headers):
    create_project(client, admin_headers)
    resp = client.get("/api/tasks/prep-center", headers=admin_headers)
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 24


def test_prep_center_overdue_filter(client, admin_headers):
    create_project(client, admin_headers, delivery_date="2026-01-01")
    all_items = client.get(
        "/api/tasks/prep-center?filter=all", headers=admin_headers
    ).json()
    overdue_items = client.get(
        "/api/tasks/prep-center?filter=overdue", headers=admin_headers
    ).json()
    assert len(overdue_items) <= len(all_items)
    assert all(item["is_overdue"] for item in overdue_items)


def test_my_tasks_scoped_to_procurement_role(client, admin_headers):
    create_project(client, admin_headers)
    create_user(client, admin_headers, "proctasks", "procurement")
    headers = login(client, "proctasks")
    resp = client.get("/api/tasks/my-tasks", headers=headers)
    assert resp.status_code == 200
    items = resp.json()
    assert all(item["responsible_role"] == "procurement" for item in items)


def test_my_tasks_scoped_to_own_projects_for_pm(client, admin_headers):
    pm = create_user(client, admin_headers, "pmtasks", "project_manager")
    own_project = create_project(client, admin_headers, project_manager_id=pm["id"])
    create_project(client, admin_headers)

    headers = login(client, "pmtasks")
    resp = client.get("/api/tasks/my-tasks", headers=headers).json()
    assert all(item["project_id"] == own_project["id"] for item in resp)
