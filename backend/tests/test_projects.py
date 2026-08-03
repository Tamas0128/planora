from tests.conftest import create_project, create_user, login


def test_create_project_generates_schedule(client, admin_headers):
    project = create_project(client, admin_headers)
    activities = client.get(
        f"/api/projects/{project['id']}/activities", headers=admin_headers
    ).json()
    assert len(activities) == 24
    assert all(a["start_date"] and a["end_date"] for a in activities)
    assert project["completion_percent"] == 0.0


def test_chimney_activity_depends_on_roofing_and_tinwork(client, admin_headers):
    project = create_project(client, admin_headers)
    activities = client.get(
        f"/api/projects/{project['id']}/activities", headers=admin_headers
    ).json()
    by_name = {a["name"]: a for a in activities}
    chimney = by_name["Kémény szerelés"]
    prereq_names = {by_name_lookup["name"] for by_name_lookup in activities if by_name_lookup["id"] in chimney["prerequisite_ids"]}
    assert prereq_names == {"Bádogos munkák", "Tetőfedés"}
    # chimney must start after both prerequisites finish
    roofing_end = by_name["Tetőfedés"]["end_date"]
    tinwork_end = by_name["Bádogos munkák"]["end_date"]
    assert chimney["start_date"] > max(roofing_end, tinwork_end)


def test_get_project_includes_participant_fields(client, admin_headers):
    site_manager = create_user(client, admin_headers, "sitemgr1", "project_manager")
    project = create_project(client, admin_headers, site_manager_id=site_manager["id"])
    detail = client.get(f"/api/projects/{project['id']}", headers=admin_headers).json()
    assert detail["site_manager_id"] == site_manager["id"]
    assert detail["site_manager_name"] == site_manager["full_name"]


