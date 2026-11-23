import io
from datetime import date, timedelta


def _lead(client, h, **kw):
    body = {"nev": "Kiss Béla", "email": "bela@example.com", "becsult_ertek": "1000000"}
    body.update(kw)
    r = client.post("/api/erdeklodok", json=body, headers=h)
    assert r.status_code == 201, r.text
    return r.json()


# --- Lead + pipeline ------------------------------------------------------------


def test_lead_pipeline_es_konverzio(client, admin_headers):
    lead = _lead(client, admin_headers)
    assert lead["allapot"] == "uj"
    assert lead["owner"] is not None

    r = client.patch(f"/api/erdeklodok/{lead['id']}", json={"allapot": "targyalas"}, headers=admin_headers)
    assert r.json()["allapot"] == "targyalas"

    _lead(client, admin_headers, nev="Nagy Kft.", becsult_ertek="500000", allapot="targyalas")
    pipeline = {p["allapot"]: p for p in client.get("/api/erdeklodok/pipeline", headers=admin_headers).json()}
    assert pipeline["targyalas"]["darab"] == 2
    assert float(pipeline["targyalas"]["ertek_osszesen"]) == 1500000
    assert pipeline["uj"]["darab"] == 0

    # naplóbejegyzés a leadhez, majd konverzió átviszi az ügyfélhez
    client.post(
        "/api/kommunikacio",
        json={"erdeklodes_id": lead["id"], "tipus": "hivas", "tartalom": "Első hívás"},
        headers=admin_headers,
    )
    r = client.post(f"/api/erdeklodok/{lead['id']}/konverzio", headers=admin_headers)
    assert r.status_code == 201, r.text
    ugyfel = r.json()
    assert ugyfel["nev"] == "Kiss Béla"

    r = client.get(f"/api/erdeklodok/{lead['id']}", headers=admin_headers)
    assert r.json()["allapot"] == "nyert"
    assert r.json()["ugyfel_id"] == ugyfel["id"]
    naplo = client.get(f"/api/kommunikacio?ugyfel_id={ugyfel['id']}", headers=admin_headers).json()
    assert len(naplo) == 1

    r = client.post(f"/api/erdeklodok/{lead['id']}/konverzio", headers=admin_headers)
    assert r.status_code == 409


def test_lead_torles(client, admin_headers):
    lead = _lead(client, admin_headers)
    assert client.delete(f"/api/erdeklodok/{lead['id']}", headers=admin_headers).status_code == 204
    assert client.get("/api/erdeklodok", headers=admin_headers).json() == []


# --- Kommunikációs napló ---------------------------------------------------------


def test_kommunikacio_naplo(client, admin_headers):
    ugyfel = client.post("/api/ugyfelek", json={"nev": "Napló Ügyfél"}, headers=admin_headers).json()

    r = client.post(
        "/api/kommunikacio",
        json={"ugyfel_id": ugyfel["id"], "tipus": "talalkozo", "tartalom": "Helyszíni egyeztetés"},
        headers=admin_headers,
    )
    assert r.status_code == 201, r.text
    assert r.json()["user"] is not None
    client.post(
        "/api/kommunikacio",
        json={"ugyfel_id": ugyfel["id"], "tipus": "email", "tartalom": "Ajánlat elküldve"},
        headers=admin_headers,
    )
    lista = client.get(f"/api/kommunikacio?ugyfel_id={ugyfel['id']}", headers=admin_headers).json()
    assert [k["tipus"] for k in lista] == ["email", "talalkozo"]  # legújabb elöl

    # kötelezően pontosan egy cél
    r = client.post("/api/kommunikacio", json={"tipus": "hivas", "tartalom": "x"}, headers=admin_headers)
    assert r.status_code == 400
    assert client.get("/api/kommunikacio", headers=admin_headers).status_code == 400

    assert client.delete(f"/api/kommunikacio/{lista[0]['id']}", headers=admin_headers).status_code == 204


# --- Értesítések -----------------------------------------------------------------


