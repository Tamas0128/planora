def _create_ugyfel(client, headers, nev="Teszt Kft."):
    resp = client.post("/api/ugyfelek", json={"nev": nev}, headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


def _seeded_munkanem_id(client, headers):
    resp = client.get("/api/munkanemek", headers=headers)
    assert resp.status_code == 200, resp.text
    items = resp.json()
    assert items, "seed_munkanemek should have run on startup"
    return items[0]["id"]


def test_ugyfel_crud(client, admin_headers):
    ugyfel = _create_ugyfel(client, admin_headers)
    resp = client.get(f"/api/ugyfelek/{ugyfel['id']}", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["nev"] == "Teszt Kft."

    resp = client.patch(
        f"/api/ugyfelek/{ugyfel['id']}", json={"telefon": "+36301234567"}, headers=admin_headers
    )
    assert resp.status_code == 200
    assert resp.json()["telefon"] == "+36301234567"


def test_munkanemek_seeded_on_startup(client, admin_headers):
    resp = client.get("/api/munkanemek", headers=admin_headers)
    assert resp.status_code == 200
    kodok = {m["kod"] for m in resp.json()}
    assert "ALAP-VIZSZIG" in kodok
    assert "KULTERI-NYZ" in kodok


def test_projekt_with_multiple_ugyfelek_and_addresses(client, admin_headers):
    ugyfel1 = _create_ugyfel(client, admin_headers, "Ügyfél Egy")
    ugyfel2 = _create_ugyfel(client, admin_headers, "Ügyfél Kettő")

    resp = client.post(
        "/api/projektek",
        json={
            "projekt_nev": "Teszt Projekt",
            "ugyfelek": [
                {"ugyfel_id": ugyfel1["id"], "epitesi_cim": "Cím 1", "szerep": "fő megrendelő"},
                {"ugyfel_id": ugyfel2["id"], "epitesi_cim": "Cím 2", "szerep": "társtulajdonos"},
            ],
        },
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.text
    projekt = resp.json()
    assert len(projekt["ugyfel_linkek"]) == 2
    assert projekt["utemezes_aktiv"] is False

    # Az ügyfél kártyáján a fordított irányból is látszódnia kell a projektnek.
    resp = client.get(f"/api/ugyfelek/{ugyfel1['id']}/projektek", headers=admin_headers)
    assert resp.status_code == 200, resp.text
    linkek = resp.json()
    assert len(linkek) == 1
    assert linkek[0]["projekt_id"] == projekt["id"]
    assert linkek[0]["projekt_nev"] == "Teszt Projekt"
    assert linkek[0]["epitesi_cim"] == "Cím 1"
    assert linkek[0]["szerep"] == "fő megrendelő"
    assert linkek[0]["allapot"] == "uj"

    resp = client.get(f"/api/ugyfelek/{ugyfel2['id']}/projektek", headers=admin_headers)
    assert len(resp.json()) == 1

    resp = client.get(f"/api/ugyfelek/{9999}/projektek", headers=admin_headers)
    assert resp.status_code == 404


def test_tetel_vallalasok_esemenyek_specifikacio(client, admin_headers):
    resp = client.post("/api/projektek", json={"projekt_nev": "P2"}, headers=admin_headers)
    projekt_id = resp.json()["id"]
    munkanem_id = _seeded_munkanem_id(client, admin_headers)

    resp = client.post(
        f"/api/projektek/{projekt_id}/tetelek",
        json={"munkanem_id": munkanem_id},
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.text
    tetel = resp.json()
    tetel_id = tetel["id"]

    # Több vállaló egy tételen: saját cég + alvállalkozó.
    resp = client.post(
        "/api/alvallalkozok", json={"nev": "Alvállalkozó Bt."}, headers=admin_headers
    )
    alv_id = resp.json()["id"]

    resp = client.post(
        f"/api/projektek/{projekt_id}/tetelek/{tetel_id}/vallalasok",
        json={"tipus": "sajat"},
        headers=admin_headers,
    )
    assert resp.status_code == 201

    resp = client.post(
        f"/api/projektek/{projekt_id}/tetelek/{tetel_id}/vallalasok",
        json={"tipus": "alvallalkozo", "alvallalkozo_id": alv_id},
        headers=admin_headers,
    )
    assert resp.status_code == 201

    # Esemény dátummal.
    resp = client.post(
        f"/api/projektek/{projekt_id}/tetelek/{tetel_id}/esemenyek",
        json={"tipus": "szerzodes", "allapot": "kesz", "datum": "2026-11-01"},
        headers=admin_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["datum"] == "2026-11-01"

    # Specifikáció kulcs-érték.
    resp = client.post(
        f"/api/projektek/{projekt_id}/tetelek/{tetel_id}/specifikaciok",
        json={"kulcs": "Gyártó", "ertek": "RábaAblak"},
        headers=admin_headers,
    )
    assert resp.status_code == 201

    resp = client.get(f"/api/projektek/{projekt_id}/tetelek", headers=admin_headers)
    tetel = resp.json()[0]
    assert len(tetel["vallalasok"]) == 2
    assert len(tetel["esemenyek"]) == 1
    assert len(tetel["specifikaciok"]) == 1
