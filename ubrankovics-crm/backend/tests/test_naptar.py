from datetime import date, timedelta


def test_naptar_esemenyek_es_ics(client, admin_headers):
    ma = date.today()
    p = client.post(
        "/api/projektek",
        json={"projekt_nev": "Naptár ház", "delivery_date": (ma + timedelta(days=5)).isoformat()},
        headers=admin_headers,
    ).json()
    f = client.post(
        "/api/feladatok",
        json={"cim": "Telefon; az ügyfélnek, sürgős", "hatarido": ma.isoformat(), "projekt_id": p["id"]},
        headers=admin_headers,
    )
    assert f.status_code == 201, f.text
    client.post(
        "/api/feladatok",
        json={"cim": "Más hónap", "hatarido": (ma + timedelta(days=200)).isoformat()},
        headers=admin_headers,
    )

    tol, ig = ma.isoformat(), (ma + timedelta(days=30)).isoformat()
    ev = client.get(f"/api/naptar?tol={tol}&ig={ig}", headers=admin_headers).json()
    tipusok = {e["tipus"] for e in ev}
    assert tipusok == {"feladat", "atadas"}
    assert all(e["cim"] != "Más hónap" for e in ev)
    assert ev[0]["kezdes"] == ma.isoformat()

    szurt = client.get(f"/api/naptar?tol={tol}&ig={ig}&projekt_id={p['id'] + 99}", headers=admin_headers).json()
    assert szurt == []

    r = client.get("/api/naptar/export.ics", headers=admin_headers)
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/calendar")
    assert "BEGIN:VCALENDAR" in r.text and r.text.count("BEGIN:VEVENT") == 3
    assert "Telefon\; az ügyfélnek\, sürgős" in r.text
    assert f"DTSTART;VALUE=DATE:{ma.strftime('%Y%m%d')}" in r.text
    assert f"DTEND;VALUE=DATE:{(ma + timedelta(days=1)).strftime('%Y%m%d')}" in r.text


def test_naptar_auth(client):
    assert client.get("/api/naptar").status_code == 401
    assert client.get("/api/naptar/export.ics").status_code == 401


def test_naptar_utemezett_tetel_es_garancia_az_ics_ben(client, admin_headers):
    from tests.test_crm_core import _seeded_munkanem_id
    from tests.test_schedule_engine import _add_tetel

    ma = date.today()
    p = client.post(
        "/api/projektek",
        json={"projekt_nev": "Ütemezett ház", "utemezes_aktiv": True, "delivery_date": (ma + timedelta(days=20)).isoformat()},
        headers=admin_headers,
    ).json()
    _add_tetel(client, admin_headers, p["id"], _seeded_munkanem_id(client, admin_headers), duration_days=5)
    client.post(f"/api/projektek/{p['id']}/utemezes/recalculate", headers=admin_headers)

    ev = client.get(f"/api/naptar?tol={ma}&ig={ma + timedelta(days=60)}", headers=admin_headers).json()
    tetelek = [e for e in ev if e["tipus"] == "tetel"]
    assert tetelek and tetelek[0]["kezdes"] <= tetelek[0]["vege"]
    ics = client.get("/api/naptar/export.ics", headers=admin_headers)
    assert ics.status_code == 200 and "Ütemezett ház" in ics.text

    # aláírt átvétel garanciája is megjelenik
    a = client.post(
        f"/api/projektek/{p['id']}/atvetelek",
        json={"datum": ma.isoformat(), "atado_nev": "A", "atvevo_nev": "B", "garancia_honap": 1},
        headers=admin_headers,
    ).json()
    client.post(f"/api/atvetelek/{a['id']}/alairas", headers=admin_headers)
    ev = client.get(f"/api/naptar?tol={ma}&ig={ma + timedelta(days=62)}", headers=admin_headers).json()
    assert any(e["tipus"] == "garancia" for e in ev)