def test_ertesitesek_feladatok(client, admin_headers):
    me = client.get("/api/auth/me", headers=admin_headers).json()
    today = date.today()
    for cim, nap in (("Lejárt", -3), ("Holnap", 1), ("Messze", 30)):
        client.post(
            "/api/feladatok",
            json={"cim": cim, "hatarido": str(today + timedelta(days=nap)), "felelos_id": me["id"]},
            headers=admin_headers,
        )
    # kész és más felelősű feladat nem számít
    kesz = client.post(
        "/api/feladatok",
        json={"cim": "Kész", "hatarido": str(today), "felelos_id": me["id"]},
        headers=admin_headers,
    ).json()
    client.patch(f"/api/feladatok/{kesz['id']}", json={"kesz": True}, headers=admin_headers)
    client.post("/api/feladatok", json={"cim": "Gazdátlan", "hatarido": str(today)}, headers=admin_headers)

    items = client.get("/api/ertesitesek", headers=admin_headers).json()
    assert [(i["cim"], i["szint"]) for i in items] == [("Lejárt", "lejart"), ("Holnap", "kozeli")]


# --- Import / export / egyesítés ---------------------------------------------------


def test_ugyfel_export_csv_es_xlsx(client, admin_headers):
    client.post("/api/ugyfelek", json={"nev": "Árvíztűrő Kft.", "email": "a@x.hu"}, headers=admin_headers)
    r = client.get("/api/ugyfelek/export", headers=admin_headers)
    assert r.status_code == 200
    assert "Árvíztűrő Kft.;;a@x.hu" in r.content.decode("utf-8-sig")

    r = client.get("/api/ugyfelek/export?format=xlsx", headers=admin_headers)
    assert r.status_code == 200
    assert r.content[:2] == b"PK"
    assert client.get("/api/ugyfelek/export?format=pdf", headers=admin_headers).status_code == 400


def test_ugyfel_import_csv_duplikatum_kihagyas(client, admin_headers):
    client.post("/api/ugyfelek", json={"nev": "Meglévő", "email": "m@x.hu"}, headers=admin_headers)
    csv_text = "nev;telefon;email\nÚj Egy;+36301;uj1@x.hu\nMeglévő Másik;;m@x.hu\n;123;\nÚj Kettő;;\n".encode("utf-8")
    r = client.post(
        "/api/ugyfelek/import",
        files={"file": ("ugyfelek.csv", io.BytesIO(csv_text), "text/csv")},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["letrehozva"] == 2
    assert body["kihagyva_duplikatum"] == 1
    assert len(body["hibas_sorok"]) == 1
    assert len(body["hibas_sorok"]) == 1
    assert len(client.get("/api/ugyfelek", headers=admin_headers).json()) == 3


def test_ugyfel_import_hibak(client, admin_headers):
    r = client.post(
        "/api/ugyfelek/import",
        files={"file": ("x.csv", io.BytesIO(b"telefon\n123\n"), "text/csv")},
        headers=admin_headers,
    )
    assert r.status_code == 400
    r = client.post(
        "/api/ugyfelek/import",
        files={"file": ("x.txt", io.BytesIO(b"nev\nA\n"), "text/plain")},
        headers=admin_headers,
    )
    assert r.status_code == 400


def test_duplikatumok_es_egyesites(client, admin_headers):
    a = client.post("/api/ugyfelek", json={"nev": "Dup Ügyfél", "email": "d@x.hu"}, headers=admin_headers).json()
    b = client.post("/api/ugyfelek", json={"nev": "dup ügyfél", "telefon": "+3612"}, headers=admin_headers).json()
    client.post("/api/ugyfelek", json={"nev": "Egyedi"}, headers=admin_headers)

    csoportok = client.get("/api/ugyfelek/duplikatumok", headers=admin_headers).json()
    assert len(csoportok) == 1
    assert {u["id"] for u in csoportok[0]["ugyfelek"]} == {a["id"], b["id"]}

    client.post(
        "/api/kommunikacio",
        json={"ugyfel_id": b["id"], "tipus": "hivas", "tartalom": "régi hívás"},
        headers=admin_headers,
    )
    r = client.post(f"/api/ugyfelek/{a['id']}/egyesites", json={"forras_id": b["id"]}, headers=admin_headers)
    assert r.status_code == 200, r.text
    assert r.json()["telefon"] == "+3612"  # hiányzó adat átvéve
    assert client.get(f"/api/ugyfelek/{b['id']}", headers=admin_headers).status_code == 404
    naplo = client.get(f"/api/kommunikacio?ugyfel_id={a['id']}", headers=admin_headers).json()
    assert len(naplo) == 1

    r = client.post(f"/api/ugyfelek/{a['id']}/egyesites", json={"forras_id": a["id"]}, headers=admin_headers)
    assert r.status_code == 400
