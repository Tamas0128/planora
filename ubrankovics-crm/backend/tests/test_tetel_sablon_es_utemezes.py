from datetime import date


def test_create_projekt_with_tipus_copies_tetel_sablon(client, admin_headers):
    resp = client.get("/api/projekt-tipusok", headers=admin_headers)
    tipus = resp.json()[0]

    resp = client.post(
        "/api/projektek",
        json={"projekt_nev": "Sablonos tétel-projekt", "projekt_tipus_id": tipus["id"]},
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.text
    projekt_id = resp.json()["id"]

    resp = client.get(f"/api/projektek/{projekt_id}/tetelek", headers=admin_headers)
    assert resp.status_code == 200
    tetelek = resp.json()
    assert len(tetelek) > 0
    # A sorrend mezőnek ki kell töltve lennie, és a sablon sorrendjét kell követnie.
    sorrendek = [t["sorrend"] for t in tetelek]
    assert sorrendek == sorted(sorrendek)
    # Legalább néhány tételnek legyen függősége (a sablon szekvenciális láncából).
    assert any(t["fuggosegek"] for t in tetelek)
    # A duration_days a sablonból jön, nem None.
    assert all(t["duration_days"] is not None for t in tetelek)


def test_create_projekt_with_tipus_and_utemezes_aktiv_auto_schedules(client, admin_headers):
    resp = client.get("/api/projekt-tipusok", headers=admin_headers)
    tipus = resp.json()[0]

    resp = client.post(
        "/api/projektek",
        json={
            "projekt_nev": "Automatikusan ütemezett projekt",
            "projekt_tipus_id": tipus["id"],
            "utemezes_aktiv": True,
            "delivery_date": "2027-06-30",
        },
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.text
    projekt_id = resp.json()["id"]

    resp = client.get(f"/api/projektek/{projekt_id}/tetelek", headers=admin_headers)
    tetelek = resp.json()
    assert all(t["start_date"] and t["end_date"] for t in tetelek)
    assert all(date.fromisoformat(t["end_date"]) <= date(2027, 6, 30) for t in tetelek)


def test_create_projekt_without_tipus_has_no_tetelek(client, admin_headers):
    resp = client.post("/api/projektek", json={"projekt_nev": "Üres projekt"}, headers=admin_headers)
    projekt_id = resp.json()["id"]
    resp = client.get(f"/api/projektek/{projekt_id}/tetelek", headers=admin_headers)
    assert resp.json() == []


def test_manually_added_tetel_gets_appended_sorrend(client, admin_headers):
    resp = client.get("/api/munkanemek", headers=admin_headers)
    munkanemek = resp.json()
    resp = client.post("/api/projektek", json={"projekt_nev": "Kézi tétel-sorrend"}, headers=admin_headers)
    projekt_id = resp.json()["id"]

    resp = client.post(
        f"/api/projektek/{projekt_id}/tetelek",
        json={"munkanem_id": munkanemek[0]["id"]},
        headers=admin_headers,
    )
    first = resp.json()
    resp = client.post(
        f"/api/projektek/{projekt_id}/tetelek",
        json={"munkanem_id": munkanemek[1]["id"]},
        headers=admin_headers,
    )
    second = resp.json()
    assert second["sorrend"] > first["sorrend"]


def test_tetel_sorrend_patchable_for_drag_drop(client, admin_headers):
    resp = client.get("/api/munkanemek", headers=admin_headers)
    munkanemek = resp.json()
    resp = client.post("/api/projektek", json={"projekt_nev": "Drag-drop teszt"}, headers=admin_headers)
    projekt_id = resp.json()["id"]
    resp = client.post(
        f"/api/projektek/{projekt_id}/tetelek",
        json={"munkanem_id": munkanemek[0]["id"]},
        headers=admin_headers,
    )
    tetel_id = resp.json()["id"]

    resp = client.patch(
        f"/api/projektek/{projekt_id}/tetelek/{tetel_id}",
        json={"sorrend": 42},
        headers=admin_headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["sorrend"] == 42


def test_tetel_felelos_es_kijelolt_szerkesztheto(client, admin_headers):
    resp = client.get("/api/munkanemek", headers=admin_headers)
    munkanem_id = resp.json()[0]["id"]
    resp = client.get("/api/szemelyek", headers=admin_headers)
    szemely_id = resp.json()[0]["id"]
    resp = client.post("/api/projektek", json={"projekt_nev": "Felelős teszt"}, headers=admin_headers)
    projekt_id = resp.json()["id"]
    resp = client.post(
        f"/api/projektek/{projekt_id}/tetelek",
        json={"munkanem_id": munkanem_id},
        headers=admin_headers,
    )
    tetel_id = resp.json()["id"]

    resp = client.patch(
        f"/api/projektek/{projekt_id}/tetelek/{tetel_id}",
        json={"felelos_szerep": "epitesvezeto", "kijelolt_id": szemely_id},
        headers=admin_headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["felelos_szerep"] == "epitesvezeto"
    assert body["kijelolt_id"] == szemely_id
    assert body["kijelolt"]["id"] == szemely_id


def test_gantt_pdf_requires_scheduled_tetelek(client, admin_headers):
    resp = client.post("/api/projektek", json={"projekt_nev": "Gantt teszt"}, headers=admin_headers)
    projekt_id = resp.json()["id"]
    resp = client.get(f"/api/projektek/{projekt_id}/gantt.pdf", headers=admin_headers)
    assert resp.status_code == 400


def test_gantt_pdf_returns_pdf_when_scheduled(client, admin_headers):
    resp = client.get("/api/projekt-tipusok", headers=admin_headers)
    tipus = resp.json()[0]
    resp = client.post(
        "/api/projektek",
        json={
            "projekt_nev": "Gantt kész projekt",
            "projekt_tipus_id": tipus["id"],
            "utemezes_aktiv": True,
            "delivery_date": "2027-06-30",
        },
        headers=admin_headers,
    )
    projekt_id = resp.json()["id"]
    resp = client.get(f"/api/projektek/{projekt_id}/gantt.pdf", headers=admin_headers)
    assert resp.status_code == 200, resp.text
    assert resp.headers["content-type"] == "application/pdf"
    assert resp.content[:4] == b"%PDF"
