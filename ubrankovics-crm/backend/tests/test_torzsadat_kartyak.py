from tests.test_beszerzes_procurement import _create_tetel


def _create_alvallalkozo(client, headers, nev="Alvállalkozó Bt."):
    resp = client.post("/api/alvallalkozok", json={"nev": nev}, headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


def _create_szemely(client, headers, nev="Teszt Elek"):
    resp = client.post("/api/szemelyek", json={"nev": nev, "szervezet": "belso"}, headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_alvallalkozo_card_shows_linked_tetel(client, admin_headers):
    projekt_id, tetel_id = _create_tetel(client, admin_headers)
    alv = _create_alvallalkozo(client, admin_headers)

    resp = client.get(f"/api/alvallalkozok/{alv['id']}", headers=admin_headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["nev"] == "Alvállalkozó Bt."

    resp = client.get(f"/api/alvallalkozok/{alv['id']}/tetelek", headers=admin_headers)
    assert resp.status_code == 200, resp.text
    assert resp.json() == []

    resp = client.post(
        f"/api/projektek/{projekt_id}/tetelek/{tetel_id}/vallalasok",
        json={"tipus": "alvallalkozo", "alvallalkozo_id": alv["id"]},
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.text

    resp = client.get(f"/api/alvallalkozok/{alv['id']}/tetelek", headers=admin_headers)
    assert resp.status_code == 200, resp.text
    tetelek = resp.json()
    assert len(tetelek) == 1
    assert tetelek[0]["tetel_id"] == tetel_id
    assert tetelek[0]["projekt_id"] == projekt_id
    assert tetelek[0]["szakasz"] == "ajanlat"

    resp = client.get(f"/api/alvallalkozok/{alv['id']}/tig", headers=admin_headers)
    assert resp.status_code == 200 and resp.json() == []
    resp = client.get(f"/api/alvallalkozok/{alv['id']}/szamlak", headers=admin_headers)
    assert resp.status_code == 200 and resp.json() == []

    resp = client.get("/api/alvallalkozok/9999", headers=admin_headers)
    assert resp.status_code == 404
    resp = client.get("/api/alvallalkozok/9999/tetelek", headers=admin_headers)
    assert resp.status_code == 404


def test_alvallalkozo_card_shows_tig_and_szamla(client, admin_headers):
    projekt_id, _ = _create_tetel(client, admin_headers)
    alv = _create_alvallalkozo(client, admin_headers)

    resp = client.post(
        f"/api/projektek/{projekt_id}/tig",
        json={
            "alvallalkozo_id": alv["id"],
            "datum": "2026-11-20",
            "idoszak_kezdet": "2026-11-01",
            "idoszak_veg": "2026-11-20",
            "netto": "500000",
            "afa_tipus": "forditott",
        },
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.text

    resp = client.post(
        f"/api/projektek/{projekt_id}/alvallalkozoi-szamlak",
        json={
            "alvallalkozo_id": alv["id"],
            "szamlaszam": "ALV-TEST-001",
            "teljesites_datum": "2026-11-20",
            "kiallitas_datum": "2026-11-20",
            "esedekesseg": "2026-12-04",
            "netto": "500000",
            "afa_tipus": "forditott",
        },
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.text

    resp = client.get(f"/api/alvallalkozok/{alv['id']}/tig", headers=admin_headers)
    assert len(resp.json()) == 1
    resp = client.get(f"/api/alvallalkozok/{alv['id']}/szamlak", headers=admin_headers)
    assert len(resp.json()) == 1
    assert resp.json()[0]["szamlaszam"] == "ALV-TEST-001"


def test_szemely_card_shows_szerep_and_kijelolt_tetel(client, admin_headers):
    projekt_id, tetel_id = _create_tetel(client, admin_headers)
    szemely = _create_szemely(client, admin_headers)

    resp = client.get(f"/api/szemelyek/{szemely['id']}", headers=admin_headers)
    assert resp.status_code == 200, resp.text

    resp = client.get(f"/api/szemelyek/{szemely['id']}/szerepek", headers=admin_headers)
    assert resp.status_code == 200 and resp.json() == []
    resp = client.get(f"/api/szemelyek/{szemely['id']}/tetelek", headers=admin_headers)
    assert resp.status_code == 200 and resp.json() == []

    resp = client.post(
        f"/api/projektek/{projekt_id}/szerepek",
        json={"szemely_id": szemely["id"], "szerep": "epitesvezeto"},
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.text

    resp = client.patch(
        f"/api/projektek/{projekt_id}/tetelek/{tetel_id}",
        json={"kijelolt_id": szemely["id"]},
        headers=admin_headers,
    )
    assert resp.status_code == 200, resp.text

    resp = client.get(f"/api/szemelyek/{szemely['id']}/szerepek", headers=admin_headers)
    assert resp.status_code == 200, resp.text
    szerepek = resp.json()
    assert len(szerepek) == 1
    assert szerepek[0]["projekt_id"] == projekt_id
    assert szerepek[0]["szerep"] == "epitesvezeto"

    resp = client.get(f"/api/szemelyek/{szemely['id']}/tetelek", headers=admin_headers)
    assert resp.status_code == 200, resp.text
    tetelek = resp.json()
    assert len(tetelek) == 1
    assert tetelek[0]["tetel_id"] == tetel_id

    resp = client.get("/api/szemelyek/9999", headers=admin_headers)
    assert resp.status_code == 404
