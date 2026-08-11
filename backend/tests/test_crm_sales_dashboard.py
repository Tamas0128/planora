from datetime import date, timedelta


def create_customer(client, headers, **overrides):
    body = {"type": "company", "name": "Sales Dash Kft.", "owner_id": 1}
    body.update(overrides)
    return client.post("/api/crm/customers", json=body, headers=headers).json()


def make_signed_contract(client, headers, customer_id, value=None, quote_status="accepted"):
    quote = client.post(
        "/api/crm/quotes", json={"customer_id": customer_id, "content_json": {}}, headers=headers
    ).json()
    client.patch(f"/api/crm/quotes/{quote['id']}/status", json={"status": "sent"}, headers=headers)
    client.patch(
        f"/api/crm/quotes/{quote['id']}/status", json={"status": quote_status}, headers=headers
    )
    contract = client.post(
        f"/api/crm/quotes/{quote['id']}/create-contract",
        json={
            "start_date": "2026-08-01",
            "end_date": "2027-08-01",
            "value": value,
            "project_code": f"CRM-SD-{customer_id}",
            "settlement": "Szeged",
            "address": "Fő utca 3",
            "floor_area_sqm": 100,
            "delivery_date": "2027-06-01",
        },
        headers=headers,
    ).json()
    return quote, contract


def this_week_start(today: date) -> date:
    return today - timedelta(days=today.weekday())


def this_month_start(today: date) -> date:
    return today.replace(day=1)


def test_weekly_shape(client, admin_headers):
    resp = client.get("/api/crm/sales-dashboard/weekly", headers=admin_headers)
    assert resp.status_code == 200
    body = resp.json()
    for key in (
        "week_start", "week_end", "contracts_signed_count", "contracts_signed_value",
        "active_customers", "new_inquiries", "quotes_sent", "site_visits", "pipeline",
    ):
        assert key in body


def test_monthly_shape_and_trend_length(client, admin_headers):
    resp = client.get("/api/crm/sales-dashboard/monthly", headers=admin_headers)
    assert resp.status_code == 200
    body = resp.json()
    for key in (
        "month", "total_contracted_value", "average_contract_value",
        "average_sales_cycle_days", "trend", "source_breakdown", "funnel",
    ):
        assert key in body
    assert len(body["trend"]) == 6


def test_weekly_contracts_signed_value_and_count(client, admin_headers):
    today = date.today()
    week_start = this_week_start(today)

    customer = create_customer(client, admin_headers, name="Weekly Signed Kft.")
    _, contract = make_signed_contract(client, admin_headers, customer["id"], value="85000000")
    assert contract["signed_at"] is not None
    assert contract["value"] == "85000000.00"

    resp = client.get(
        f"/api/crm/sales-dashboard/weekly?week_start={week_start.isoformat()}", headers=admin_headers
    )
    body = resp.json()
    assert body["contracts_signed_count"] >= 1
    assert float(body["contracts_signed_value"]) >= 85_000_000


def test_weekly_pipeline_covers_all_customers(client, admin_headers):
    create_customer(client, admin_headers, name="Pipeline A Kft.")
    resp = client.get("/api/crm/sales-dashboard/weekly", headers=admin_headers)
    pipeline = resp.json()["pipeline"]
    total_in_pipeline = sum(b["count"] for b in pipeline)
    all_customers = client.get("/api/crm/customers", headers=admin_headers).json()
    assert total_in_pipeline == len(all_customers)


def test_monthly_source_breakdown_includes_unknown_bucket(client, admin_headers):
    today = date.today()
    month_start = this_month_start(today)

    customer = create_customer(client, admin_headers, name="No Source Kft.")  # source omitted -> None
    make_signed_contract(client, admin_headers, customer["id"], value="10000000")

    resp = client.get(
        f"/api/crm/sales-dashboard/monthly?month={month_start.isoformat()}", headers=admin_headers
    )
    breakdown = resp.json()["source_breakdown"]
    assert any(b["source"] is None for b in breakdown)


def test_monthly_source_breakdown_respects_customer_source(client, admin_headers):
    today = date.today()
    month_start = this_month_start(today)

    customer = create_customer(
        client, admin_headers, name="Referral Kft.", source="referral"
    )
    make_signed_contract(client, admin_headers, customer["id"], value="20000000")

    resp = client.get(
        f"/api/crm/sales-dashboard/monthly?month={month_start.isoformat()}", headers=admin_headers
    )
    breakdown = resp.json()["source_breakdown"]
    assert any(b["source"] == "referral" and b["count"] >= 1 for b in breakdown)


