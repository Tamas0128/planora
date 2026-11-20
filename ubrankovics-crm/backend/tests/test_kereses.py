def test_kereses_across_entity_types(client, admin_headers):
    resp = client.post("/api/ugyfelek", json={"nev": "Kereshető Kft."}, headers=admin_headers)
    assert resp.status_code == 201, resp.text
    resp = client.post("/api/projektek", json={"projekt_nev": "Kereshető projekt"}, headers=admin_headers)
    assert resp.status_code == 201, resp.text
    resp = client.post("/api/alvallalkozok", json={"nev": "Kereshető Bt."}, headers=admin_headers)
    assert resp.status_code == 201, resp.text
    resp = client.post("/api/szemelyek", json={"nev": "Kereshető Elek"}, headers=admin_headers)
    assert resp.status_code == 201, resp.text

    resp = client.get("/api/kereses?q=Kereshető", headers=admin_headers)
    assert resp.status_code == 200, resp.text
    results = resp.json()
    tipusok = {r["tipus"] for r in results}
    assert tipusok == {"ugyfel", "projekt", "alvallalkozo", "szemely"}
    assert len(results) == 4


def test_kereses_case_insensitive_and_no_match(client, admin_headers):
    resp = client.post("/api/ugyfelek", json={"nev": "Teszt Ügyfél"}, headers=admin_headers)
    assert resp.status_code == 201, resp.text

    resp = client.get("/api/kereses?q=teszt", headers=admin_headers)
    assert resp.status_code == 200, resp.text
    assert any(r["tipus"] == "ugyfel" for r in resp.json())

    resp = client.get("/api/kereses?q=nincs-ilyen-xyz", headers=admin_headers)
    assert resp.status_code == 200, resp.text
    assert resp.json() == []


def test_kereses_requires_query(client, admin_headers):
    resp = client.get("/api/kereses", headers=admin_headers)
    assert resp.status_code == 422
