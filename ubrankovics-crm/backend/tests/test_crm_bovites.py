from datetime import date, timedelta


def _ugyfel(client, h, nev="Teszt Ügyfél", **kw):
    r = client.post("/api/ugyfelek", json={"nev": nev, **kw}, headers=h)
    assert r.status_code == 201, r.text
    return r.json()


# --- Auditnapló ----------------------------------------------------------------------


def test_audit_naplozza_a_muveleteket(client, admin_headers):
    u = _ugyfel(client, admin_headers)
    client.patch(f"/api/ugyfelek/{u['id']}", json={"telefon": "+36"}, headers=admin_headers)
    lead = client.post("/api/erdeklodok", json={"nev": "L"}, headers=admin_headers).json()
    client.patch(f"/api/erdeklodok/{lead['id']}", json={"allapot": "ajanlat"}, headers=admin_headers)
    client.delete(f"/api/ugyfelek/{u['id']}", headers=admin_headers)

    naplo = client.get("/api/audit", headers=admin_headers).json()
    muveletek = [(n["entitas"], n["muvelet"]) for n in naplo]
    for var in [
        ("ugyfel", "letrehozas"),
        ("ugyfel", "modositas"),
        ("ugyfel", "torles"),
        ("erdeklodes", "letrehozas"),
        ("erdeklodes", "allapot"),
    ]:
        assert var in muveletek, muveletek
    assert naplo[0]["user"]["full_name"]
    assert len(client.get("/api/audit?entitas=erdeklodes", headers=admin_headers).json()) == 2


