import io
from datetime import date, timedelta


def _projekt(client, h, ugyfellel=True):
    ugyfelek = []
    if ugyfellel:
        u = client.post("/api/ugyfelek", json={"nev": "Teszt Ügyfél"}, headers=h)
        assert u.status_code in (200, 201), u.text
        ugyfelek = [{"ugyfel_id": u.json()["id"]}]
    r = client.post("/api/projektek", json={"projekt_nev": "Átadandó ház", "ugyfelek": ugyfelek}, headers=h)
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


# --- Átvétel + garancia -------------------------------------------------------------------


def test_atvetel_alairas_garancia_es_hibabejelentes(client, admin_headers):
    pid = _projekt(client, admin_headers)
    body = {"datum": date.today().isoformat(), "atado_nev": "Ubrankovics", "atvevo_nev": "Teszt Ügyfél", "garancia_honap": 12}
    a = client.post(f"/api/projektek/{pid}/atvetelek", json=body, headers=admin_headers)
    assert a.status_code == 201, a.text
    a = a.json()
    assert a["allapot"] == "tervezet" and a["garancia_lejar"] is None and not a["garancia_aktiv"]

    # aláírás előtt nincs garancia → hibabejelentés elutasítva
    r = client.post(f"/api/projektek/{pid}/garancia-hiba", json={"targy": "Beázás"}, headers=admin_headers)
    assert r.status_code == 409

    s = client.post(f"/api/atvetelek/{a['id']}/alairas", headers=admin_headers)
    assert s.status_code == 200, s.text
    s = s.json()
    assert s["allapot"] == "alairt" and s["garancia_aktiv"] and s["garancia_lejar"]
    assert s["garancia_lejar"][:4] == str(date.today().year + 1)

    # aláírt jegyzőkönyv nem módosítható / nem törölhető / nem írható alá újra
    assert client.patch(f"/api/atvetelek/{a['id']}", json={"megjegyzes": "x"}, headers=admin_headers).status_code == 409
    assert client.delete(f"/api/atvetelek/{a['id']}", headers=admin_headers).status_code == 409
    assert client.post(f"/api/atvetelek/{a['id']}/alairas", headers=admin_headers).status_code == 409

    j = client.post(f"/api/projektek/{pid}/garancia-hiba", json={"targy": "Beázás"}, headers=admin_headers)
    assert j.status_code == 201, j.text
    assert j.json()["targy"] == "Garanciális hiba: Beázás" and j.json()["projekt_id"] == pid
    lista = client.get(f"/api/jegyek?projekt_id={pid}", headers=admin_headers).json()
    assert len(lista) == 1

    html = client.get(f"/api/atvetelek/{a['id']}/jegyzokonyv", headers=admin_headers)
    assert html.status_code == 200 and "Átadás-átvételi jegyzőkönyv" in html.text and "Ubrankovics" in html.text


def test_atvetel_lejart_garancia_nem_jelentheto(client, admin_headers):
    pid = _projekt(client, admin_headers)
    regi = (date.today() - timedelta(days=800)).isoformat()
    a = client.post(
        f"/api/projektek/{pid}/atvetelek",
        json={"datum": regi, "atado_nev": "A", "atvevo_nev": "B", "garancia_honap": 12},
        headers=admin_headers,
    ).json()
    s = client.post(f"/api/atvetelek/{a['id']}/alairas", headers=admin_headers).json()
    assert not s["garancia_aktiv"]
    r = client.post(f"/api/projektek/{pid}/garancia-hiba", json={"targy": "X"}, headers=admin_headers)
    assert r.status_code == 409


def test_atvetel_torles_tervezetnel_es_hianyzo_ugyfel(client, admin_headers):
    pid = _projekt(client, admin_headers, ugyfellel=False)
    a = client.post(
        f"/api/projektek/{pid}/atvetelek",
        json={"datum": date.today().isoformat(), "atado_nev": "A", "atvevo_nev": "B"},
        headers=admin_headers,
    ).json()
    client.post(f"/api/atvetelek/{a['id']}/alairas", headers=admin_headers)
    r = client.post(f"/api/projektek/{pid}/garancia-hiba", json={"targy": "X"}, headers=admin_headers)
    assert r.status_code == 409 and "ügyfél" in r.json()["detail"]

    b = client.post(
        f"/api/projektek/{pid}/atvetelek",
        json={"datum": date.today().isoformat(), "atado_nev": "A", "atvevo_nev": "B"},
        headers=admin_headers,
    ).json()
    assert client.delete(f"/api/atvetelek/{b['id']}", headers=admin_headers).status_code == 204
    assert len(client.get(f"/api/projektek/{pid}/atvetelek", headers=admin_headers).json()) == 1


