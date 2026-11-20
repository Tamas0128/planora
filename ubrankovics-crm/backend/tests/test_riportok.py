from tests.test_beszerzes_procurement import _create_rendeles, _create_tetel
from tests.test_crm_core import _create_ugyfel


def test_ertekesitesi_allapot_counts_and_sums_by_szakasz(client, admin_headers):
    projekt_id, tetel_id = _create_tetel(client, admin_headers)
    rendeles = _create_rendeles(client, admin_headers, projekt_id, tetel_id)

    resp = client.patch(
        f"/api/projektek/{projekt_id}/tetelek/{tetel_id}/rendelesek/{rendeles['id']}/ugyfel-ar",
        json={"ugyfel_netto": "1000000", "ugyfel_afa_tipus": "afa_27"},
        headers=admin_headers,
    )
    assert resp.status_code == 200, resp.text

    resp = client.get("/api/riportok/ertekesitesi-allapot", headers=admin_headers)
    assert resp.status_code == 200, resp.text
    items = {i["szakasz"]: i for i in resp.json()}
    assert set(items) == {"ajanlat", "szerzodes", "beszerzes", "kivitelezes", "kesz"}
    assert items["ajanlat"]["tetel_szam"] >= 1
    assert float(items["ajanlat"]["ertek_osszesen"]) >= 1270000.0


def test_penzugyi_osszesito_overdue_invoices_and_bank_balance(client, admin_headers):
    projekt_id, _ = _create_tetel(client, admin_headers)
    ugyfel = _create_ugyfel(client, admin_headers, "Riport Ügyfél")

    resp = client.post(
        "/api/cashflow/bankegyenleg", json={"datum": "2026-11-20", "egyenleg": "3000000"}, headers=admin_headers
    )
    assert resp.status_code == 201, resp.text

    resp = client.post(
        f"/api/projektek/{projekt_id}/ugyfel-szamlak",
        json={
            "ugyfel_id": ugyfel["id"],
            "szamlaszam": "RIP-001",
            "kiallitas_datum": "2026-10-01",
            "teljesites_datum": "2026-10-01",
            "esedekesseg": "2026-10-15",
            "netto": "500000",
            "afa_tipus": "afa_27",
        },
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.text

    resp = client.get("/api/riportok/penzugyi-osszesito", headers=admin_headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert len(body["lejart_szamlak"]) == 1
    assert body["lejart_szamlak"][0]["forras_tipus"] == "ugyfel_szamla"
    assert body["lejart_szamlak"][0]["szamlaszam"] == "RIP-001"
    assert float(body["lejart_bevetel_osszesen"]) == 635000.0
    assert float(body["lejart_kiadas_osszesen"]) == 0.0
    assert body["legutobbi_bankegyenleg_datuma"] == "2026-11-20"
    assert float(body["legutobbi_bankegyenleg"]) == 3000000.0


def test_penzugyi_osszesito_empty_when_no_overdue(client, admin_headers):
    resp = client.get("/api/riportok/penzugyi-osszesito", headers=admin_headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["lejart_szamlak"] == []
    assert float(body["lejart_bevetel_osszesen"]) == 0.0
    assert body["legutobbi_bankegyenleg"] is None
