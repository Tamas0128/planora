import io

from tests.test_crm_sales_dashboard import create_customer


def _quote_file(name="quote.pdf"):
    return {"file": (name, io.BytesIO(b"quote content"), "application/pdf")}


def test_create_quote_with_value_and_update_it(client, admin_headers):
    customer = create_customer(client, admin_headers, name="Quote Value Kft.")
    resp = client.post(
        "/api/crm/quotes",
        data={"customer_id": customer["id"], "value": "1500000"},
        files=_quote_file(),
        headers=admin_headers,
    )
    assert resp.status_code == 200
    quote = resp.json()
    assert quote["value"] == "1500000.00"

    resp = client.patch(
        f"/api/crm/quotes/{quote['id']}", json={"value": "2000000"}, headers=admin_headers
    )
    assert resp.status_code == 200
    assert resp.json()["value"] == "2000000.00"


def test_valid_quotes_summary_excludes_rejected_and_expired(client, admin_headers):
    customer = create_customer(client, admin_headers, name="Valid Quotes Kft.")

    open_quote = client.post(
        "/api/crm/quotes",
        data={"customer_id": customer["id"], "value": "1000000"},
        files=_quote_file(),
        headers=admin_headers,
    ).json()

    rejected_quote = client.post(
        "/api/crm/quotes",
        data={"customer_id": customer["id"], "value": "5000000"},
        files=_quote_file(),
        headers=admin_headers,
    ).json()
    client.patch(
        f"/api/crm/quotes/{rejected_quote['id']}/status",
        json={"status": "rejected"},
        headers=admin_headers,
    )

    resp = client.get("/api/crm/sales-dashboard/valid-quotes", headers=admin_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["count"] == 1
    assert body["total_value"] == "1000000.00"
    assert open_quote["status"] == "draft"
