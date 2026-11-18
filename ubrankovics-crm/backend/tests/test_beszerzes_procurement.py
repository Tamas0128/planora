from decimal import Decimal

from tests.test_crm_core import _seeded_munkanem_id


def _create_tetel(client, headers):
    munkanem_id = _seeded_munkanem_id(client, headers)
    resp = client.post("/api/projektek", json={"projekt_nev": "P"}, headers=headers)
    projekt_id = resp.json()["id"]
    resp = client.post(
        f"/api/projektek/{projekt_id}/tetelek", json={"munkanem_id": munkanem_id}, headers=headers
    )
    tetel_id = resp.json()["id"]
    return projekt_id, tetel_id


def _create_rendeles(client, headers, projekt_id, tetel_id, megnevezes="Ablak"):
    resp = client.post(
        f"/api/projektek/{projekt_id}/tetelek/{tetel_id}/rendelesek",
        json={"megnevezes": megnevezes},
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def _rendeles_base(projekt_id, tetel_id, rendeles_id):
    return f"/api/projektek/{projekt_id}/tetelek/{tetel_id}/rendelesek/{rendeles_id}"


def test_rendeles_create_defaults_to_igeny_without_beszerzesi_ar(client, admin_headers):
    projekt_id, tetel_id = _create_tetel(client, admin_headers)
    rendeles = _create_rendeles(client, admin_headers, projekt_id, tetel_id)

    assert rendeles["allapot"] == "igeny"
    assert rendeles["beszerzesi_brutto"] is None
    assert rendeles["kivalasztott_ajanlat_id"] is None
    assert rendeles["ajanlatkeresek"] == []


def test_ajanlatkeres_and_ajanlat_flow_computes_beszerzesi_ar(client, admin_headers):
    projekt_id, tetel_id = _create_tetel(client, admin_headers)
    rendeles = _create_rendeles(client, admin_headers, projekt_id, tetel_id)
    base = _rendeles_base(projekt_id, tetel_id, rendeles["id"])

    resp = client.post(
        f"{base}/ajanlatkeresek",
        json={"cimzett_nev": "Fa-Ker Kft.", "cimzett_email": "info@fa-ker.hu"},
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.text
    ajanlatkeres = resp.json()
    assert ajanlatkeres["allapot"] == "kikuldve"

    # A rendelés az első ajánlatkérésre "ajanlatkeres_alatt" állapotba lép.
    resp = client.get(f"/api/projektek/{projekt_id}/tetelek", headers=admin_headers)
    tetel = resp.json()[0]
    assert tetel["rendelesek"][0]["allapot"] == "ajanlatkeres_alatt"

    resp = client.post(
        f"{base}/ajanlatkeresek/{ajanlatkeres['id']}/ajanlatok",
        json={"netto": "100000.00", "afa_tipus": "afa_27"},
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.text
    ajanlat = resp.json()
    assert ajanlat["afa"] == "27000.00"
    assert ajanlat["brutto"] == "127000.00"

    # Az ajánlatkérés automatikusan "valasz_erkezett" állapotba kerül.
    resp = client.get(f"/api/projektek/{projekt_id}/tetelek", headers=admin_headers)
    tetel = resp.json()[0]
    assert tetel["rendelesek"][0]["ajanlatkeresek"][0]["allapot"] == "valasz_erkezett"

    resp = client.post(
        f"{base}/valaszt-ajanlat", json={"ajanlat_id": ajanlat["id"]}, headers=admin_headers
    )
    assert resp.status_code == 200, resp.text
    rendeles_after = resp.json()
    assert rendeles_after["kivalasztott_ajanlat_id"] == ajanlat["id"]
    assert rendeles_after["beszerzesi_brutto"] == "127000.00"
    assert rendeles_after["beszallito"] == "Fa-Ker Kft."


def test_ajanlat_limit_two_per_ajanlatkeres(client, admin_headers):
    projekt_id, tetel_id = _create_tetel(client, admin_headers)
    rendeles = _create_rendeles(client, admin_headers, projekt_id, tetel_id)
    base = _rendeles_base(projekt_id, tetel_id, rendeles["id"])

    resp = client.post(
        f"{base}/ajanlatkeresek", json={"cimzett_nev": "Beszállító A"}, headers=admin_headers
    )
    ajanlatkeres_id = resp.json()["id"]

    for _ in range(2):
        resp = client.post(
            f"{base}/ajanlatkeresek/{ajanlatkeres_id}/ajanlatok",
            json={"netto": "50000.00", "afa_tipus": "afa_27"},
            headers=admin_headers,
        )
        assert resp.status_code == 201, resp.text

    resp = client.post(
        f"{base}/ajanlatkeresek/{ajanlatkeres_id}/ajanlatok",
        json={"netto": "50000.00", "afa_tipus": "afa_27"},
        headers=admin_headers,
    )
    assert resp.status_code == 400


def test_ugyfel_ar_independent_of_beszerzesi_ar(client, admin_headers):
    projekt_id, tetel_id = _create_tetel(client, admin_headers)
    rendeles = _create_rendeles(client, admin_headers, projekt_id, tetel_id)
    base = _rendeles_base(projekt_id, tetel_id, rendeles["id"])

    resp = client.post(
        f"{base}/ajanlatkeresek", json={"cimzett_nev": "Beszállító A"}, headers=admin_headers
    )
    ajanlatkeres_id = resp.json()["id"]
    resp = client.post(
        f"{base}/ajanlatkeresek/{ajanlatkeres_id}/ajanlatok",
        json={"netto": "100000.00", "afa_tipus": "afa_27"},
        headers=admin_headers,
    )
    ajanlat_id = resp.json()["id"]
    client.post(f"{base}/valaszt-ajanlat", json={"ajanlat_id": ajanlat_id}, headers=admin_headers)

    # Az ügyfélnek kiajánlott ár külön nettó/áfakulccsal, más összeggel.
    resp = client.patch(
        f"{base}/ugyfel-ar",
        json={"ugyfel_netto": "150000.00", "ugyfel_afa_tipus": "afa_5"},
        headers=admin_headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["ugyfel_netto"] == "150000.00"
    assert body["ugyfel_afa"] == "7500.00"
    assert body["ugyfel_brutto"] == "157500.00"

    # A beszerzési ár (kiválasztott ajánlat) nem változott az ügyfél-ár beállítástól.
    assert body["beszerzesi_brutto"] == "127000.00"
    assert body["kivalasztott_ajanlat_id"] == ajanlat_id


def test_valaszt_ajanlat_rejects_foreign_ajanlat(client, admin_headers):
    projekt_id, tetel_id = _create_tetel(client, admin_headers)
    rendeles1 = _create_rendeles(client, admin_headers, projekt_id, tetel_id, "Ablak")
    rendeles2 = _create_rendeles(client, admin_headers, projekt_id, tetel_id, "Ajtó")

    base1 = _rendeles_base(projekt_id, tetel_id, rendeles1["id"])
    base2 = _rendeles_base(projekt_id, tetel_id, rendeles2["id"])

    resp = client.post(
        f"{base1}/ajanlatkeresek", json={"cimzett_nev": "Beszállító A"}, headers=admin_headers
    )
    ajanlatkeres_id = resp.json()["id"]
    resp = client.post(
        f"{base1}/ajanlatkeresek/{ajanlatkeres_id}/ajanlatok",
        json={"netto": "10000.00", "afa_tipus": "afa_27"},
        headers=admin_headers,
    )
    ajanlat_id = resp.json()["id"]

    resp = client.post(
        f"{base2}/valaszt-ajanlat", json={"ajanlat_id": ajanlat_id}, headers=admin_headers
    )
    assert resp.status_code == 404


def test_remove_selected_ajanlat_clears_selection(client, admin_headers):
    projekt_id, tetel_id = _create_tetel(client, admin_headers)
    rendeles = _create_rendeles(client, admin_headers, projekt_id, tetel_id)
    base = _rendeles_base(projekt_id, tetel_id, rendeles["id"])

    resp = client.post(
        f"{base}/ajanlatkeresek", json={"cimzett_nev": "Beszállító A"}, headers=admin_headers
    )
    ajanlatkeres_id = resp.json()["id"]
    resp = client.post(
        f"{base}/ajanlatkeresek/{ajanlatkeres_id}/ajanlatok",
        json={"netto": "10000.00", "afa_tipus": "afa_27"},
        headers=admin_headers,
    )
    ajanlat_id = resp.json()["id"]
    client.post(f"{base}/valaszt-ajanlat", json={"ajanlat_id": ajanlat_id}, headers=admin_headers)

    resp = client.delete(
        f"{base}/ajanlatkeresek/{ajanlatkeres_id}/ajanlatok/{ajanlat_id}", headers=admin_headers
    )
    assert resp.status_code == 204, resp.text

    resp = client.get(f"/api/projektek/{projekt_id}/tetelek", headers=admin_headers)
    rendeles_after = resp.json()[0]["rendelesek"][0]
    assert rendeles_after["kivalasztott_ajanlat_id"] is None
    assert rendeles_after["beszerzesi_brutto"] is None


def test_full_po_delivery_invoice_workflow(client, admin_headers):
    projekt_id, tetel_id = _create_tetel(client, admin_headers)
    rendeles = _create_rendeles(client, admin_headers, projekt_id, tetel_id)
    base = _rendeles_base(projekt_id, tetel_id, rendeles["id"])

    resp = client.patch(
        base,
        json={
            "allapot": "megrendelve",
            "po_szam": "PO-2026-001",
            "jovahagyva": True,
            "jovahagyas_datum": "2026-11-18",
            "megrendeles_datum": "2026-11-18",
        },
        headers=admin_headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["allapot"] == "megrendelve"
    assert resp.json()["jovahagyva"] is True

    resp = client.patch(
        base,
        json={
            "allapot": "megerkezett",
            "tenyleges_erkezes": "2026-12-01",
            "atvett_mennyiseg": "10",
        },
        headers=admin_headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["allapot"] == "megerkezett"

    resp = client.patch(
        base,
        json={"szamla_szam": "SZ-2026-100", "szamla_allapot": "kifizetve", "szamla_osszeg": "127000.00"},
        headers=admin_headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["szamla_allapot"] == "kifizetve"
    assert body["szamla_osszeg"] == "127000.00"