def test_update_project_writes_audit_log(client, admin_headers):
    project = create_project(client, admin_headers)
    resp = client.patch(
        f"/api/projects/{project['id']}",
        json={"subcontractors": "ACME Kft."},
        headers=admin_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["subcontractors"] == "ACME Kft."

    logs = client.get("/api/audit-logs", headers=admin_headers).json()
    matching = [l for l in logs if l["field_name"] == "subcontractors"]
    assert len(matching) == 1
    assert matching[0]["new_value"] == "ACME Kft."
    assert matching[0]["user_name"] == "Rendszergazda"
    assert matching[0]["project_name"] == project["name"]


def test_project_code_auto_generated_from_building_type(client, admin_headers):
    body = {
        "name": "Auto Code Teszt", "settlement": "Budapest", "address": "Teszt utca 1",
        "client_name": "Teszt Ügyfél", "floor_area_sqm": 100, "delivery_date": "2026-12-01",
        "building_type": "clt",
    }
    resp = client.post("/api/projects", json=body, headers=admin_headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["project_code"].startswith("CLT-")

    body["building_type"] = "light_steel"
    resp2 = client.post("/api/projects", json=body, headers=admin_headers)
    assert resp2.json()["project_code"].startswith("LTF-")

    body["building_type"] = "timber_frame"
    resp3 = client.post("/api/projects", json=body, headers=admin_headers)
    assert resp3.json()["project_code"].startswith("BEAM-")


def test_project_code_still_overridable_at_creation(client, admin_headers):
    project = create_project(client, admin_headers, project_code="MANUAL-CODE-1")
    assert project["project_code"] == "MANUAL-CODE-1"


def test_project_code_auto_generation_is_unique(client, admin_headers):
    body = {
        "name": "Unique Code Teszt", "settlement": "Budapest", "address": "Teszt utca 1",
        "client_name": "Teszt Ügyfél", "floor_area_sqm": 100, "delivery_date": "2026-12-01",
        "building_type": "clt",
    }
    codes = set()
    for _ in range(3):
        resp = client.post("/api/projects", json=body, headers=admin_headers)
        assert resp.status_code == 200
        codes.add(resp.json()["project_code"])
    assert len(codes) == 3


def test_project_status_text_is_optional_free_text(client, admin_headers):
    project = create_project(client, admin_headers)
    assert project["status_text"] is None

    resp = client.patch(
        f"/api/projects/{project['id']}",
        json={"status_text": "Anyagbeszerzés csúszik egy hetet"},
        headers=admin_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["status_text"] == "Anyagbeszerzés csúszik egy hetet"


def test_closing_project_requires_privileged_role(client, admin_headers):
    site_manager = create_user(client, admin_headers, "sitemgrclose", "site_manager")
    project = create_project(client, admin_headers, site_manager_id=site_manager["id"])
    site_headers = login(client, "sitemgrclose")

    # site_manager can otherwise edit their own project, but not close it.
    resp = client.patch(
        f"/api/projects/{project['id']}", json={"status_text": "ok"}, headers=site_headers
    )
    assert resp.status_code == 200
    resp2 = client.patch(
        f"/api/projects/{project['id']}", json={"status": "closed"}, headers=site_headers
    )
    assert resp2.status_code == 403

    resp3 = client.patch(
        f"/api/projects/{project['id']}", json={"status": "closed"}, headers=admin_headers
    )
    assert resp3.status_code == 200
    assert resp3.json()["status"] == "closed"


def test_kanban_board_hides_closed_column_for_non_privileged_roles(client, admin_headers):
    site_manager = create_user(client, admin_headers, "sitemgrkanban", "site_manager")
    project = create_project(client, admin_headers, site_manager_id=site_manager["id"])
    client.patch(f"/api/projects/{project['id']}", json={"status": "closed"}, headers=admin_headers)

    admin_board = client.get("/api/projects/kanban", headers=admin_headers).json()
    assert "closed" in admin_board

    site_headers = login(client, "sitemgrkanban")
    site_board = client.get("/api/projects/kanban", headers=site_headers).json()
    assert "closed" not in site_board


def test_project_phase_deadlines_round_trip(client, admin_headers):
    project = create_project(client, admin_headers)
    assert project["foundation_deadline"] is None

    resp = client.patch(
        f"/api/projects/{project['id']}",
        json={"status": "foundation", "foundation_deadline": "2026-09-01"},
        headers=admin_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["foundation_deadline"] == "2026-09-01"


def test_project_manager_only_sees_own_projects(client, admin_headers):
    pm = create_user(client, admin_headers, "pmscope", "project_manager")
    own_project = create_project(client, admin_headers, project_manager_id=pm["id"])
    other_project = create_project(client, admin_headers)

    pm_headers = login(client, "pmscope")
    visible = client.get("/api/projects", headers=pm_headers).json()
    assert [p["id"] for p in visible] == [own_project["id"]]

    own = client.get(f"/api/projects/{own_project['id']}", headers=pm_headers)
    assert own.status_code == 200

    forbidden = client.get(f"/api/projects/{other_project['id']}", headers=pm_headers)
    assert forbidden.status_code == 403


def test_delete_project_with_dependencies_and_documents(client, admin_headers):
    import io

    project = create_project(client, admin_headers)
    activities = client.get(
        f"/api/projects/{project['id']}/activities", headers=admin_headers
    ).json()
    a, b = activities[0], activities[1]
    client.post(
        f"/api/projects/{project['id']}/activities/{b['id']}/dependencies",
        json={"prerequisite_id": a["id"]},
        headers=admin_headers,
    )
    client.post(
        f"/api/projects/{project['id']}/documents",
        files={"file": ("doc.pdf", io.BytesIO(b"%PDF-1.4"), "application/pdf")},
        headers=admin_headers,
    )

    resp = client.delete(f"/api/projects/{project['id']}", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["deleted"] == project["name"]

    assert client.get(f"/api/projects/{project['id']}", headers=admin_headers).status_code == 404

    # audit trail for the project survives, just unlinked from the (now gone) project
    logs = client.get("/api/audit-logs", headers=admin_headers).json()
    deleted_entries = [l for l in logs if l["field_name"] == "deleted" and l["entity_type"] == "project"]
    assert any(l["old_value"] == project["name"] for l in deleted_entries)


def test_delete_project_forbidden_for_other_pm(client, admin_headers):
    owner = create_user(client, admin_headers, "ownerpm", "project_manager")
    other = create_user(client, admin_headers, "otherpm", "project_manager")
    project = create_project(client, admin_headers, project_manager_id=owner["id"])

    other_headers = login(client, "otherpm")
    resp = client.delete(f"/api/projects/{project['id']}", headers=other_headers)
    assert resp.status_code == 403


def test_update_without_delivery_date_change_skips_recalculation(client, admin_headers, monkeypatch):
    import app.api.projects as projects_module

    project = create_project(client, admin_headers, delivery_date="2026-12-01")
    calls = []
    monkeypatch.setattr(
        projects_module,
        "recalculate_schedule",
        lambda db, p: calls.append(p.id),
    )

    resp = client.patch(
        f"/api/projects/{project['id']}",
        json={"subcontractors": "ACME Kft.", "delivery_date": project["delivery_date"]},
        headers=admin_headers,
    )
    assert resp.status_code == 200
    assert calls == []

    resp2 = client.patch(
        f"/api/projects/{project['id']}",
        json={"delivery_date": "2027-02-01"},
        headers=admin_headers,
    )
    assert resp2.status_code == 200
    assert calls == [project["id"]]


def test_changing_delivery_date_recalculates_schedule(client, admin_headers):
    project = create_project(client, admin_headers, delivery_date="2026-12-01")
    before = client.get(
        f"/api/projects/{project['id']}/activities", headers=admin_headers
    ).json()
    last_activity_before = max(a["end_date"] for a in before)

    client.patch(
        f"/api/projects/{project['id']}",
        json={"delivery_date": "2027-01-15"},
        headers=admin_headers,
    )
    after = client.get(
        f"/api/projects/{project['id']}/activities", headers=admin_headers
    ).json()
    last_activity_after = max(a["end_date"] for a in after)
    assert last_activity_after > last_activity_before