def test_audit_csak_adminnak_es_vezetesnek(client, admin_headers):
    r = client.post(
        "/api/auth/users",
        json={"username": "elad", "email": "e@x.hu", "full_name": "Elad", "password": "pw123456", "role": "ertekesites"},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    tok = client.post("/api/auth/login/json", json={"username": "elad", "password": "pw123456"}).json()["access_token"]
    assert client.get("/api/audit", headers={"Authorization": f"Bearer {tok}"}).status_code == 403


# --- Egyedi mezők -----------------------------------------------------------------------


def test_egyedi_mezok_definicio_es_ertek(client, admin_headers):
    u = _ugyfel(client, admin_headers)
    m1 = client.post("/api/egyedi-mezok", json={"entitas": "ugyfel", "nev": "Adószám"}, headers=admin_headers)
    assert m1.status_code == 201, m1.text
    m2 = client.post("/api/egyedi-mezok", json={"entitas": "ugyfel", "nev": "Létszám", "tipus": "szam"}, headers=admin_headers).json()
    m3 = client.post("/api/egyedi-mezok", json={"entitas": "ugyfel", "nev": "Szerződés lejár", "tipus": "datum"}, headers=admin_headers).json()
    assert client.post("/api/egyedi-mezok", json={"entitas": "ugyfel", "nev": "Adószám"}, headers=admin_headers).status_code == 409
    assert client.post("/api/egyedi-mezok", json={"entitas": "xx", "nev": "Q"}, headers=admin_headers).status_code == 400

    r = client.put(
        "/api/egyedi-mezok/ertekek",
        json={"entitas": "ugyfel", "entitas_id": u["id"], "ertekek": {m1.json()["id"]: "12345678-1-42", m2["id"]: "25"}},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    ertekek = {i["nev"]: i["ertek"] for i in r.json()}
    assert ertekek == {"Adószám": "12345678-1-42", "Létszám": "25", "Szerződés lejár": None}

    # érvénytelen típus
    r = client.put(
        "/api/egyedi-mezok/ertekek",
        json={"entitas": "ugyfel", "entitas_id": u["id"], "ertekek": {m2["id"]: "sok"}},
        headers=admin_headers,
    )
    assert r.status_code == 400
    r = client.put(
        "/api/egyedi-mezok/ertekek",
        json={"entitas": "ugyfel", "entitas_id": u["id"], "ertekek": {m3["id"]: "nem-datum"}},
        headers=admin_headers,
    )
    assert r.status_code == 400

    # üres érték törli
    r = client.put(
        "/api/egyedi-mezok/ertekek",
        json={"entitas": "ugyfel", "entitas_id": u["id"], "ertekek": {m1.json()["id"]: ""}},
        headers=admin_headers,
    )
    assert {i["nev"]: i["ertek"] for i in r.json()}["Adószám"] is None

    # törlés eltávolítja a mezőt és az értékeit
    assert client.delete(f"/api/egyedi-mezok/{m2['id']}", headers=admin_headers).status_code == 204
    assert [i["nev"] for i in client.get(f"/api/egyedi-mezok/ertekek?entitas=ugyfel&entitas_id={u['id']}", headers=admin_headers).json()] == [
        "Adószám",
        "Szerződés lejár",
    ]


# --- Címkék, szegmensek, kampány ------------------------------------------------------------


def test_cimkek_es_szegmens(client, admin_headers):
    a = _ugyfel(client, admin_headers, "A Kft.", email="a@x.hu")
    b = _ugyfel(client, admin_headers, "B Bt.", email="b@x.hu")
    c = client.post("/api/cimkek", json={"nev": "VIP"}, headers=admin_headers)
    assert c.status_code == 201, c.text
    cid = c.json()["id"]
    assert client.post("/api/cimkek", json={"nev": "VIP"}, headers=admin_headers).status_code == 409

    r = client.put(f"/api/ugyfelek/{a['id']}/cimkek", json={"cimke_ids": [cid]}, headers=admin_headers)
    assert [x["nev"] for x in r.json()] == ["VIP"]
    assert client.put(f"/api/ugyfelek/{b['id']}/cimkek", json={"cimke_ids": [999]}, headers=admin_headers).status_code == 404

    assert client.get("/api/cimkek", headers=admin_headers).json()[0]["ugyfel_szam"] == 1
    szeg = client.get(f"/api/cimkek/{cid}/ugyfelek", headers=admin_headers).json()
    assert [u["nev"] for u in szeg] == ["A Kft."]

    client.delete(f"/api/cimkek/{cid}", headers=admin_headers)
    assert client.get(f"/api/ugyfelek/{a['id']}/cimkek", headers=admin_headers).json() == []


def test_kampany_kuldes_szegmensnek(client, admin_headers, monkeypatch):
    kuldve = []
    monkeypatch.setattr("app.api.cimkek.send_email", lambda to, subject, body: kuldve.append((to, subject)) or True)
    a = _ugyfel(client, admin_headers, "A Kft.", email="a@x.hu")
    _ugyfel(client, admin_headers, "B Bt.", email="b@x.hu")
    _ugyfel(client, admin_headers, "Email nélkül")
    cid = client.post("/api/cimkek", json={"nev": "Hírlevél"}, headers=admin_headers).json()["id"]
    client.put(f"/api/ugyfelek/{a['id']}/cimkek", json={"cimke_ids": [cid]}, headers=admin_headers)

    assert client.get("/api/kampanyok/cimzettek-szama", headers=admin_headers).json() == {"darab": 2}
    assert client.get(f"/api/kampanyok/cimzettek-szama?cimke_id={cid}", headers=admin_headers).json() == {"darab": 1}

    r = client.post(
        "/api/kampanyok",
        json={"nev": "Karácsony", "targy": "Boldog ünnepeket", "uzenet": "Kellemes ünnepeket!", "cimke_id": cid},
        headers=admin_headers,
    )
    assert r.status_code == 201, r.text
    assert r.json()["cimzettek_szama"] == 1 and r.json()["elkuldve_szama"] == 1
    assert kuldve == [("a@x.hu", "Boldog ünnepeket")]
    naplo = client.get(f"/api/kommunikacio?ugyfel_id={a['id']}", headers=admin_headers).json()
    assert naplo[0]["tipus"] == "email" and "Karácsony" in naplo[0]["tartalom"]
    assert len(client.get("/api/kampanyok", headers=admin_headers).json()) == 1


def test_kampany_smtp_nelkul_nem_jelol_elkuldottnek(client, admin_headers):
    _ugyfel(client, admin_headers, "A Kft.", email="a@x.hu")
    r = client.post("/api/kampanyok", json={"nev": "X", "targy": "T", "uzenet": "U"}, headers=admin_headers)
    assert r.status_code == 201
    assert r.json()["cimzettek_szama"] == 1 and r.json()["elkuldve_szama"] == 0


def test_kampany_cimzett_nelkul_hiba(client, admin_headers):
    r = client.post("/api/kampanyok", json={"nev": "X", "targy": "T", "uzenet": "U"}, headers=admin_headers)
    assert r.status_code == 400


# --- Jegyek -----------------------------------------------------------------------------------


def test_jegy_eletciklus_es_ertesites(client, admin_headers):
    u = _ugyfel(client, admin_headers)
    me = client.get("/api/auth/me", headers=admin_headers).json()
    r = client.post(
        "/api/jegyek",
        json={"ugyfel_id": u["id"], "targy": "Beázik a tető", "prioritas": "surgos", "felelos_id": me["id"]},
        headers=admin_headers,
    )
    assert r.status_code == 201, r.text
    jegy = r.json()
    assert jegy["allapot"] == "nyitott" and jegy["ugyfel_nev"] == "Teszt Ügyfél"

    items = client.get("/api/ertesitesek", headers=admin_headers).json()
    assert any(i["tipus"] == "jegy" and i["szint"] == "lejart" for i in items)

    r = client.patch(f"/api/jegyek/{jegy['id']}", json={"allapot": "folyamatban"}, headers=admin_headers)
    assert r.json()["lezarva_at"] is None
    r = client.patch(f"/api/jegyek/{jegy['id']}", json={"allapot": "megoldva"}, headers=admin_headers)
    assert r.json()["lezarva_at"] is not None
    assert client.get("/api/jegyek?nyitott=true", headers=admin_headers).json() == []
    assert len(client.get(f"/api/jegyek?ugyfel_id={u['id']}", headers=admin_headers).json()) == 1
    assert not any(i["tipus"] == "jegy" for i in client.get("/api/ertesitesek", headers=admin_headers).json())

    assert client.post("/api/jegyek", json={"ugyfel_id": 999, "targy": "x"}, headers=admin_headers).status_code == 404
    assert client.delete(f"/api/jegyek/{jegy['id']}", headers=admin_headers).status_code == 204


# --- Előrejelzés --------------------------------------------------------------------------------


def test_elorejelzes_sulyozott_es_cel(client, admin_headers):
    ma = date.today()
    kov = (ma.replace(day=1) + timedelta(days=32)).replace(day=1)
    honap0, honap1 = f"{ma.year}-{ma.month:02d}", f"{kov.year}-{kov.month:02d}"

    def lead(nev, allapot, ertek, lezaras):
        r = client.post(
            "/api/erdeklodok",
            json={"nev": nev, "allapot": allapot, "becsult_ertek": ertek, "varhato_lezaras": lezaras},
            headers=admin_headers,
        )
        assert r.status_code == 201, r.text

    lead("A", "targyalas", "1000000", str(ma))  # 75% -> 750k, e hónap
    lead("B", "ajanlat", "2000000", str(kov))  # 50% -> 1M, jövő hónap
    lead("C", "uj", "1000000", None)  # 10% -> 100k, dátum nélkül
    lead("D", "nyert", "500000", str(ma))
    lead("E", "elveszett", "9000000", str(ma))  # nem számít

    r = client.put("/api/elorejelzes/cel", json={"honap": honap0, "osszeg": "2000000"}, headers=admin_headers)
    assert r.status_code == 200, r.text
    assert client.put("/api/elorejelzes/cel", json={"honap": "2026/11", "osszeg": "1"}, headers=admin_headers).status_code == 400

    r = client.get("/api/elorejelzes?honapok=3", headers=admin_headers)
    assert r.status_code == 200, r.text
    adat = r.json()
    h = {x["honap"]: x for x in adat["honapok"]}
    assert float(h[honap0]["sulyozott_osszeg"]) == 750000
    assert float(h[honap0]["nyert_osszeg"]) == 500000
    assert float(h[honap0]["cel"]) == 2000000
    assert float(h[honap1]["sulyozott_osszeg"]) == 1000000
    assert float(adat["datum_nelkul_sulyozott"]) == 100000
    assert float(adat["sulyozott_osszesen"]) == 1850000
    assert adat["teljesitmeny"][0]["nyert_db"] == 1
    assert adat["valoszinusegek"]["targyalas"] == 75

    # 0 cél törli
    client.put("/api/elorejelzes/cel", json={"honap": honap0, "osszeg": "0"}, headers=admin_headers)
    h = {x["honap"]: x for x in client.get("/api/elorejelzes?honapok=3", headers=admin_headers).json()["honapok"]}
    assert h[honap0]["cel"] is None
