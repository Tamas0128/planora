from datetime import date

from tests.test_crm_core import _seeded_munkanem_id


def _create_projekt_with_schedule(client, headers, delivery_date="2026-12-19"):
    resp = client.post(
        "/api/projektek",
        json={"projekt_nev": "Ütemezett projekt", "utemezes_aktiv": True, "delivery_date": delivery_date},
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def _add_tetel(client, headers, projekt_id, munkanem_id, duration_days):
    resp = client.post(
        f"/api/projektek/{projekt_id}/tetelek",
        json={"munkanem_id": munkanem_id, "duration_days": duration_days},
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_single_tetel_ends_on_delivery_date(client, admin_headers):
    munkanem_id = _seeded_munkanem_id(client, admin_headers)
    projekt = _create_projekt_with_schedule(client, admin_headers, delivery_date="2026-12-18")
    tetel = _add_tetel(client, admin_headers, projekt["id"], munkanem_id, duration_days=5)

    assert tetel["end_date"] == "2026-12-18"
    # 2026-12-18 is a Friday; 5 workdays back (incl. end) lands on 2026-12-14 (Monday).
    assert tetel["start_date"] == "2026-12-14"
    assert date.fromisoformat(tetel["start_date"]).weekday() < 5


def test_dependency_pushes_prerequisite_earlier(client, admin_headers):
    resp = client.get("/api/munkanemek", headers=admin_headers)
    munkanemek = resp.json()
    projekt = _create_projekt_with_schedule(client, admin_headers, delivery_date="2026-12-18")

    first = _add_tetel(client, admin_headers, projekt["id"], munkanemek[0]["id"], duration_days=3)
    second = _add_tetel(client, admin_headers, projekt["id"], munkanemek[1]["id"], duration_days=4)

    resp = client.post(
        f"/api/projektek/{projekt['id']}/tetelek/{second['id']}/fuggosegek",
        json={"prerequisite_id": first["id"]},
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.text

    resp = client.get(f"/api/projektek/{projekt['id']}/tetelek", headers=admin_headers)
    by_id = {t["id"]: t for t in resp.json()}
    first_after = by_id[first["id"]]
    second_after = by_id[second["id"]]

    assert date.fromisoformat(first_after["end_date"]) < date.fromisoformat(second_after["start_date"])


def test_completion_percent_tracks_kesz_szakasz(client, admin_headers):
    munkanem_id = _seeded_munkanem_id(client, admin_headers)
    projekt = _create_projekt_with_schedule(client, admin_headers)
    tetel = _add_tetel(client, admin_headers, projekt["id"], munkanem_id, duration_days=2)

    resp = client.patch(
        f"/api/projektek/{projekt['id']}/tetelek/{tetel['id']}",
        json={"szakasz": "kesz"},
        headers=admin_headers,
    )
    assert resp.status_code == 200, resp.text

    resp = client.get(f"/api/projektek/{projekt['id']}", headers=admin_headers)
    assert float(resp.json()["completion_percent"]) == 100.0


def test_recalculate_requires_utemezes_aktiv(client, admin_headers):
    resp = client.post("/api/projektek", json={"projekt_nev": "Nincs ütemező"}, headers=admin_headers)
    projekt_id = resp.json()["id"]
    resp = client.post(f"/api/projektek/{projekt_id}/utemezes/recalculate", headers=admin_headers)
    assert resp.status_code == 400


def test_terv_datum_nem_irodik_felul_ujrautemezeskor(client, admin_headers):
    resp = client.get("/api/munkanemek", headers=admin_headers)
    munkanemek = resp.json()
    projekt = _create_projekt_with_schedule(client, admin_headers, delivery_date="2026-12-18")

    tetel = _add_tetel(client, admin_headers, projekt["id"], munkanemek[0]["id"], duration_days=3)
    assert tetel["terv_kezdes"] == tetel["start_date"]
    assert tetel["terv_befejezes"] == tetel["end_date"]
    eredeti_terv_kezdes = tetel["terv_kezdes"]
    eredeti_terv_befejezes = tetel["terv_befejezes"]

    # Egy második, függő tétel hozzáadása visszatolja az elsőt — az új
    # "várható" (start_date/end_date) változik, de a "terv" nem.
    second = _add_tetel(client, admin_headers, projekt["id"], munkanemek[1]["id"], duration_days=4)
    resp = client.post(
        f"/api/projektek/{projekt['id']}/tetelek/{second['id']}/fuggosegek",
        json={"prerequisite_id": tetel["id"]},
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.text

    resp = client.post(f"/api/projektek/{projekt['id']}/utemezes/recalculate", headers=admin_headers)
    assert resp.status_code == 200, resp.text
    by_id = {t["id"]: t for t in resp.json()}
    frissitett = by_id[tetel["id"]]

    assert frissitett["terv_kezdes"] == eredeti_terv_kezdes
    assert frissitett["terv_befejezes"] == eredeti_terv_befejezes


def test_rendeles_osszeg_mezo(client, admin_headers):
    munkanem_id = _seeded_munkanem_id(client, admin_headers)
    resp = client.post("/api/projektek", json={"projekt_nev": "P"}, headers=admin_headers)
    projekt_id = resp.json()["id"]
    resp = client.post(
        f"/api/projektek/{projekt_id}/tetelek", json={"munkanem_id": munkanem_id}, headers=admin_headers
    )
    tetel_id = resp.json()["id"]

    resp = client.post(
        f"/api/projektek/{projekt_id}/tetelek/{tetel_id}/rendelesek",
        json={"megnevezes": "Ablak", "osszeg": "150000.00"},
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["osszeg"] == "150000.00"
