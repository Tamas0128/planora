from tests.conftest import create_user, login


def test_login_success(client):
    resp = client.post(
        "/api/auth/login/json", json={"username": "admin", "password": "admin123"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["access_token"]
    assert data["refresh_token"]


def test_login_wrong_password(client):
    resp = client.post(
        "/api/auth/login/json", json={"username": "admin", "password": "wrong"}
    )
    assert resp.status_code == 401


def test_me_requires_token(client):
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401


def test_me_returns_current_user(client, admin_headers):
    resp = client.get("/api/auth/me", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["username"] == "admin"


def test_refresh_issues_new_tokens(client):
    login_resp = client.post(
        "/api/auth/login/json", json={"username": "admin", "password": "admin123"}
    )
    refresh_token = login_resp.json()["refresh_token"]
    resp = client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
    assert resp.status_code == 200
    data = resp.json()
    assert data["access_token"]
    assert data["refresh_token"]


def test_refresh_rejects_access_token_as_refresh(client, admin_headers):
    access_token = admin_headers["Authorization"].split(" ")[1]
    resp = client.post("/api/auth/refresh", json={"refresh_token": access_token})
    assert resp.status_code == 401


def test_admin_can_create_user(client, admin_headers):
    user = create_user(client, admin_headers, "pmuser", "project_manager")
    assert user["role"] == "project_manager"
    assert user["is_active"] is True


def test_non_admin_cannot_create_user(client, admin_headers):
    create_user(client, admin_headers, "pmuser2", "project_manager")
    pm_headers = login(client, "pmuser2")
    resp = client.post(
        "/api/auth/users",
        json={
            "username": "sneaky",
            "email": "sneaky@example.com",
            "full_name": "Sneaky",
            "password": "testpass123",
            "role": "admin",
        },
        headers=pm_headers,
    )
    assert resp.status_code == 403


def test_admin_can_update_user_role_and_active(client, admin_headers):
    user = create_user(client, admin_headers, "pmuser3", "project_manager")
    resp = client.patch(
        f"/api/auth/users/{user['id']}",
        json={"role": "management", "is_active": False},
        headers=admin_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["role"] == "management"
    assert data["is_active"] is False


def test_deactivated_user_cannot_login(client, admin_headers):
    user = create_user(client, admin_headers, "pmuser4", "project_manager")
    client.patch(
        f"/api/auth/users/{user['id']}", json={"is_active": False}, headers=admin_headers
    )
    resp = client.post(
        "/api/auth/login/json", json={"username": "pmuser4", "password": "testpass123"}
    )
    assert resp.status_code == 401
