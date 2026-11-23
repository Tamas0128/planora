import io

from docx import Document

from tests.test_crm_core import _seeded_munkanem_id


def _sablon_bytes(szoveg: str) -> bytes:
    d = Document()
    d.add_paragraph(szoveg)
    buf = io.BytesIO()
    d.save(buf)
    return buf.getvalue()


def _szoveg(data: bytes) -> str:
    return "\n".join(p.text for p in Document(io.BytesIO(data)).paragraphs)


def _feltolt(client, h, tipus, tartalom, nev="sablon.docx"):
    return client.post(
        f"/api/sablonfajlok/{tipus}",
        files={"file": (nev, io.BytesIO(tartalom), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        headers=h,
    )


def test_sablon_feltoltes_lista_es_generalas(client, admin_headers):
    ugyfel = client.post("/api/ugyfelek", json={"nev": "Kovács Béla", "email": "k@x.hu"}, headers=admin_headers).json()
    p = client.post(
        "/api/projektek",
        json={"projekt_nev": "Ház A", "hrsz": "77/3", "ugyfelek": [{"ugyfel_id": ugyfel["id"], "epitesi_cim": "Fő u. 1"}]},
        headers=admin_headers,
    ).json()
    mn = _seeded_munkanem_id(client, admin_headers)
    client.post(f"/api/projektek/{p['id']}/tetelek", json={"munkanem_id": mn, "info": "Első"}, headers=admin_headers)

    # még nincs sablon
    l = client.get("/api/sablonfajlok", headers=admin_headers).json()
    assert all(not s["feltoltve"] for s in l["sablonok"]) and len(l["sablonok"]) == 5
    assert any(v["nev"] == "projekt_nev" for v in l["valtozok"])
    r = client.post(f"/api/projektek/{p['id']}/dokumentum-docx", json={"tipus": "ajanlat"}, headers=admin_headers)
    assert r.status_code == 409

    sablon = "Projekt: {{ projekt_nev }} / {{ hrsz }} / {{ ugyfel_nev }} / {{ epitesi_cim }} / {{ tetel_darab }} / {% for t in tetelek %}[{{ t.info }}]{% endfor %}"
    up = _feltolt(client, admin_headers, "ajanlat", _sablon_bytes(sablon))
    assert up.status_code == 201, up.text
    assert up.json()["feltoltve"] and up.json()["eredeti_nev"] == "sablon.docx"

    g = client.post(f"/api/projektek/{p['id']}/dokumentum-docx", json={"tipus": "ajanlat"}, headers=admin_headers)
    assert g.status_code == 200, g.text
    assert "wordprocessingml" in g.headers["content-type"] and "attachment" in g.headers["content-disposition"]
    assert _szoveg(g.content) == "Projekt: Ház A / 77/3 / Kovács Béla / Fő u. 1 / 1 / [Első]"

    # újrafeltöltés felülírja, letöltés/törlés működik
    assert _feltolt(client, admin_headers, "ajanlat", _sablon_bytes("Új: {{ projekt_nev }}")).status_code == 201
    assert _szoveg(client.post(f"/api/projektek/{p['id']}/dokumentum-docx", json={"tipus": "ajanlat"}, headers=admin_headers).content) == "Új: Ház A"
    assert client.get("/api/sablonfajlok/ajanlat/letoltes", headers=admin_headers).status_code == 200
    assert client.delete("/api/sablonfajlok/ajanlat", headers=admin_headers).status_code == 204
    assert client.get("/api/sablonfajlok/ajanlat/letoltes", headers=admin_headers).status_code == 404


def test_sablon_feltoltes_validacio(client, admin_headers):
    assert _feltolt(client, admin_headers, "ajanlat", b"nem docx", nev="x.txt").status_code == 400
    assert _feltolt(client, admin_headers, "ajanlat", b"nem zip", nev="x.docx").status_code == 400
    rossz = _feltolt(client, admin_headers, "ajanlat", _sablon_bytes("{% for x in %}"))
    assert rossz.status_code == 400 and "nem tölthető ki" in rossz.json()["detail"]
    assert _feltolt(client, admin_headers, "nincs-ilyen", _sablon_bytes("x")).status_code == 404
    assert client.post("/api/sablonfajlok/ajanlat", headers=admin_headers).status_code == 422


def test_sablon_feltoltes_csak_admin_vezetes(client, admin_headers):
    u = client.post(
        "/api/auth/users",
        json={"username": "ertekesito1", "email": "e1@x.hu", "full_name": "E Egy", "password": "jelszo12345", "role": "ertekesites"},
        headers=admin_headers,
    )
    assert u.status_code == 200, u.text
    tok = client.post("/api/auth/login/json", json={"username": "ertekesito1", "password": "jelszo12345"}).json()["access_token"]
    h = {"Authorization": f"Bearer {tok}"}
    assert _feltolt(client, h, "ajanlat", _sablon_bytes("x")).status_code == 403
    assert client.get("/api/sablonfajlok", headers=h).status_code == 200
