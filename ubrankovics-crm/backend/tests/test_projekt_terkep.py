from tests.test_crm_core import _create_ugyfel


def _projekt(client, headers, cim="Pécs, Fő utca 1."):
    ugyfel_id = _create_ugyfel(client, headers)["id"]
    r = client.post(
        "/api/projektek",
        json={"projekt_nev": "Térkép P", "ugyfelek": [{"ugyfel_id": ugyfel_id, "epitesi_cim": cim}]},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    return r.json()["id"]


def test_lista_cimmel_es_koordinataval(client, admin_headers):
    pid = _projekt(client, admin_headers)
    item = next(p for p in client.get("/api/projektek", headers=admin_headers).json() if p["id"] == pid)
    assert item["epitesi_cim"] == "Pécs, Fő utca 1."
    assert item["ugyfel_nev"]
    assert item["latitude"] is None

    r = client.patch(f"/api/projektek/{pid}", json={"latitude": 46.07, "longitude": 18.23}, headers=admin_headers)
    assert r.status_code == 200
    item = next(p for p in client.get("/api/projektek", headers=admin_headers).json() if p["id"] == pid)
    assert (item["latitude"], item["longitude"]) == (46.07, 18.23)
    assert client.patch(f"/api/projektek/{pid}", json={"latitude": 123}, headers=admin_headers).status_code == 422


def test_geokodolas(client, admin_headers, monkeypatch):
    monkeypatch.setattr("app.api.projektek.geocode_address", lambda cim: (47.5, 19.04))
    pid = _projekt(client, admin_headers)
    r = client.post(f"/api/projektek/{pid}/geokodolas", headers=admin_headers)
    assert r.status_code == 200
    assert r.json()["latitude"] == 47.5

    monkeypatch.setattr("app.api.projektek.geocode_address", lambda cim: None)
    pid2 = _projekt(client, admin_headers, cim="Nincs ilyen")
    assert client.post(f"/api/projektek/{pid2}/geokodolas", headers=admin_headers).status_code == 422


def test_geokodolas_hianyzok(client, admin_headers, monkeypatch):
    monkeypatch.setattr("app.api.projektek.geocode_address", lambda cim: (46.0, 18.0))
    monkeypatch.setattr("time.sleep", lambda s: None)
    _projekt(client, admin_headers)
    r = client.post("/api/projektek/geokodolas-hianyzok", headers=admin_headers)
    assert r.status_code == 200
    assert r.json()["feloldva"] >= 1
