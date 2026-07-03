from tests.conftest import create_project


def _activities(client, headers, project_id):
    return client.get(f"/api/projects/{project_id}/activities", headers=headers).json()


def test_disable_leaf_activity_succeeds(client, admin_headers):
    project = create_project(client, admin_headers)
    activities = _activities(client, admin_headers, project["id"])
    leaf = activities[-1]  # last activity has no successors depending on it

    resp = client.patch(
        f"/api/projects/{project['id']}/activities/{leaf['id']}",
        json={"is_active": False},
        headers=admin_headers,
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["is_active"] is False
    assert data["start_date"] is None
    assert data["end_date"] is None
    assert data["prep_date"] is None


def test_disable_activity_with_active_dependent_returns_400(client, admin_headers):
    project = create_project(client, admin_headers)
    activities = _activities(client, admin_headers, project["id"])
    a, b = activities[0], activities[1]

    client.post(
        f"/api/projects/{project['id']}/activities/{b['id']}/dependencies",
        json={"prerequisite_id": a["id"]},
        headers=admin_headers,
    )

    resp = client.patch(
        f"/api/projects/{project['id']}/activities/{a['id']}",
        json={"is_active": False},
        headers=admin_headers,
    )
    assert resp.status_code == 400
    assert b["name"] in resp.json()["detail"]

    # unaffected — still active
    after = _activities(client, admin_headers, project["id"])
    a_after = next(x for x in after if x["id"] == a["id"])
    assert a_after["is_active"] is True


def test_disable_activity_with_inactive_dependent_succeeds(client, admin_headers):
    project = create_project(client, admin_headers)
    activities = _activities(client, admin_headers, project["id"])
    a, b = activities[0], activities[1]

    client.post(
        f"/api/projects/{project['id']}/activities/{b['id']}/dependencies",
        json={"prerequisite_id": a["id"]},
        headers=admin_headers,
    )
    disable_b = client.patch(
        f"/api/projects/{project['id']}/activities/{b['id']}",
        json={"is_active": False},
        headers=admin_headers,
    )
    assert disable_b.status_code == 200

    resp = client.patch(
        f"/api/projects/{project['id']}/activities/{a['id']}",
        json={"is_active": False},
        headers=admin_headers,
    )
    assert resp.status_code == 200


def test_reenable_activity_always_allowed(client, admin_headers):
    project = create_project(client, admin_headers)
    activities = _activities(client, admin_headers, project["id"])
    leaf = activities[-1]

    client.patch(
        f"/api/projects/{project['id']}/activities/{leaf['id']}",
        json={"is_active": False},
        headers=admin_headers,
    )
    resp = client.patch(
        f"/api/projects/{project['id']}/activities/{leaf['id']}",
        json={"is_active": True},
        headers=admin_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["is_active"] is True
    assert resp.json()["start_date"] is not None


def test_list_activities_still_returns_inactive(client, admin_headers):
    project = create_project(client, admin_headers)
    activities = _activities(client, admin_headers, project["id"])
    leaf = activities[-1]

    client.patch(
        f"/api/projects/{project['id']}/activities/{leaf['id']}",
        json={"is_active": False},
        headers=admin_headers,
    )
    after = _activities(client, admin_headers, project["id"])
    assert len(after) == len(activities)
    disabled = next(x for x in after if x["id"] == leaf["id"])
    assert disabled["is_active"] is False


def test_disabled_activity_excluded_from_completion_percent(client, admin_headers):
    project = create_project(client, admin_headers)
    activities = _activities(client, admin_headers, project["id"])
    leaf = activities[-1]

    client.patch(
        f"/api/projects/{project['id']}/activities/{leaf['id']}",
        json={"is_active": False},
        headers=admin_headers,
    )
    remaining = _activities(client, admin_headers, project["id"])
    remaining_active = [a for a in remaining if a["is_active"]]
    first_active = remaining_active[0]
    client.patch(
        f"/api/projects/{project['id']}/activities/{first_active['id']}",
        json={"status": "done"},
        headers=admin_headers,
    )
    detail = client.get(f"/api/projects/{project['id']}", headers=admin_headers).json()
    assert detail["completion_percent"] == round(100 / len(remaining_active), 1)
