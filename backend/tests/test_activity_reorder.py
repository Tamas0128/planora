from tests.conftest import create_project


def _activities(client, headers, project_id):
    return client.get(f"/api/projects/{project_id}/activities", headers=headers).json()


def test_reorder_moves_activity_to_requested_position(client, admin_headers):
    project = create_project(client, admin_headers)
    activities = _activities(client, admin_headers, project["id"])
    assert len(activities) >= 3
    last = activities[-1]

    resp = client.patch(
        f"/api/projects/{project['id']}/activities/{last['id']}",
        json={"sort_order": 1},
        headers=admin_headers,
    )
    assert resp.status_code == 200, resp.text

    reordered = _activities(client, admin_headers, project["id"])
    assert reordered[0]["id"] == last["id"]
    # sort_order stays a dense 0..n-1 range after the move.
    assert [a["sort_order"] for a in reordered] == list(range(len(reordered)))


def test_reorder_clamps_position_beyond_range(client, admin_headers):
    project = create_project(client, admin_headers)
    activities = _activities(client, admin_headers, project["id"])
    first = activities[0]

    resp = client.patch(
        f"/api/projects/{project['id']}/activities/{first['id']}",
        json={"sort_order": 9999},
        headers=admin_headers,
    )
    assert resp.status_code == 200, resp.text

    reordered = _activities(client, admin_headers, project["id"])
    assert reordered[-1]["id"] == first["id"]


def test_reorder_clamps_position_below_range(client, admin_headers):
    project = create_project(client, admin_headers)
    activities = _activities(client, admin_headers, project["id"])
    last = activities[-1]

    resp = client.patch(
        f"/api/projects/{project['id']}/activities/{last['id']}",
        json={"sort_order": -5},
        headers=admin_headers,
    )
    assert resp.status_code == 200, resp.text

    reordered = _activities(client, admin_headers, project["id"])
    assert reordered[0]["id"] == last["id"]


def test_reorder_does_not_change_other_fields(client, admin_headers):
    project = create_project(client, admin_headers)
    activities = _activities(client, admin_headers, project["id"])
    target = activities[-1]

    resp = client.patch(
        f"/api/projects/{project['id']}/activities/{target['id']}",
        json={"sort_order": 1},
        headers=admin_headers,
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["name"] == target["name"]
    assert data["duration_days"] == target["duration_days"]
