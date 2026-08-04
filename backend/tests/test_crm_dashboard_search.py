import io


def create_customer(client, headers, **overrides):
    body = {"type": "company", "name": "Dash Kft.", "owner_id": 1}
    body.update(overrides)
    return client.post("/api/crm/customers", json=body, headers=headers).json()


def _quote_file():
    return {"file": ("quote.pdf", io.BytesIO(b"quote content"), "application/pdf")}


def _contract_file():
    return {"file": ("contract.pdf", io.BytesIO(b"contract content"), "application/pdf")}


def make_accepted_quote(client, headers, customer_id):
    q = client.post(
        "/api/crm/quotes", data={"customer_id": customer_id}, files=_quote_file(), headers=headers
    ).json()
    client.patch(f"/api/crm/quotes/{q['id']}/status", json={"status": "accepted"}, headers=headers)
    return q


def test_dashboard_stats_shape(client, admin_headers):
    create_customer(client, admin_headers)
    resp = client.get("/api/crm/dashboard/stats", headers=admin_headers)
    assert resp.status_code == 200
    body = resp.json()
    for key in (
        "total_customers", "active_customers", "new_customers_30d",
        "customers_by_type", "open_tasks", "active_contracts",
        "expiring_contracts_30d", "pending_quotes",
    ):
        assert key in body


def test_dashboard_pending_quotes_and_active_contracts(client, admin_headers):
    customer = create_customer(client, admin_headers, name="Pending Kft.")
    quote = client.post(
        "/api/crm/quotes", data={"customer_id": customer["id"]}, files=_quote_file(), headers=admin_headers
    ).json()
    client.patch(f"/api/crm/quotes/{quote['id']}/status", json={"status": "sent"}, headers=admin_headers)

    stats = client.get("/api/crm/dashboard/stats", headers=admin_headers).json()
    assert stats["pending_quotes"] >= 1

    accepted_quote = make_accepted_quote(client, admin_headers, customer["id"])
    client.post(
        f"/api/crm/quotes/{accepted_quote['id']}/create-contract",
        data={"start_date": "2026-08-01", "end_date": "2027-08-01"},
        files=_contract_file(),
        headers=admin_headers,
    )
    stats2 = client.get("/api/crm/dashboard/stats", headers=admin_headers).json()
    assert stats2["active_contracts"] >= 1


def test_dashboard_scoped_by_owner_for_project_manager(client, admin_headers):
    from tests.conftest import create_user, login

    create_user(client, admin_headers, "sales1", "project_manager")
    headers1 = login(client, "sales1")
    create_customer(client, headers1, name="Sales1 Only Kft.")
    create_customer(client, admin_headers, name="Admin Only Kft.")

    stats1 = client.get("/api/crm/dashboard/stats", headers=headers1).json()
    stats_admin = client.get("/api/crm/dashboard/stats", headers=admin_headers).json()
    assert stats1["new_customers_30d"] == 1
    assert stats_admin["new_customers_30d"] >= 2


def test_crm_search_finds_customer_by_name_and_number(client, admin_headers):
    customer = create_customer(client, admin_headers, name="Findme Kft.")
    resp = client.get("/api/crm/search?q=Findme", headers=admin_headers)
    assert resp.status_code == 200
    results = resp.json()
    assert any(r["type"] == "customer" and r["id"] == customer["id"] for r in results)

    resp2 = client.get(f"/api/crm/search?q={customer['customer_number']}", headers=admin_headers)
    assert any(r["id"] == customer["id"] for r in resp2.json())


def test_crm_search_scoped_for_project_manager(client, admin_headers):
    from tests.conftest import create_user, login

    create_user(client, admin_headers, "sales1", "project_manager")
    create_user(client, admin_headers, "sales2", "project_manager")
    headers1 = login(client, "sales1")
    headers2 = login(client, "sales2")
    create_customer(client, headers1, name="Scoped Search Kft.")

    resp1 = client.get("/api/crm/search?q=Scoped", headers=headers1).json()
    resp2 = client.get("/api/crm/search?q=Scoped", headers=headers2).json()
    assert len(resp1) == 1
    assert len(resp2) == 0


def test_billing_role_sees_all_contracts_unscoped(client, admin_headers):
    from tests.conftest import create_user, login

    create_user(client, admin_headers, "sales1", "project_manager")
    create_user(client, admin_headers, "biller", "billing")
    headers1 = login(client, "sales1")
    billing_headers = login(client, "biller")

    customer = create_customer(client, headers1, name="Billing Test Kft.")
    quote = make_accepted_quote(client, headers1, customer["id"])
    contract = client.post(
        f"/api/crm/quotes/{quote['id']}/create-contract",
        data={"start_date": "2026-08-01", "end_date": "2027-08-01"},
        files=_contract_file(),
        headers=headers1,
    ).json()

    # BILLING ("Operáció") sees all contracts, not just ones tied to
    # customers it owns — unlike PROJECT_MANAGER/SITE_MANAGER (dev plan 11.1).
    seen_by_billing = client.get("/api/crm/contracts", headers=billing_headers).json()
    assert any(c["id"] == contract["id"] for c in seen_by_billing)
