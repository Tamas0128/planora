from tests.conftest import create_project


def test_favorite_toggle_reflected_in_project_list(client, admin_headers):
    project = create_project(client, admin_headers)

    listing = client.get("/api/projects", headers=admin_headers).json()
    assert next(p for p in listing if p["id"] == project["id"])["is_favorite"] is False

    fav = client.post(f"/api/projects/{project['id']}/favorite", headers=admin_headers)
    assert fav.status_code == 200

    listing = client.get("/api/projects", headers=admin_headers).json()
    assert next(p for p in listing if p["id"] == project["id"])["is_favorite"] is True

    unfav = client.delete(f"/api/projects/{project['id']}/favorite", headers=admin_headers)
    assert unfav.status_code == 200

    listing = client.get("/api/projects", headers=admin_headers).json()
    assert next(p for p in listing if p["id"] == project["id"])["is_favorite"] is False


def test_favorite_is_per_user(client, admin_headers):
    from tests.conftest import create_user, login

    project = create_project(client, admin_headers)
    create_user(client, admin_headers, "pmfav", "project_manager")
    pm_headers = login(client, "pmfav")

    client.post(f"/api/projects/{project['id']}/favorite", headers=admin_headers)

    admin_detail = client.get(f"/api/projects/{project['id']}", headers=admin_headers).json()
    assert admin_detail["is_favorite"] is True

    # pmfav didn't manage this project, so can't view/favorite it — but the
    # favorite flag itself must never leak across users for shared projects.
    pm_project = create_project(client, pm_headers, project_code="PMFAV-1")
    pm_detail = client.get(f"/api/projects/{pm_project['id']}", headers=pm_headers).json()
    assert pm_detail["is_favorite"] is False
