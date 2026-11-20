import io

from openpyxl import Workbook

from tests.test_crm_core import _create_ugyfel


def _xlsx_bytes(header: list[str], rows: list[list]) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.append(header)
    for row in rows:
        ws.append(row)
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf.read()


def _create_projekt(client, headers, nev="Bankkivonat teszt projekt"):
    resp = client.post("/api/projektek", json={"projekt_nev": nev}, headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _create_nyitott_ugyfel_szamla(client, headers, projekt_id, ugyfel, szamlaszam, netto="500000"):
    resp = client.post(
        f"/api/projektek/{projekt_id}/ugyfel-szamlak",
        json={
            "ugyfel_id": ugyfel["id"],
            "szamlaszam": szamlaszam,
            "kiallitas_datum": "2026-11-01",
            "teljesites_datum": "2026-11-01",
            "esedekesseg": "2026-11-15",
            "netto": netto,
            "afa_tipus": "afa_27",
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_elemzes_matches_by_szamlaszam(client, admin_headers):
    projekt_id = _create_projekt(client, admin_headers)
    ugyfel = _create_ugyfel(client, admin_headers, "Bankkivonat Ügyfél Kft.")
    szamla = _create_nyitott_ugyfel_szamla(client, admin_headers, projekt_id, ugyfel, "BK-2026-001")

    content = _xlsx_bytes(
        ["Könyvelés dátuma", "Összeg", "Közlemény"],
        [["2026.11.20.", 635000, "Átutalás BK-2026-001 számlára"]],
    )
    resp = client.post(
        "/api/bankkivonat/elemzes",
        files={"file": ("kivonat.xlsx", content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        headers=admin_headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["sorok_szama"] == 1
    assert body["egyeztetett_szama"] == 1
    sor = body["sorok"][0]
    assert sor["irany"] == "bevetel"
    assert float(sor["osszeg"]) == 635000.0
    assert sor["javaslat"]["forras_tipus"] == "ugyfel_szamla"
    assert sor["javaslat"]["forras_id"] == szamla["id"]
    assert sor["javaslat"]["projekt_id"] == projekt_id
    assert sor["javaslat"]["biztos"] is True


def test_elemzes_matches_by_partner_name_when_unambiguous(client, admin_headers):
    projekt_id = _create_projekt(client, admin_headers)
    ugyfel = _create_ugyfel(client, admin_headers, "Egyedi Partner Kft.")
    szamla = _create_nyitott_ugyfel_szamla(client, admin_headers, projekt_id, ugyfel, "BK-2026-002")

    content = _xlsx_bytes(
        ["Dátum", "Összeg", "Megjegyzés"],
        [["2026-11-20", 635000, "Utalás Egyedi Partner Kft. résztől"]],
    )
    resp = client.post(
        "/api/bankkivonat/elemzes",
        files={"file": ("kivonat.xlsx", content, "application/octet-stream")},
        headers=admin_headers,
    )
    assert resp.status_code == 200, resp.text
    sor = resp.json()["sorok"][0]
    assert sor["javaslat"]["forras_id"] == szamla["id"]
    assert sor["javaslat"]["biztos"] is False


def test_elemzes_ambiguous_partner_lists_alternatives(client, admin_headers):
    projekt_id = _create_projekt(client, admin_headers)
    ugyfel = _create_ugyfel(client, admin_headers, "Ambiguous Kft.")
    _create_nyitott_ugyfel_szamla(client, admin_headers, projekt_id, ugyfel, "BK-2026-003", netto="100000")
    _create_nyitott_ugyfel_szamla(client, admin_headers, projekt_id, ugyfel, "BK-2026-004", netto="200000")

    content = _xlsx_bytes(
        ["Dátum", "Összeg", "Közlemény"],
        [["2026-11-20", 127000, "Ambiguous Kft. részteljesítés"]],
    )
    resp = client.post(
        "/api/bankkivonat/elemzes",
        files={"file": ("kivonat.xlsx", content, "application/octet-stream")},
        headers=admin_headers,
    )
    assert resp.status_code == 200, resp.text
    sor = resp.json()["sorok"][0]
    assert sor["javaslat"] is None
    assert len(sor["alternativak"]) == 2


def test_elemzes_kiadas_irany_negative_amount(client, admin_headers):
    projekt_id = _create_projekt(client, admin_headers)
    resp = client.post("/api/alvallalkozok", json={"nev": "BK Alvállalkozó Bt."}, headers=admin_headers)
    alv = resp.json()
    resp = client.post(
        f"/api/projektek/{projekt_id}/alvallalkozoi-szamlak",
        json={
            "alvallalkozo_id": alv["id"],
            "szamlaszam": "ALV-BK-001",
            "teljesites_datum": "2026-11-01",
            "kiallitas_datum": "2026-11-01",
            "esedekesseg": "2026-11-15",
            "netto": "300000",
            "afa_tipus": "forditott",
        },
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.text
    szamla = resp.json()

    content = _xlsx_bytes(
        ["Dátum", "Összeg", "Közlemény"],
        [["2026-11-20", -300000, "Kifizetés ALV-BK-001"]],
    )
    resp = client.post(
        "/api/bankkivonat/elemzes",
        files={"file": ("kivonat.xlsx", content, "application/octet-stream")},
        headers=admin_headers,
    )
    assert resp.status_code == 200, resp.text
    sor = resp.json()["sorok"][0]
    assert sor["irany"] == "kiadas"
    assert float(sor["osszeg"]) == 300000.0
    assert sor["javaslat"]["forras_id"] == szamla["id"]


def test_elemzes_rejects_file_without_recognizable_header(client, admin_headers):
    content = _xlsx_bytes(["Valami", "Más"], [["x", "y"]])
    resp = client.post(
        "/api/bankkivonat/elemzes",
        files={"file": ("kivonat.xlsx", content, "application/octet-stream")},
        headers=admin_headers,
    )
    assert resp.status_code == 400


def test_jovahagyas_full_payment_sets_fizetes_datum_and_attaches_document(client, admin_headers):
    projekt_id = _create_projekt(client, admin_headers)
    ugyfel = _create_ugyfel(client, admin_headers, "Jóváhagyás Ügyfél Kft.")
    szamla = _create_nyitott_ugyfel_szamla(client, admin_headers, projekt_id, ugyfel, "BK-2026-010")

    content = _xlsx_bytes(["Dátum", "Összeg", "Közlemény"], [["2026-11-20", 635000, "BK-2026-010"]])
    resp = client.post(
        "/api/bankkivonat/jovahagyas",
        files={"file": ("kivonat.xlsx", content, "application/octet-stream")},
        data={
            "jovahagyott_tetelek": (
                f'[{{"forras_tipus": "ugyfel_szamla", "forras_id": {szamla["id"]}, '
                f'"datum": "2026-11-20", "osszeg": "635000"}}]'
            )
        },
        headers=admin_headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["feldolgozott_szama"] == 1
    assert body["erintett_projektek"] == [projekt_id]

    resp = client.get(f"/api/projektek/{projekt_id}/ugyfel-szamlak", headers=admin_headers)
    updated = resp.json()[0]
    assert updated["allapot"] == "kifizetve"
    assert updated["fizetes_datum"] == "2026-11-20"
    assert float(updated["fizetett_osszeg"]) == 635000.0

    resp = client.get(f"/api/projektek/{projekt_id}/dokumentumok", headers=admin_headers)
    dokumentumok = resp.json()
    assert any(d["tipus"] == "bankkivonat" for d in dokumentumok)


def test_jovahagyas_partial_payment_leaves_fizetes_datum_null(client, admin_headers):
    projekt_id = _create_projekt(client, admin_headers)
    ugyfel = _create_ugyfel(client, admin_headers, "Részfizetés Ügyfél Kft.")
    szamla = _create_nyitott_ugyfel_szamla(client, admin_headers, projekt_id, ugyfel, "BK-2026-020")

    content = _xlsx_bytes(["Dátum", "Összeg", "Közlemény"], [["2026-11-20", 300000, "BK-2026-020 részlet"]])
    resp = client.post(
        "/api/bankkivonat/jovahagyas",
        files={"file": ("kivonat.xlsx", content, "application/octet-stream")},
        data={
            "jovahagyott_tetelek": (
                f'[{{"forras_tipus": "ugyfel_szamla", "forras_id": {szamla["id"]}, '
                f'"datum": "2026-11-20", "osszeg": "300000"}}]'
            )
        },
        headers=admin_headers,
    )
    assert resp.status_code == 200, resp.text

    resp = client.get(f"/api/projektek/{projekt_id}/ugyfel-szamlak", headers=admin_headers)
    updated = resp.json()[0]
    assert updated["allapot"] == "reszben_fizetve"
    assert updated["fizetes_datum"] is None
    assert float(updated["fizetett_osszeg"]) == 300000.0
    assert float(updated["hatralek"]) == 335000.0
