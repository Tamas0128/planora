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