# --- Építési napló + fotó ---------------------------------------------------------------


def test_naplo_bejegyzes_es_foto(client, admin_headers):
    pid = _projekt(client, admin_headers, ugyfellel=False)
    b = client.post(
        f"/api/projektek/{pid}/naplo",
        json={"datum": date.today().isoformat(), "munka": "Alapozás betonozása", "idojaras": "napos", "letszam": 4},
        headers=admin_headers,
    )
    assert b.status_code == 201, b.text
    b = b.json()
    assert b["szerzo"]["full_name"] and b["fotok"] == []

    png = b"\x89PNG\r\n\x1a\n" + b"0" * 32
    up = client.post(
        f"/api/naplo/{b['id']}/fotok",
        files={"file": ("alap.png", io.BytesIO(png), "image/png")},
        headers=admin_headers,
    )
    assert up.status_code == 201, up.text
    foto = up.json()["fotok"][0]
    got = client.get(f"/api/naplo-fotok/{foto['id']}", headers=admin_headers)
    assert got.status_code == 200 and got.content == png

    bad = client.post(
        f"/api/naplo/{b['id']}/fotok",
        files={"file": ("x.exe", io.BytesIO(b"MZ"), "application/octet-stream")},
        headers=admin_headers,
    )
    assert bad.status_code == 400

    p = client.patch(f"/api/naplo/{b['id']}", json={"letszam": 6}, headers=admin_headers)
    assert p.json()["letszam"] == 6

    assert client.delete(f"/api/naplo-fotok/{foto['id']}", headers=admin_headers).status_code == 204
    assert client.get(f"/api/naplo-fotok/{foto['id']}", headers=admin_headers).status_code == 404
    assert client.delete(f"/api/naplo/{b['id']}", headers=admin_headers).status_code == 204
    assert client.get(f"/api/projektek/{pid}/naplo", headers=admin_headers).json() == []


def test_naplo_auth_szukseges(client):
    assert client.get("/api/projektek/1/naplo").status_code == 401


# --- Verziózott vevői ajánlat -----------------------------------------------------------


def test_ajanlat_verziozas(client, admin_headers):
    pid = _projekt(client, admin_headers, ugyfellel=False)
    sorok = [
        {"megnevezes": "Alapozás", "mennyiseg": "10", "egyseg": "m3", "egysegar": "20000"},
        {"megnevezes": "Falazás", "mennyiseg": "1", "egysegar": "500000"},
    ]
    a = client.post(f"/api/projektek/{pid}/ajanlatok", json={"cim": "Családi ház", "sorok": sorok}, headers=admin_headers)
    assert a.status_code == 201, a.text
    a = a.json()
    assert len(a["verziok"]) == 1 and a["verziok"][0]["verzio"] == 1
    assert float(a["verziok"][0]["netto_osszeg"]) == 700000

    sorok[1]["egysegar"] = "450000"
    n = client.post(f"/api/ajanlatok/{a['id']}/verziok", json={"sorok": sorok, "megjegyzes": "Kedvezmény"}, headers=admin_headers)
    assert n.status_code == 201, n.text
    v = n.json()["verziok"]
    assert [x["verzio"] for x in v] == [1, 2]
    assert float(v[1]["netto_osszeg"]) == 650000
    assert v[0]["allapot"] == "elutasitva" and v[1]["allapot"] == "tervezet"

    # csak a legutolsó verzió állapota módosítható
    assert client.patch(f"/api/ajanlat-verziok/{v[0]['id']}/allapot", json={"allapot": "elfogadva"}, headers=admin_headers).status_code == 409
    ok = client.patch(f"/api/ajanlat-verziok/{v[1]['id']}/allapot", json={"allapot": "elfogadva"}, headers=admin_headers)
    assert ok.status_code == 200 and ok.json()["verziok"][1]["allapot"] == "elfogadva"

    # elfogadott ajánlatnak nincs új verziója
    assert client.post(f"/api/ajanlatok/{a['id']}/verziok", json={"sorok": sorok}, headers=admin_headers).status_code == 409

    assert len(client.get(f"/api/projektek/{pid}/ajanlatok", headers=admin_headers).json()) == 1
    assert client.delete(f"/api/ajanlatok/{a['id']}", headers=admin_headers).status_code == 204
