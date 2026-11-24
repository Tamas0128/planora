import io

import pytest


@pytest.fixture(autouse=True)
def _isolated_upload_dir(tmp_path, monkeypatch):
    monkeypatch.setattr("app.config.settings.upload_dir", str(tmp_path))
    monkeypatch.setattr("app.config.settings.storage_backend", "local")


def _create_projekt(client, headers):
    resp = client.post("/api/projektek", json={"projekt_nev": "Dokumentum teszt projekt"}, headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def test_upload_rejects_disallowed_extension(client, admin_headers):
    projekt_id = _create_projekt(client, admin_headers)
    resp = client.post(
        f"/api/projektek/{projekt_id}/dokumentumok",
        data={"tipus": "egyeb"},
        files={"file": ("script.exe", io.BytesIO(b"xxx"), "application/octet-stream")},
        headers=admin_headers,
    )
    assert resp.status_code == 400, resp.text


def test_upload_rejects_oversized_file(client, admin_headers, monkeypatch):
    monkeypatch.setattr("app.api.dokumentumok.MAX_UPLOAD_BYTES", 10)
    projekt_id = _create_projekt(client, admin_headers)
    resp = client.post(
        f"/api/projektek/{projekt_id}/dokumentumok",
        data={"tipus": "egyeb"},
        files={"file": ("nagy.pdf", io.BytesIO(b"x" * 100), "application/pdf")},
        headers=admin_headers,
    )
    assert resp.status_code == 413, resp.text


def test_upload_list_download_delete_roundtrip(client, admin_headers):
    projekt_id = _create_projekt(client, admin_headers)

    resp = client.post(
        f"/api/projektek/{projekt_id}/dokumentumok",
        data={"tipus": "szerzodes", "megjegyzes": "aláírt példány"},
        files={"file": ("Szerződés — Kovács.pdf", io.BytesIO(b"%PDF-1.4 teszt tartalom"), "application/pdf")},
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.text
    dok = resp.json()
    assert dok["tipus"] == "szerzodes"
    assert dok["eredeti_nev"] == "Szerződés — Kovács.pdf"
    assert dok["tartalom_tipus"] == "application/pdf"
    assert dok["meret"] == len(b"%PDF-1.4 teszt tartalom")
    assert dok["megjegyzes"] == "aláírt példány"
    assert "utvonal" not in dok

    resp = client.get(f"/api/projektek/{projekt_id}/dokumentumok", headers=admin_headers)
    assert resp.status_code == 200, resp.text
    assert len(resp.json()) == 1

    resp = client.get(
        f"/api/projektek/{projekt_id}/dokumentumok/{dok['id']}/letoltes", headers=admin_headers
    )
    assert resp.status_code == 200, resp.text
    assert resp.content == b"%PDF-1.4 teszt tartalom"
    disposition = resp.headers["content-disposition"]
    assert disposition.startswith("attachment;")
    assert "filename*=UTF-8''" in disposition

    resp = client.delete(f"/api/projektek/{projekt_id}/dokumentumok/{dok['id']}", headers=admin_headers)
    assert resp.status_code == 204, resp.text

    resp = client.get(f"/api/projektek/{projekt_id}/dokumentumok", headers=admin_headers)
    assert resp.json() == []

    resp = client.get(
        f"/api/projektek/{projekt_id}/dokumentumok/{dok['id']}/letoltes", headers=admin_headers
    )
    assert resp.status_code == 404


def test_dokumentum_other_projekt_is_404(client, admin_headers):
    projekt1 = _create_projekt(client, admin_headers)
    projekt2 = _create_projekt(client, admin_headers)
    resp = client.post(
        f"/api/projektek/{projekt1}/dokumentumok",
        data={"tipus": "egyeb"},
        files={"file": ("a.pdf", io.BytesIO(b"x"), "application/pdf")},
        headers=admin_headers,
    )
    dok_id = resp.json()["id"]

    resp = client.get(f"/api/projektek/{projekt2}/dokumentumok/{dok_id}/letoltes", headers=admin_headers)
    assert resp.status_code == 404
    resp = client.delete(f"/api/projektek/{projekt2}/dokumentumok/{dok_id}", headers=admin_headers)
    assert resp.status_code == 404


def test_ugyfel_dokumentumai_a_projektjeibol(client, admin_headers):
    ugyfel_id = client.post("/api/ugyfelek", json={"nev": "Dok Ügyfél"}, headers=admin_headers).json()["id"]
    masik_id = client.post("/api/ugyfelek", json={"nev": "Másik Ügyfél"}, headers=admin_headers).json()["id"]
    projekt_id = _create_projekt(client, admin_headers)
    r = client.post(f"/api/projektek/{projekt_id}/ugyfelek", json={"ugyfel_id": ugyfel_id}, headers=admin_headers)
    assert r.status_code == 201, r.text
    up = client.post(
        f"/api/projektek/{projekt_id}/dokumentumok",
        data={"tipus": "tervrajz"},
        files={"file": ("terv.pdf", io.BytesIO(b"%PDF-1.4 x"), "application/pdf")},
        headers=admin_headers,
    )
    assert up.status_code == 201, up.text

    lista = client.get(f"/api/ugyfelek/{ugyfel_id}/dokumentumok", headers=admin_headers)
    assert lista.status_code == 200
    sorok = lista.json()
    assert len(sorok) == 1
    assert sorok[0]["tipus"] == "tervrajz"
    assert sorok[0]["projekt_id"] == projekt_id
    assert sorok[0]["projekt_nev"] == "Dokumentum teszt projekt"

    assert client.get(f"/api/ugyfelek/{masik_id}/dokumentumok", headers=admin_headers).json() == []
    assert client.get("/api/ugyfelek/999999/dokumentumok", headers=admin_headers).status_code == 404