def test_monthly_contracts_without_value_are_excluded_from_average(client, admin_headers):
    today = date.today()
    month_start = this_month_start(today)

    customer = create_customer(client, admin_headers, name="No Value Kft.")
    make_signed_contract(client, admin_headers, customer["id"], value=None)

    resp = client.get(
        f"/api/crm/sales-dashboard/monthly?month={month_start.isoformat()}", headers=admin_headers
    )
    body = resp.json()
    # A NULL-value contract must not crash the average and must not count
    # as a zero — it's simply excluded (see plan §5's documented limitation).
    assert resp.status_code == 200
    if body["average_contract_value"] is not None:
        assert float(body["average_contract_value"]) > 0


def test_monthly_funnel_percentages_bounded(client, admin_headers):
    today = date.today()
    month_start = this_month_start(today)
    customer = create_customer(client, admin_headers, name="Funnel Kft.")
    make_signed_contract(client, admin_headers, customer["id"], value="5000000")

    resp = client.get(
        f"/api/crm/sales-dashboard/monthly?month={month_start.isoformat()}", headers=admin_headers
    )
    funnel = resp.json()["funnel"]
    assert 0 <= funnel["lead_to_negotiation_pct"] <= 100
    assert 0 <= funnel["negotiation_to_contract_pct"] <= 100
    assert funnel["contracts"] >= 1


def test_monthly_average_sales_cycle_days_is_nonnegative(client, admin_headers):
    today = date.today()
    month_start = this_month_start(today)
    customer = create_customer(client, admin_headers, name="Cycle Kft.")
    make_signed_contract(client, admin_headers, customer["id"], value="1000000")

    resp = client.get(
        f"/api/crm/sales-dashboard/monthly?month={month_start.isoformat()}", headers=admin_headers
    )
    avg_days = resp.json()["average_sales_cycle_days"]
    assert avg_days is None or avg_days >= 0


def test_weekly_scoped_by_owner_for_project_manager(client, admin_headers):
    from tests.conftest import create_user, login

    create_user(client, admin_headers, "sdsales1", "project_manager")
    headers1 = login(client, "sdsales1")
    create_customer(client, headers1, name="Scoped Weekly Kft.")
    create_customer(client, admin_headers, name="Admin Weekly Kft.")

    resp1 = client.get("/api/crm/sales-dashboard/weekly", headers=headers1).json()
    resp_admin = client.get("/api/crm/sales-dashboard/weekly", headers=admin_headers).json()
    total1 = sum(b["count"] for b in resp1["pipeline"])
    total_admin = sum(b["count"] for b in resp_admin["pipeline"])
    assert total1 == 1
    assert total_admin >= 2


def test_contract_patch_backfills_value(client, admin_headers):
    customer = create_customer(client, admin_headers, name="Backfill Kft.")
    contract = client.post(
        "/api/crm/contracts",
        json={
            "customer_id": customer["id"],
            "start_date": "2026-01-01",
            "end_date": "2027-01-01",
        },
        headers=admin_headers,
    ).json()
    assert contract["value"] is None

    resp = client.patch(
        f"/api/crm/contracts/{contract['id']}", json={"value": "42000000"}, headers=admin_headers
    )
    assert resp.status_code == 200
    assert resp.json()["value"] == "42000000.00"


def test_quote_sent_at_set_once_on_first_sent_transition(client, admin_headers):
    customer = create_customer(client, admin_headers, name="SentAt Kft.")
    quote = client.post(
        "/api/crm/quotes", json={"customer_id": customer["id"], "content_json": {}}, headers=admin_headers
    ).json()
    assert quote["sent_at"] is None

    sent1 = client.patch(
        f"/api/crm/quotes/{quote['id']}/status", json={"status": "sent"}, headers=admin_headers
    ).json()
    assert sent1["sent_at"] is not None
    first_sent_at = sent1["sent_at"]

    # Transition away and back to SENT must not move sent_at forward.
    client.patch(
        f"/api/crm/quotes/{quote['id']}/status", json={"status": "rejected"}, headers=admin_headers
    )
    sent2 = client.patch(
        f"/api/crm/quotes/{quote['id']}/status", json={"status": "sent"}, headers=admin_headers
    ).json()
    assert sent2["sent_at"] == first_sent_at
