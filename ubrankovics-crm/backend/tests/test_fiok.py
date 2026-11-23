import re

import pytest

from app.core import totp
from app.models import User
from tests.conftest import TestingSessionLocal


@pytest.fixture
def levelek(monkeypatch):
    lista = []

    def fake(to, subject, body, extra_headers=None):
        lista.append({"to": to, "subject": subject, "body": body})
        return True

    monkeypatch.setattr("app.api.fiok.send_email", fake)
    return lista


def _login(client, password="admin123", otp=None):
    body = {"username": "admin", "password": password}
    if otp:
        body["otp"] = otp
    return client.post("/api/auth/login/json", json=body)


def _admin_email():
    db = TestingSessionLocal()
    try:
        return db.query(User).filter(User.username == "admin").first().email
    finally:
        db.close()


# --- TOTP egység ------------------------------------------------------------------------


def test_totp_rfc6238_vektor():
    # RFC 6238 SHA1 tesztvektor: secret "12345678901234567890", T=59s → 94287082 (8 jegy) → 6 jegyű: 287082
    import base64

    secret = base64.b32encode(b"12345678901234567890").decode()
    assert totp._code(secret, 59 // 30) == "287082"
    assert totp.verify(secret, "287082", now=59) == 1
    assert totp.verify(secret, "287082", now=59, last_step=1) is None  # nem használható újra
    assert totp.verify(secret, "000000", now=59) is None
    assert totp.verify(secret, "abc", now=59) is None


# --- Elfelejtett jelszó -------------------------------------------------------------------


def test_jelszo_visszaallitas_teljes_folyamat(client, levelek):
    r = client.post("/api/auth/elfelejtett-jelszo", json={"azonosito": "admin"})
    assert r.status_code == 200 and len(levelek) == 1
    token = re.search(r"token=([\w-]+)", levelek[0]["body"]).group(1)
    assert levelek[0]["to"] == _admin_email()

    # túl rövid jelszó elutasítva, rossz token elutasítva
    assert client.post("/api/auth/uj-jelszo", json={"token": token, "password": "rovid"}).status_code == 422
    assert client.post("/api/auth/uj-jelszo", json={"token": "x" * 30, "password": "ujjelszo123"}).status_code == 400

    ok = client.post("/api/auth/uj-jelszo", json={"token": token, "password": "ujjelszo123"})
    assert ok.status_code == 200, ok.text
    assert _login(client, "ujjelszo123").status_code == 200
    assert _login(client, "admin123").status_code == 401
    # a token egyszer használható
    assert client.post("/api/auth/uj-jelszo", json={"token": token, "password": "masikjelszo1"}).status_code == 400


def test_jelszo_visszaallitas_nem_arulkodik_es_regi_link_ervenytelen(client, levelek):
    ismeretlen = client.post("/api/auth/elfelejtett-jelszo", json={"azonosito": "nincs-ilyen"})
    assert ismeretlen.status_code == 200 and levelek == []
    assert ismeretlen.json() == client.post("/api/auth/elfelejtett-jelszo", json={"azonosito": "admin"}).json()

    client.post("/api/auth/elfelejtett-jelszo", json={"azonosito": _admin_email()})
    regi = re.search(r"token=([\w-]+)", levelek[0]["body"]).group(1)
    uj = re.search(r"token=([\w-]+)", levelek[1]["body"]).group(1)
    assert client.post("/api/auth/uj-jelszo", json={"token": regi, "password": "ujjelszo123"}).status_code == 400
    assert client.post("/api/auth/uj-jelszo", json={"token": uj, "password": "ujjelszo123"}).status_code == 200


def test_jelszo_visszaallitas_lejart_token(client, levelek):
    from datetime import datetime, timedelta

    from app.models_auth import JelszoVisszaallitas

    client.post("/api/auth/elfelejtett-jelszo", json={"azonosito": "admin"})
    token = re.search(r"token=([\w-]+)", levelek[0]["body"]).group(1)
    db = TestingSessionLocal()
    rec = db.query(JelszoVisszaallitas).first()
    rec.lejar = datetime.utcnow() - timedelta(minutes=1)
    db.commit()
    db.close()
    assert client.post("/api/auth/uj-jelszo", json={"token": token, "password": "ujjelszo123"}).status_code == 400


# --- 2FA --------------------------------------------------------------------------------------


def test_2fa_bekapcsolas_belepes_es_kikapcsolas(client, admin_headers):
    s = client.post("/api/auth/2fa/beallitas", headers=admin_headers)
    assert s.status_code == 200, s.text
    secret = s.json()["secret"]
    assert s.json()["otpauth_uri"].startswith("otpauth://totp/")

    # hibás kóddal nem kapcsol be
    assert client.post("/api/auth/2fa/bekapcsolas", json={"code": "000000"}, headers=admin_headers).status_code == 400
    code = totp._code(secret, totp.current_step())
    assert client.post("/api/auth/2fa/bekapcsolas", json={"code": code}, headers=admin_headers).status_code == 200
    assert client.get("/api/auth/me", headers=admin_headers).json()["totp_enabled"] is True

    # OTP nélkül nincs belépés; ugyanazzal a kóddal sem (újrajátszás)
    r = _login(client)
    assert r.status_code == 401 and r.json()["detail"] == "otp_required"
    assert _login(client, otp=code).status_code == 401
    kov = totp._code(secret, totp.current_step() + 1)
    assert _login(client, otp=kov).status_code == 200
    # az OAuth2 űrlapos belépés 2FA fióknál nem megy
    form = client.post("/api/auth/login", data={"username": "admin", "password": "admin123"})
    assert form.status_code == 401

