import io
from datetime import date, timedelta


def create_customer(client, headers, **overrides):
    body = {"type": "company", "name": "Quote Test Kft.", "owner_id": 1}
    body.update(overrides)
    return client.post("/api/crm/customers", json=body, headers=headers).json()


def _quote_file(name="quote.pdf"):
    return {"file": (name, io.BytesIO(b"quote content"), "application/pdf")}


def _contract_file(name="contract.pdf"):
    return {"file": (name, io.BytesIO(b"contract content"), "application/pdf")}


def test_quote_create_and_version(client, admin_headers):
    customer = create_customer(client, admin_headers)
    quote = client.post(
        "/api/crm/quotes",
        data={"customer_id": customer["id"]},
        files=_quote_file("v1.pdf"),
        headers=admin_headers,
    ).json()
    assert quote["quote_number"].startswith("AJ-")
    assert quote["current_version"] == 1

    updated = client.post(
        f"/api/crm/quotes/{quote['id']}/versions",
        files=_quote_file("v2.pdf"),
        headers=admin_headers,
    ).json()
    assert updated["current_version"] == 2
    assert len(updated["versions"]) == 2


def test_quote_create_without_file_rejected(client, admin_headers):
    customer = create_customer(client, admin_headers)
    resp = client.post(
        "/api/crm/quotes",
        data={"customer_id": customer["id"]},
        headers=admin_headers,
    )
    assert resp.status_code == 422


def test_contract_requires_accepted_quote(client, admin_headers):
    customer = create_customer(client, admin_headers)
    quote = client.post(
        "/api/crm/quotes",
        data={"customer_id": customer["id"]},
        files=_quote_file(),
        headers=admin_headers,
    ).json()
    resp = client.post(
        f"/api/crm/quotes/{quote['id']}/create-contract",
        data={"start_date": "2026-08-01", "end_date": "2027-08-01"},
        files=_contract_file(),
        headers=admin_headers,
    )
    assert resp.status_code == 422

    client.patch(f"/api/crm/quotes/{quote['id']}/status", json={"status": "accepted"}, headers=admin_headers)
    resp2 = client.post(
        f"/api/crm/quotes/{quote['id']}/create-contract",
        data={"start_date": "2026-08-01", "end_date": "2027-08-01"},
        files=_contract_file(),
        headers=admin_headers,
    )
    assert resp2.status_code == 200, resp2.text
    contract = resp2.json()
    assert contract["contract_number"].startswith("SZ-")
    assert contract["status"] == "active"


def test_direct_contract_creation_stays_draft_no_project_required(client, admin_headers):
    customer = create_customer(client, admin_headers, name="Direct Contract Kft.")
    resp = client.post(
        "/api/crm/contracts",
        data={"customer_id": customer["id"], "start_date": "2026-08-01", "end_date": "2027-08-01"},
        files=_contract_file(),
        headers=admin_headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "draft"


def test_direct_contract_creation_without_file_rejected(client, admin_headers):
    customer = create_customer(client, admin_headers, name="No File Kft.")
    resp = client.post(
        "/api/crm/contracts",
        data={"customer_id": customer["id"], "start_date": "2026-08-01", "end_date": "2027-08-01"},
        headers=admin_headers,
    )
    assert resp.status_code == 422


def test_direct_contract_status_can_be_set_to_active(client, admin_headers):
    # Project creation now hangs off Customer.status (see test_crm_customers.py),
    # not Contract activation — activating a contract is a plain status change.
    customer = create_customer(client, admin_headers, name="Activate Kft.")
    contract = client.post(
        "/api/crm/contracts",
        data={"customer_id": customer["id"], "start_date": "2026-08-01", "end_date": "2027-08-01"},
        files=_contract_file(),
        headers=admin_headers,
    ).json()
    resp = client.patch(
        f"/api/crm/contracts/{contract['id']}/status", json={"status": "active"}, headers=admin_headers
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "active"


def test_expiring_contract_creates_digest_notification(client, admin_headers):
    customer = create_customer(client, admin_headers, name="Expiring Kft.")
    quote = client.post(
        "/api/crm/quotes",
        data={"customer_id": customer["id"]},
        files=_quote_file(),
        headers=admin_headers,
    ).json()
    client.patch(f"/api/crm/quotes/{quote['id']}/status", json={"status": "accepted"}, headers=admin_headers)
    soon = (date.today() + timedelta(days=10)).isoformat()
    contract = client.post(
        f"/api/crm/quotes/{quote['id']}/create-contract",
        data={"start_date": "2026-01-01", "end_date": soon},
        files=_contract_file(),
        headers=admin_headers,
    ).json()
    assert contract["status"] == "active"

    resp = client.post("/api/notifications/send-digest", headers=admin_headers)
    assert resp.status_code == 200

    notifications = client.get("/api/notifications", headers=admin_headers).json()
    matching = [
        n for n in notifications if n["type"] == "contract_expiring" and contract["contract_number"] in n["title"]
    ]
    assert len(matching) == 1


def test_expiring_contract_not_flagged_when_far_out(client, admin_headers):
    customer = create_customer(client, admin_headers, name="Far Out Kft.")
    quote = client.post(
        "/api/crm/quotes",
        data={"customer_id": customer["id"]},
        files=_quote_file(),
        headers=admin_headers,
    ).json()
    client.patch(f"/api/crm/quotes/{quote['id']}/status", json={"status": "accepted"}, headers=admin_headers)
    far = (date.today() + timedelta(days=365)).isoformat()
    contract = client.post(
        f"/api/crm/quotes/{quote['id']}/create-contract",
        data={"start_date": "2026-01-01", "end_date": far},
        files=_contract_file(),
        headers=admin_headers,
    ).json()

    resp = client.post("/api/notifications/send-digest", headers=admin_headers)
    assert resp.status_code == 200
    notifications = client.get("/api/notifications", headers=admin_headers).json()
    matching = [
        n for n in notifications if n["type"] == "contract_expiring" and contract["contract_number"] in n["title"]
    ]
    assert len(matching) == 0
