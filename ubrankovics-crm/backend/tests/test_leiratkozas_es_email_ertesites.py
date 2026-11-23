from datetime import date, timedelta

import pytest

from app.models import Ugyfel
from tests.conftest import TestingSessionLocal


def _ugyfel(client, h, nev, email):
    r = client.post("/api/ugyfelek", json={"nev": nev, "email": email}, headers=h)
    assert r.status_code == 201, r.text
    return r.json()


@pytest.fixture
def kuldott(monkeypatch):
    lista = []

    def fake(to, subject, body, extra_headers=None):
        lista.append({"to": to, "subject": subject, "body": body, "headers": extra_headers or {}})
        return True

    monkeypatch.setattr("app.config.settings.public_base_url", "http://localhost:3101")
    monkeypatch.setattr("app.api.cimkek.send_email", fake)
    monkeypatch.setattr("app.services.ertesitesek.send_email", fake)
    return lista


def _token(ugyfel_id):
    db = TestingSessionLocal()
    try:
        return db.query(Ugyfel).get(ugyfel_id).leiratkozasi_token
    finally:
        db.close()


# --- Leiratkozás ----------------------------------------------------------------------


def test_kampany_level_leiratkozo_linkkel_es_fejleccel(client, admin_headers, kuldott):
    u = _ugyfel(client, admin_headers, "A Kft.", "a@x.hu")
    r = client.post("/api/kampanyok", json={"nev": "N", "targy": "T", "uzenet": "Szia"}, headers=admin_headers)
    assert r.status_code == 201, r.text
    token = _token(u["id"])
    assert token
    level = kuldott[0]
    assert f"/api/leiratkozas/{token}" in level["body"]
    assert level["headers"]["List-Unsubscribe"] == f"<http://localhost:3101/api/leiratkozas/{token}>"


def test_leiratkozas_folyamat_es_kizaras_a_kampanybol(client, admin_headers, kuldott):
    a = _ugyfel(client, admin_headers, "A Kft.", "a@x.hu")
    _ugyfel(client, admin_headers, "B Bt.", "b@x.hu")
    client.post("/api/kampanyok", json={"nev": "N", "targy": "T", "uzenet": "Szia"}, headers=admin_headers)
    token = _token(a["id"])

    # GET csak megerősítő oldal, nem iratkoztat le
    r = client.get(f"/api/leiratkozas/{token}")
    assert r.status_code == 200 and "Igen, leiratkozom" in r.text
    assert client.get(f"/api/ugyfelek/{a['id']}", headers=admin_headers).json()["leiratkozott"] is False

    r = client.post(f"/api/leiratkozas/{token}")
    assert r.status_code == 200 and "Leiratkoztál" in r.text
    assert client.get(f"/api/ugyfelek/{a['id']}", headers=admin_headers).json()["leiratkozott"] is True
    naplo = client.get(f"/api/kommunikacio?ugyfel_id={a['id']}", headers=admin_headers).json()
    assert any("Leiratkozott" in k["tartalom"] for k in naplo)
    assert any(n["muvelet"] == "leiratkozas" for n in client.get("/api/audit", headers=admin_headers).json())
    assert "Már leiratkoztál" in client.get(f"/api/leiratkozas/{token}").text

    # a következő kampány már nem megy ki neki
    kuldott.clear()
    assert client.get("/api/kampanyok/cimzettek-szama", headers=admin_headers).json() == {"darab": 1, "leiratkozott": 1}
    r = client.post("/api/kampanyok", json={"nev": "N2", "targy": "T2", "uzenet": "Szia"}, headers=admin_headers)
    assert r.json()["cimzettek_szama"] == 1
    assert [k["to"] for k in kuldott] == ["b@x.hu"]

    # a munkatárs visszaírhatja
    r = client.patch(f"/api/ugyfelek/{a['id']}", json={"leiratkozott": False}, headers=admin_headers)
    assert r.json()["leiratkozott"] is False


def test_ervenytelen_leiratkozasi_token(client):
    assert client.get("/api/leiratkozas/nincs-ilyen").status_code == 404
    assert client.post("/api/leiratkozas/nincs-ilyen").status_code == 404
    assert client.get("/api/leiratkozas/" + "x" * 80).status_code == 404


def test_csupa_leiratkozott_cimzett_hiba(client, admin_headers, kuldott):
    u = _ugyfel(client, admin_headers, "A Kft.", "a@x.hu")
    client.patch(f"/api/ugyfelek/{u['id']}", json={"leiratkozott": True}, headers=admin_headers)
    r = client.post("/api/kampanyok", json={"nev": "N", "targy": "T", "uzenet": "Szia"}, headers=admin_headers)
    assert r.status_code == 400
    assert kuldott == []


# --- E-mailes értesítés ------------------------------------------------------------------


def _feladat(client, h, cim, nap, felelos_id):
    r = client.post(
        "/api/feladatok",
        json={"cim": cim, "hatarido": str(date.today() + timedelta(days=nap)), "felelos_id": felelos_id},
        headers=h,
    )
    assert r.status_code == 201, r.text


def test_email_beallitas_es_kuldes_most(client, admin_headers, kuldott):
    me = client.get("/api/auth/me", headers=admin_headers).json()
    b = client.get("/api/ertesitesek/beallitas", headers=admin_headers).json()
    assert b == {"email_ertesites": False, "email": me["email"]}

    # nincs teendő → nem küld
    assert client.post("/api/ertesitesek/kuldes-most", headers=admin_headers).json() == {"allapot": "nincs_teendo"}
    assert kuldott == []

    _feladat(client, admin_headers, "Lejárt <teendő>", -2, me["id"])
    assert client.put("/api/ertesitesek/beallitas", json={"email_ertesites": True}, headers=admin_headers).json()["email_ertesites"]
    r = client.post("/api/ertesitesek/kuldes-most", headers=admin_headers)
    assert r.json() == {"allapot": "elkuldve"}
    level = kuldott[0]
    assert level["to"] == me["email"]
    assert "1 teendő" in level["subject"]
    assert "Lejárt &lt;teendő&gt;" in level["body"]  # HTML-escape
    assert "lejárt / sürgős" in level["body"]


def test_napi_osszefoglalo_naponta_egyszer_csak_beallitottaknak(client, admin_headers, kuldott):
    from app.services.ertesitesek import kuldj_minden_osszefoglalot

    me = client.get("/api/auth/me", headers=admin_headers).json()
    _feladat(client, admin_headers, "Holnapi", 1, me["id"])

    db = TestingSessionLocal()
    try:
        assert kuldj_minden_osszefoglalot(db) == 0  # még nincs bekapcsolva
        assert kuldott == []
    finally:
        db.close()

    client.put("/api/ertesitesek/beallitas", json={"email_ertesites": True}, headers=admin_headers)
    db = TestingSessionLocal()
    try:
        assert kuldj_minden_osszefoglalot(db) == 1
        assert kuldj_minden_osszefoglalot(db) == 0  # ma már ment
        assert len(kuldott) == 1
        holnap = date.today() + timedelta(days=1)
        assert kuldj_minden_osszefoglalot(db, holnap) == 1  # másnap újra
    finally:
        db.close()


def test_osszefoglalo_smtp_nelkul_nem_jelol_elkuldottnek(client, admin_headers):
    me = client.get("/api/auth/me", headers=admin_headers).json()
    _feladat(client, admin_headers, "X", -1, me["id"])
    r = client.post("/api/ertesitesek/kuldes-most", headers=admin_headers)
    assert r.json() == {"allapot": "nincs_smtp"}  # a conftest üres SMTP_HOST-ot állít
