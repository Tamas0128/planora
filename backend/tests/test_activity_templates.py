from tests.conftest import create_project, create_user, login


def test_list_templates_readable_by_any_role(client, admin_headers):
    create_user(client, admin_headers, "proctmpl", "procurement")
    headers = login(client, "proctmpl")
    resp = client.get("/api/activity-templates", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 24


def test_seed_dependencies_present_on_fresh_db(client, admin_headers):
    templates = client.get("/api/activity-templates", headers=admin_headers).json()
    by_name = {t["name"]: t for t in templates}
    kemeny = by_name["Kémény szerelés"]
    badogos = by_name["Bádogos munkák"]
    tetofedes = by_name["Tetőfedés"]
    assert badogos["id"] in kemeny["prerequisite_template_ids"]
    assert tetofedes["id"] in kemeny["prerequisite_template_ids"]


def test_create_template_forbidden_for_project_manager(client, admin_headers):
    create_user(client, admin_headers, "pmtmpl", "project_manager")
    headers = login(client, "pmtmpl")
    resp = client.post(
        "/api/activity-templates",
        json={"name": "Extra munka", "duration_days": 3},
        headers=headers,
    )
    assert resp.status_code == 403


def test_create_template_allowed_for_management(client, admin_headers):
    create_user(client, admin_headers, "mgmttmpl", "management")
    headers = login(client, "mgmttmpl")
    resp = client.post(
        "/api/activity-templates",
        json={"name": "Extra munka", "duration_days": 3},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Extra munka"
    assert data["sort_order"] == 24


def test_create_template_duplicate_name_400(client, admin_headers):
    resp = client.post(
        "/api/activity-templates",
        json={"name": "Terület rendezése", "duration_days": 3},
        headers=admin_headers,
    )
    assert resp.status_code == 400


def test_update_template_duplicate_name_400(client, admin_headers):
    templates = client.get("/api/activity-templates", headers=admin_headers).json()
    target = templates[1]
    resp = client.patch(
        f"/api/activity-templates/{target['id']}",
        json={"name": templates[0]["name"]},
        headers=admin_headers,
    )
    assert resp.status_code == 400


def test_template_dependency_self_reference_400(client, admin_headers):
    templates = client.get("/api/activity-templates", headers=admin_headers).json()
    t = templates[0]
    resp = client.post(
        f"/api/activity-templates/{t['id']}/dependencies",
        json={"prerequisite_template_id": t["id"]},
        headers=admin_headers,
    )
    assert resp.status_code == 400


def test_template_dependency_roundtrip(client, admin_headers):
    templates = client.get("/api/activity-templates", headers=admin_headers).json()
    a, b = templates[0], templates[1]

    add = client.post(
        f"/api/activity-templates/{b['id']}/dependencies",
        json={"prerequisite_template_id": a["id"]},
        headers=admin_headers,
    )
    assert add.status_code == 200

    after_add = client.get("/api/activity-templates", headers=admin_headers).json()
    b_after = next(x for x in after_add if x["id"] == b["id"])
    assert a["id"] in b_after["prerequisite_template_ids"]

    remove = client.delete(
        f"/api/activity-templates/{b['id']}/dependencies/{a['id']}",
        headers=admin_headers,
    )
    assert remove.status_code == 200

    after_remove = client.get("/api/activity-templates", headers=admin_headers).json()
    b_final = next(x for x in after_remove if x["id"] == b["id"])
    assert a["id"] not in b_final["prerequisite_template_ids"]


def test_delete_template_used_by_existing_project_does_not_error(client, admin_headers):
    project = create_project(client, admin_headers)
    templates = client.get("/api/activity-templates", headers=admin_headers).json()
    used_template = templates[0]

    resp = client.delete(
        f"/api/activity-templates/{used_template['id']}", headers=admin_headers
    )
    assert resp.status_code == 200

    # the already-created project's activities are unaffected
    activities = client.get(
        f"/api/projects/{project['id']}/activities", headers=admin_headers
    ).json()
    assert len(activities) == 24
    assert activities[0]["name"] == used_template["name"]


def test_reorder_template_moves_to_requested_position(client, admin_headers):
    templates = client.get("/api/activity-templates", headers=admin_headers).json()
    last = templates[-1]

    resp = client.patch(
        f"/api/activity-templates/{last['id']}",
        json={"sort_order": 1},
        headers=admin_headers,
    )
    assert resp.status_code == 200, resp.text

    reordered = client.get("/api/activity-templates", headers=admin_headers).json()
    assert reordered[0]["id"] == last["id"]
    assert [t["sort_order"] for t in reordered] == list(range(len(reordered)))


def test_reorder_template_clamps_out_of_range_position(client, admin_headers):
    templates = client.get("/api/activity-templates", headers=admin_headers).json()
    first = templates[0]

    resp = client.patch(
        f"/api/activity-templates/{first['id']}",
        json={"sort_order": 9999},
        headers=admin_headers,
    )
    assert resp.status_code == 200, resp.text

    reordered = client.get("/api/activity-templates", headers=admin_headers).json()
    assert reordered[-1]["id"] == first["id"]


def test_new_project_reflects_edited_template_dependency(client, admin_headers):
    templates = client.get("/api/activity-templates", headers=admin_headers).json()
    a, b = templates[2], templates[3]  # arbitrary pair not already linked by DEFAULT_ACTIVITIES

    client.post(
        f"/api/activity-templates/{b['id']}/dependencies",
        json={"prerequisite_template_id": a["id"]},
        headers=admin_headers,
    )

    project = create_project(client, admin_headers)
    activities = client.get(
        f"/api/projects/{project['id']}/activities", headers=admin_headers
    ).json()
    activity_a = next(x for x in activities if x["name"] == a["name"])
    activity_b = next(x for x in activities if x["name"] == b["name"])
    assert activity_a["id"] in activity_b["prerequisite_ids"]
