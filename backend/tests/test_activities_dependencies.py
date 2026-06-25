from tests.conftest import create_project, create_user, login


def _activities(client, headers, project_id):
    return client.get(f"/api/projects/{project_id}/activities", headers=headers).json()


def test_update_activity_status_recalculates_completion(client, admin_headers):
    project = create_project(client, admin_headers)
    activities = _activities(client, admin_headers, project["id"])
    first = activities[0]

    resp = client.patch(
        f"/api/projects/{project['id']}/activities/{first['id']}",
        json={"status": "done"},
        headers=admin_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "done"

    detail = client.get(f"/api/projects/{project['id']}", headers=admin_headers).json()
    assert detail["completion_percent"] == round(100 / 24, 1)


def test_add_and_remove_dependency(client, admin_headers):
    project = create_project(client, admin_headers)
    activities = _activities(client, admin_headers, project["id"])
    a, b = activities[0], activities[1]

    add = client.post(
        f"/api/projects/{project['id']}/activities/{b['id']}/dependencies",
        json={"prerequisite_id": a["id"]},
        headers=admin_headers,
    )
    assert add.status_code == 200

    activities_after_add = _activities(client, admin_headers, project["id"])
    b_after = next(x for x in activities_after_add if x["id"] == b["id"])
    assert a["id"] in b_after["prerequisite_ids"]

    remove = client.delete(
        f"/api/projects/{project['id']}/activities/{b['id']}/dependencies/{a['id']}",
        headers=admin_headers,
    )
    assert remove.status_code == 200

    activities_after_remove = _activities(client, admin_headers, project["id"])
    b_final = next(x for x in activities_after_remove if x["id"] == b["id"])
    assert a["id"] not in b_final["prerequisite_ids"]


def test_activity_cannot_depend_on_itself(client, admin_headers):
    project = create_project(client, admin_headers)
    activities = _activities(client, admin_headers, project["id"])
    a = activities[0]

    resp = client.post(
        f"/api/projects/{project['id']}/activities/{a['id']}/dependencies",
        json={"prerequisite_id": a["id"]},
        headers=admin_headers,
    )
    assert resp.status_code == 400


def test_remove_nonexistent_dependency_404s(client, admin_headers):
    project = create_project(client, admin_headers)
    activities = _activities(client, admin_headers, project["id"])
    a, b = activities[0], activities[1]

    resp = client.delete(
        f"/api/projects/{project['id']}/activities/{b['id']}/dependencies/{a['id']}",
        headers=admin_headers,
    )
    assert resp.status_code == 404


def test_non_owning_pm_cannot_touch_another_pms_activities(client, admin_headers):
    owner = create_user(client, admin_headers, "ownerpm2", "project_manager")
    other = create_user(client, admin_headers, "otherpm2", "project_manager")
    project = create_project(client, admin_headers, project_manager_id=owner["id"])
    activities = _activities(client, admin_headers, project["id"])
    a, b = activities[0], activities[1]

    other_headers = login(client, "otherpm2")

    assert client.patch(
        f"/api/projects/{project['id']}/activities/{a['id']}",
        json={"status": "done"},
        headers=other_headers,
    ).status_code == 403

    assert client.post(
        f"/api/projects/{project['id']}/activities/{b['id']}/dependencies",
        json={"prerequisite_id": a["id"]},
        headers=other_headers,
    ).status_code == 403

    assert client.delete(
        f"/api/projects/{project['id']}/activities/{b['id']}/dependencies/{a['id']}",
        headers=other_headers,
    ).status_code == 403

    assert client.post(
        f"/api/projects/{project['id']}/recalculate", headers=other_headers
    ).status_code == 403

    # the owning PM can still do all of the above
    owner_headers = login(client, "ownerpm2")
    assert client.patch(
        f"/api/projects/{project['id']}/activities/{a['id']}",
        json={"status": "done"},
        headers=owner_headers,
    ).status_code == 200
