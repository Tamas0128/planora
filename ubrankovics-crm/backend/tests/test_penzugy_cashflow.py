from datetime import date, timedelta

from tests.test_crm_core import _create_ugyfel


def _create_projekt(client, headers, nev="P"):
    resp = client.post("/api/projektek", json={"projekt_nev": nev}, headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _create_alvallalkozo(client, headers, nev="Alvállalkozó Bt."):
    resp = client.post("/api/alvallalkozok", json={"nev": nev}, headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _monday_of_this_week() -> date:
    today = date.today()
    return today - timedelta(days=today.weekday())


def test_tig_and_alvallalkozoi_szamla_compute_afa(client, admin_headers):
    projekt_id = _create_projekt(client, admin_headers)
    alv_id = _create_alvallalkozo(client, admin_headers)

    resp = client.post(
        f"/api/projektek/{projekt_id}/tig",
        json={
            "alvallalkozo_id": alv_id,
            "datum": "2026-11-20",
            "idoszak_kezdet": "2026-11-01",
            "idoszak_veg": "2026-11-20",
            "netto": "1000000",
            "afa_tipus": "forditott",
        },
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.text
    tig = resp.json()
    assert tig["afa"] == "0.00"
    assert tig["brutto"] == "1000000.00"

    resp = client.post(
        f"/api/projektek/{projekt_id}/alvallalkozoi-szamlak",
        json={
            "alvallalkozo_id": alv_id,
            "tig_id": tig["id"],
            "szamlaszam": "ALV-2026-001",
            "teljesites_datum": "2026-11-20",
            "kiallitas_datum": "2026-11-20",
            "esedekesseg": "2026-12-04",
            "netto": "1000000",
            "afa_tipus": "forditott",
        },
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.text
    szamla = resp.json()
    assert szamla["brutto"] == "1000000.00"
    assert szamla["hatralek"] == "1000000.00"

    resp = client.patch(
        f"/api/projektek/{projekt_id}/alvallalkozoi-szamlak/{szamla['id']}",
        json={"allapot": "kifizetve", "fizetett_osszeg": "1000000", "fizetes_datum": "2026-12-01"},
        headers=admin_headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["hatralek"] == "0.00"


def test_szerzodes_reszlet_szamla_kiallitas_moves_item_to_actual_layer(client, admin_headers):
    projekt_id = _create_projekt(client, admin_headers)
    ugyfel = _create_ugyfel(client, admin_headers)

    resp = client.post(
        f"/api/projektek/{projekt_id}/szerzodesek",
        json={
            "ugyfel_id": ugyfel["id"],
            "szerzodesszam": "SZ-2026-001",
            "osszeg": "10000000",
            "afa_tipus": "afa_27",
            "kezdes": "2026-11-01",
            "befejezes": "2027-03-01",
            "reszletek": [
                {"megnevezes": "Előleg", "osszeg": "3000000", "esedekesseg": "2026-11-25"},
                {"megnevezes": "Készültségi 1", "osszeg": "3000000", "esedekesseg": "2026-12-20"},
            ],
        },
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.text
    szerzodes = resp.json()
    assert len(szerzodes["reszletek"]) == 2
    reszlet = szerzodes["reszletek"][0]
    assert reszlet["kiallitott_szamla_id"] is None

    resp = client.post(
        f"/api/projektek/{projekt_id}/szerzodesek/{szerzodes['id']}/reszletek/{reszlet['id']}/szamla-kiallitas",
        json={
            "szamlaszam": "UGY-2026-001",
            "kiallitas_datum": "2026-11-25",
            "teljesites_datum": "2026-11-25",
            "esedekesseg": "2026-12-09",
        },
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.text
    szamla = resp.json()
    assert szamla["netto"] == "3000000.00"
    assert szamla["afa"] == "810000.00"
    assert szamla["brutto"] == "3810000.00"

    # A szerződésen a részlet már a kiállított számlára mutat.
    resp = client.get(f"/api/projektek/{projekt_id}/szerzodesek", headers=admin_headers)
    reszletek = resp.json()[0]["reszletek"]
    kiallitott = next(r for r in reszletek if r["id"] == reszlet["id"])
    assert kiallitott["kiallitott_szamla_id"] == szamla["id"]

    # Duplikált kiállítás a már-kiállított részletre tilos.
    resp = client.post(
        f"/api/projektek/{projekt_id}/szerzodesek/{szerzodes['id']}/reszletek/{reszlet['id']}/szamla-kiallitas",
        json={
            "szamlaszam": "UGY-2026-002",
            "kiallitas_datum": "2026-11-26",
            "teljesites_datum": "2026-11-26",
            "esedekesseg": "2026-12-10",
        },
        headers=admin_headers,
    )
    assert resp.status_code == 400


def test_rolling_cashflow_opening_balance_from_latest_snapshot(client, admin_headers):
    resp = client.post(
        "/api/cashflow/bankegyenleg",
        json={"datum": "2026-11-01", "egyenleg": "5000000"},
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.text

    resp = client.post(
        "/api/cashflow/bankegyenleg",
        json={"datum": "2026-11-15", "egyenleg": "8000000"},
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.text

    resp = client.get("/api/cashflow/rolling?bucket=het&horizon=4", headers=admin_headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["nyito_egyenleg_datuma"] == "2026-11-15"
    assert len(body["bucketek"]) == 4
    assert body["bucketek"][0]["nyito"] == "8000000.00"
    # Lánc: minden bucket nyitója az előző záróegyenlege.
    for prev, nxt in zip(body["bucketek"], body["bucketek"][1:]):
        assert nxt["nyito"] == prev["zaro"]


def test_rolling_cashflow_includes_open_invoice_in_due_bucket(client, admin_headers):
    projekt_id = _create_projekt(client, admin_headers)
    ugyfel = _create_ugyfel(client, admin_headers)

    monday = _monday_of_this_week()
    esedekesseg = (monday + timedelta(days=3)).isoformat()

    resp = client.post(
        f"/api/projektek/{projekt_id}/ugyfel-szamlak",
        json={
            "ugyfel_id": ugyfel["id"],
            "szamlaszam": "UGY-2026-010",
            "kiallitas_datum": monday.isoformat(),
            "teljesites_datum": monday.isoformat(),
            "esedekesseg": esedekesseg,
            "netto": "1000000",
            "afa_tipus": "afa_27",
        },
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.text

    resp = client.get("/api/cashflow/rolling?bucket=het&horizon=2", headers=admin_headers)
    assert resp.status_code == 200, resp.text
    first_bucket = resp.json()["bucketek"][0]
    assert first_bucket["bevetel_teny"] == "1270000.00"

    resp = client.get(
        f"/api/cashflow/rolling/items?bucket=het&horizon=2&kezdo_datum={monday.isoformat()}",
        headers=admin_headers,
    )
    assert resp.status_code == 200, resp.text
    items = resp.json()
    assert any(i["forras_tipus"] == "ugyfel_szamla" and i["reteg"] == "teny" for i in items)


def test_rolling_cashflow_overdue_unpaid_invoice_pushed_to_first_bucket(client, admin_headers):
    projekt_id = _create_projekt(client, admin_headers)
    ugyfel = _create_ugyfel(client, admin_headers)

    overdue = (date.today() - timedelta(days=30)).isoformat()
    resp = client.post(
        f"/api/projektek/{projekt_id}/ugyfel-szamlak",
        json={
            "ugyfel_id": ugyfel["id"],
            "szamlaszam": "UGY-2026-020",
            "kiallitas_datum": overdue,
            "teljesites_datum": overdue,
            "esedekesseg": overdue,
            "netto": "500000",
            "afa_tipus": "afa_0",
        },
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.text

    resp = client.get("/api/cashflow/rolling?bucket=het&horizon=3", headers=admin_headers)
    body = resp.json()
    assert body["bucketek"][0]["bevetel_teny"] == "500000.00"
    assert float(body["bucketek"][1]["bevetel_teny"]) == 0


def test_rolling_cashflow_negative_balance_flagged(client, admin_headers):
    projekt_id = _create_projekt(client, admin_headers)
    alv_id = _create_alvallalkozo(client, admin_headers)

    resp = client.post(
        "/api/cashflow/bankegyenleg", json={"datum": "2026-11-01", "egyenleg": "100000"}, headers=admin_headers
    )
    assert resp.status_code == 201

    monday = _monday_of_this_week()
    resp = client.post(
        f"/api/projektek/{projekt_id}/alvallalkozoi-szamlak",
        json={
            "alvallalkozo_id": alv_id,
            "szamlaszam": "ALV-2026-050",
            "teljesites_datum": monday.isoformat(),
            "kiallitas_datum": monday.isoformat(),
            "esedekesseg": monday.isoformat(),
            "netto": "9000000",
            "afa_tipus": "forditott",
        },
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.text

    resp = client.get("/api/cashflow/rolling?bucket=het&horizon=2", headers=admin_headers)
    bucket = resp.json()["bucketek"][0]
    assert bucket["negativ"] is True
    assert float(bucket["zaro"]) < 0


def test_berkoltseg_crud_requires_unique_month(client, admin_headers):
    resp = client.post(
        "/api/berkoltsegek", json={"honap": "2026-12-01", "osszeg": "4500000"}, headers=admin_headers
    )
    assert resp.status_code == 201, resp.text

    resp = client.post(
        "/api/berkoltsegek", json={"honap": "2026-12-01", "osszeg": "4700000"}, headers=admin_headers
    )
    assert resp.status_code == 400
