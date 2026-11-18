from tests.test_crm_core import _seeded_munkanem_id


def test_tetel_can_have_multiple_rendelesek(client, admin_headers):
    resp = client.post("/api/projektek", json={"projekt_nev": "P"}, headers=admin_headers)
    projekt_id = resp.json()["id"]
    munkanem_id = _seeded_munkanem_id(client, admin_headers)
    resp = client.post(
        f"/api/projektek/{projekt_id}/tetelek", json={"munkanem_id": munkanem_id}, headers=admin_headers
    )
    tetel_id = resp.json()["id"]

    for megnevezes in ["Ablak - nappali 150x150", "Ablak - háló 120x150", "Eresz - bal oldal"]:
        resp = client.post(
            f"/api/projektek/{projekt_id}/tetelek/{tetel_id}/rendelesek",
            json={"megnevezes": megnevezes, "beszallito": "RábaAblak"},
            headers=admin_headers,
        )
        assert resp.status_code == 201, resp.text

    resp = client.get(f"/api/projektek/{projekt_id}/tetelek", headers=admin_headers)
    tetel = resp.json()[0]
    assert len(tetel["rendelesek"]) == 3
    assert {r["megnevezes"] for r in tetel["rendelesek"]} == {
        "Ablak - nappali 150x150",
        "Ablak - háló 120x150",
        "Eresz - bal oldal",
    }

    rendeles_id = tetel["rendelesek"][0]["id"]
    resp = client.patch(
        f"/api/projektek/{projekt_id}/tetelek/{tetel_id}/rendelesek/{rendeles_id}",
        json={"allapot": "megerkezett"},
        headers=admin_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["allapot"] == "megerkezett"

    resp = client.delete(
        f"/api/projektek/{projekt_id}/tetelek/{tetel_id}/rendelesek/{rendeles_id}", headers=admin_headers
    )
    assert resp.status_code == 204

    resp = client.get(f"/api/projektek/{projekt_id}/tetelek", headers=admin_headers)
    assert len(resp.json()[0]["rendelesek"]) == 2


def test_projekt_tipusok_seeded(client, admin_headers):
    resp = client.get("/api/projekt-tipusok", headers=admin_headers)
    assert resp.status_code == 200, resp.text
    tipusok = resp.json()
    assert len(tipusok) == 2
    nevek = {t["nev"] for t in tipusok}
    assert "Könnyűszerkezetes, üzemben szerelt készház" in nevek
    assert "Boronafalas gerendaház" in nevek
    for t in tipusok:
        assert len(t["fazisok"]) == 11
        assert sum(len(f["lepesek"]) for f in t["fazisok"]) > 0


def test_create_projekt_with_tipus_copies_fazisok(client, admin_headers):
    resp = client.get("/api/projekt-tipusok", headers=admin_headers)
    tipus = resp.json()[0]

    resp = client.post(
        "/api/projektek",
        json={"projekt_nev": "Sablonos projekt", "projekt_tipus_id": tipus["id"]},
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.text
    projekt_id = resp.json()["id"]
    assert resp.json()["projekt_tipus_id"] == tipus["id"]

    resp = client.get(f"/api/projektek/{projekt_id}/fazisok", headers=admin_headers)
    assert resp.status_code == 200
    fazisok = resp.json()
    assert len(fazisok) == len(tipus["fazisok"])
    assert fazisok[0]["nev"] == tipus["fazisok"][0]["nev"]
    assert len(fazisok[0]["lepesek"]) == len(tipus["fazisok"][0]["lepesek"])
    assert all(not l["kesz"] for l in fazisok[0]["lepesek"])


def test_projekt_fazisok_editable_independently_of_template(client, admin_headers):
    resp = client.post("/api/projektek", json={"projekt_nev": "Egyedi projekt"}, headers=admin_headers)
    projekt_id = resp.json()["id"]

    resp = client.post(
        f"/api/projektek/{projekt_id}/fazisok", json={"nev": "Saját fázis"}, headers=admin_headers
    )
    assert resp.status_code == 201, resp.text
    fazis_id = resp.json()["id"]

    resp = client.post(
        f"/api/projektek/{projekt_id}/fazisok/{fazis_id}/lepesek",
        json={"nev": "Saját lépés", "merfoldko": True},
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.text
    lepes_id = resp.json()["id"]

    resp = client.patch(
        f"/api/projektek/{projekt_id}/fazisok/{fazis_id}/lepesek/{lepes_id}",
        json={"kesz": True},
        headers=admin_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["kesz"] is True

    resp = client.delete(
        f"/api/projektek/{projekt_id}/fazisok/{fazis_id}/lepesek/{lepes_id}", headers=admin_headers
    )
    assert resp.status_code == 204

    resp = client.get(f"/api/projektek/{projekt_id}/fazisok", headers=admin_headers)
    assert resp.json()[0]["lepesek"] == []
