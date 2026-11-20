def test_feladat_crud(client, admin_headers):
    resp = client.post(
        "/api/feladatok",
        json={"cim": "Hívd fel az ügyfelet", "hatarido": "2026-12-01"},
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.text
    feladat = resp.json()
    assert feladat["kesz"] is False
    assert feladat["letrehozo_id"] is not None
    assert feladat["projekt_nev"] is None

    resp = client.get("/api/feladatok", headers=admin_headers)
    assert resp.status_code == 200, resp.text
    assert len(resp.json()) == 1

    resp = client.patch(f"/api/feladatok/{feladat['id']}", json={"kesz": True}, headers=admin_headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["kesz"] is True

    resp = client.delete(f"/api/feladatok/{feladat['id']}", headers=admin_headers)
    assert resp.status_code == 204, resp.text

    resp = client.get("/api/feladatok", headers=admin_headers)
    assert resp.json() == []


def test_feladat_with_projekt_and_felelos(client, admin_headers):
    resp = client.post("/api/projektek", json={"projekt_nev": "Feladat teszt projekt"}, headers=admin_headers)
    projekt_id = resp.json()["id"]

    resp = client.get("/api/auth/users/directory", headers=admin_headers)
    assert resp.status_code == 200, resp.text
    admin_user_id = resp.json()[0]["id"]

    resp = client.post(
        "/api/feladatok",
        json={
            "cim": "Ajánlat kiküldése",
            "leiras": "Küldd ki az ajánlatot e-mailben",
            "hatarido": "2026-11-25",
            "felelos_id": admin_user_id,
            "projekt_id": projekt_id,
        },
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.text
    feladat = resp.json()
    assert feladat["projekt_nev"] == "Feladat teszt projekt"
    assert feladat["felelos"]["id"] == admin_user_id

    resp = client.get(f"/api/feladatok?projekt_id={projekt_id}", headers=admin_headers)
    assert len(resp.json()) == 1

    resp = client.get(f"/api/feladatok?projekt_id={projekt_id + 999}", headers=admin_headers)
    assert resp.json() == []

    resp = client.get(f"/api/feladatok?felelos_id={admin_user_id}&kesz=false", headers=admin_headers)
    assert len(resp.json()) == 1


def test_feladat_create_with_invalid_projekt_is_404(client, admin_headers):
    resp = client.post("/api/feladatok", json={"cim": "X", "projekt_id": 9999}, headers=admin_headers)
    assert resp.status_code == 404
