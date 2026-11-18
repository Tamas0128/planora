def test_login_success(client, admin_headers):
    resp = client.get("/api/auth/me", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["username"] == "admin"


def test_login_wrong_password(client):
    resp = client.post("/api/auth/login/json", json={"username": "admin", "password": "wrong"})
    assert resp.status_code == 401


def test_create_user_requires_admin(client, admin_headers):
    resp = client.post(
        "/api/auth/users",
        json={
            "username": "ertekesito1",
            "email": "e1@example.com",
            "full_name": "Értékesítő Egy",
            "password": "testpass123",
            "role": "ertekesites",
        },
        headers=admin_headers,
    )
    assert resp.status_code == 200, resp.text

    login_resp = client.post(
        "/api/auth/login/json", json={"username": "ertekesito1", "password": "testpass123"}
    )
    user_headers = {"Authorization": f"Bearer {login_resp.json()['access_token']}"}

    forbidden = client.post(
        "/api/auth/users",
        json={
            "username": "x",
            "email": "x@example.com",
            "full_name": "X",
            "password": "testpass123",
            "role": "ertekesites",
        },
        headers=user_headers,
    )
    assert forbidden.status_code == 403
