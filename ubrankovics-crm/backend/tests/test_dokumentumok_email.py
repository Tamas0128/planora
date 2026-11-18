from tests.test_crm_core import _seeded_munkanem_id


def _create_projekt_with_tetel(client, headers, info="<script>alert(1)</script>Teszt infó"):
    resp = client.post("/api/projektek", json={"projekt_nev": "Email teszt projekt"}, headers=headers)
    projekt_id = resp.json()["id"]
    munkanem_id = _seeded_munkanem_id(client, headers)
    resp = client.post(
        f"/api/projektek/{projekt_id}/tetelek",
        json={"munkanem_id": munkanem_id, "info": info},
        headers=headers,
    )
    tetel_id = resp.json()["id"]
    return projekt_id, tetel_id


def test_sablon_elonezet_escapes_user_text(client, admin_headers):
    projekt_id, tetel_id = _create_projekt_with_tetel(client, admin_headers)
    resp = client.post(
        f"/api/projektek/{projekt_id}/sablon-elonezet",
        json={"tipus": "ajanlat", "tetel_ids": [tetel_id]},
        headers=admin_headers,
    )
    assert resp.status_code == 200, resp.text
    html = resp.json()["html"]
    assert "<script>" not in html
    assert "&lt;script&gt;" in html


def test_email_kuldes_without_smtp_returns_503(client, admin_headers):
    projekt_id, tetel_id = _create_projekt_with_tetel(client, admin_headers)
    resp = client.post(
        f"/api/projektek/{projekt_id}/email",
        json={"tipus": "ajanlatkeres", "tetel_ids": [tetel_id], "cimzett": "partner@example.com"},
        headers=admin_headers,
    )
    # Teszt környezetben nincs SMTP_HOST beállítva — a végpontnak erről kell
    # beszámolnia, nem hamis "elküldve" naplót írnia.
    assert resp.status_code == 503, resp.text


def test_email_kuldes_invalid_recipient_rejected(client, admin_headers):
    projekt_id, tetel_id = _create_projekt_with_tetel(client, admin_headers)
    resp = client.post(
        f"/api/projektek/{projekt_id}/email",
        json={"tipus": "ajanlatkeres", "tetel_ids": [tetel_id], "cimzett": "nem-email-cim"},
        headers=admin_headers,
    )
    assert resp.status_code == 422


def test_email_kuldes_success_is_logged(client, admin_headers, monkeypatch):
    monkeypatch.setattr("app.api.dokumentumok_email.send_email", lambda to, subject, html: True)
    projekt_id, tetel_id = _create_projekt_with_tetel(client, admin_headers)

    resp = client.post(
        f"/api/projektek/{projekt_id}/email",
        json={
            "tipus": "tig",
            "tetel_ids": [tetel_id],
            "cimzett": "ugyfel@example.com",
            "uzenet": "Köszönjük!",
        },
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["cimzett"] == "ugyfel@example.com"
    assert body["tetel_ids"] == str(tetel_id)

    resp = client.get(f"/api/projektek/{projekt_id}/emailek", headers=admin_headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_email_kuldes_duplicate_and_unordered_tetel_ids_deduped(client, admin_headers, monkeypatch):
    monkeypatch.setattr("app.api.dokumentumok_email.send_email", lambda to, subject, html: True)
    projekt_id, tetel_id = _create_projekt_with_tetel(client, admin_headers)

    resp = client.post(
        f"/api/projektek/{projekt_id}/email",
        json={
            "tipus": "ajanlat",
            "tetel_ids": [tetel_id, tetel_id],
            "cimzett": "ugyfel@example.com",
        },
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["tetel_ids"] == str(tetel_id)


def test_email_kuldes_tetel_from_other_projekt_is_404(client, admin_headers):
    projekt_id_a, tetel_id_a = _create_projekt_with_tetel(client, admin_headers)
    _projekt_id_b, _tetel_id_b = _create_projekt_with_tetel(client, admin_headers)

    resp = client.post(
        f"/api/projektek/{_projekt_id_b}/email",
        json={"tipus": "ajanlat", "tetel_ids": [tetel_id_a], "cimzett": "ugyfel@example.com"},
        headers=admin_headers,
    )
    assert resp.status_code == 404
