from tests.conftest import create_project, create_user, login


def create_partner(client, headers, **overrides):
    body = {"name": "Teszt Alvállalkozó Kft."}
    body.update(overrides)
    resp = client.post("/api/finance/partners", json=body, headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()


def create_tig(client, headers, project_id, partner_id, **overrides):
    body = {
        "partner_id": partner_id,
        "date": "2026-08-01",
        "period_start": "2026-07-01",
        "period_end": "2026-07-31",
        "net_value": "1000000",
        "vat_type": "standard_27",
    }
    body.update(overrides)
    return client.post(f"/api/finance/projects/{project_id}/tigs", json=body, headers=headers)


def create_subcontractor_invoice(client, headers, project_id, partner_id, **overrides):
    body = {
        "partner_id": partner_id,
        "invoice_number": "1/2026",
        "performance_date": "2026-07-31",
        "issue_date": "2026-08-01",
        "due_date": "2026-08-15",
        "net_value": "500000",
        "vat_type": "standard_27",
    }
    body.update(overrides)
    return client.post(
        f"/api/finance/projects/{project_id}/subcontractor-invoices", json=body, headers=headers
    )


def create_customer_invoice(client, headers, project_id, **overrides):
    body = {
        "issue_date": "2026-08-01",
        "performance_date": "2026-07-31",
        "due_date": "2026-08-15",
        "net_value": "2000000",
        "vat_type": "standard_27",
    }
    body.update(overrides)
    return client.post(f"/api/finance/projects/{project_id}/customer-invoices", json=body, headers=headers)


def test_partner_crud_and_role_gating(client, admin_headers):
    partner = create_partner(client, admin_headers, name="Beton Kft.", tax_number="12345678-1-42")
    assert partner["name"] == "Beton Kft."

    create_user(client, admin_headers, "pm_core", "project_manager")
    pm_headers = login(client, "pm_core")
    resp = client.post("/api/finance/partners", json={"name": "Not allowed"}, headers=pm_headers)
    assert resp.status_code == 403

    resp = client.get("/api/finance/partners", headers=pm_headers)
    assert resp.status_code == 200
    assert any(p["id"] == partner["id"] for p in resp.json())

    resp = client.patch(
        f"/api/finance/partners/{partner['id']}", json={"phone": "+36301112222"}, headers=admin_headers
    )
    assert resp.status_code == 200
    assert resp.json()["phone"] == "+36301112222"


def test_project_finance_fields_vat_calc(client, admin_headers):
    project = create_project(client, admin_headers)

    resp = client.patch(
        f"/api/finance/projects/{project['id']}",
        json={"contract_net_value": "1000000", "contract_vat_type": "standard_27"},
        headers=admin_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["contract_gross_value"] == "1270000.00"

    resp = client.patch(
        f"/api/finance/projects/{project['id']}",
        json={"contract_vat_type": "reduced_5"},
        headers=admin_headers,
    )
    assert resp.json()["contract_gross_value"] == "1050000.00"

    resp = client.patch(
        f"/api/finance/projects/{project['id']}",
        json={"contract_vat_type": "reverse_charge"},
        headers=admin_headers,
    )
    assert resp.json()["contract_gross_value"] == "1000000.00"


def test_tig_consumed_amount_and_invoice_count(client, admin_headers):
    project = create_project(client, admin_headers)
    partner = create_partner(client, admin_headers)

    tig = create_tig(client, admin_headers, project["id"], partner["id"], net_value="1000000").json()
    assert tig["gross_value"] == "1270000.00"
    assert tig["consumed_amount"] == "0"
    assert tig["invoice_count"] == 0

    inv1 = create_subcontractor_invoice(
        client, admin_headers, project["id"], partner["id"],
        tig_id=tig["id"], invoice_number="A/1", net_value="300000",
    ).json()
    assert inv1["gross_value"] == "381000.00"

    create_subcontractor_invoice(
        client, admin_headers, project["id"], partner["id"],
        tig_id=tig["id"], invoice_number="A/2", net_value="200000",
    )
    # unrelated invoice with no TIG linked — should not affect consumed_amount
    no_tig_invoice = create_subcontractor_invoice(
        client, admin_headers, project["id"], partner["id"],
        tig_id=None, invoice_number="A/3", net_value="100000",
    ).json()
    assert no_tig_invoice["tig_id"] is None

    resp = client.get(f"/api/finance/projects/{project['id']}/tigs", headers=admin_headers)
    tig_after = next(t for t in resp.json() if t["id"] == tig["id"])
    assert tig_after["consumed_amount"] == "500000.00"
    assert tig_after["invoice_count"] == 2


def test_subcontractor_invoice_numbering_per_partner(client, admin_headers):
    project = create_project(client, admin_headers)
    partner_a = create_partner(client, admin_headers, name="A Kft.")
    partner_b = create_partner(client, admin_headers, name="B Kft.")

    resp_a = create_subcontractor_invoice(
        client, admin_headers, project["id"], partner_a["id"], invoice_number="1/2026"
    )
    assert resp_a.status_code == 200

    # a different partner can reuse the same invoice_number
    resp_b = create_subcontractor_invoice(
        client, admin_headers, project["id"], partner_b["id"], invoice_number="1/2026"
    )
    assert resp_b.status_code == 200

    # the same partner cannot reuse it
    resp_dup = create_subcontractor_invoice(
        client, admin_headers, project["id"], partner_a["id"], invoice_number="1/2026"
    )
    assert resp_dup.status_code == 400


def test_customer_invoice_auto_numbering_and_customer_name(client, admin_headers):
    project = create_project(client, admin_headers)

    inv1 = create_customer_invoice(client, admin_headers, project["id"]).json()
    inv2 = create_customer_invoice(client, admin_headers, project["id"]).json()
    assert inv1["invoice_number"] != inv2["invoice_number"]
    assert inv1["invoice_number"].startswith("OSZ-")
    assert inv1["customer_name"] is None

    customer = client.post(
        "/api/crm/customers", json={"type": "company", "name": "Számla Ügyfél Kft.", "owner_id": 1},
        headers=admin_headers,
    ).json()
    resp = client.patch(
        f"/api/projects/{project['id']}", json={"customer_id": customer["id"]}, headers=admin_headers
    )
    assert resp.status_code == 200

    resp = client.get(f"/api/finance/projects/{project['id']}/customer-invoices", headers=admin_headers)
    assert resp.json()[0]["customer_name"] == "Számla Ügyfél Kft."


def test_customer_id_link_restricted_to_finance_roles(client, admin_headers):
    pm = create_user(client, admin_headers, "pm_link", "project_manager")
    project = create_project(client, admin_headers, project_manager_id=pm["id"])
    pm_headers = login(client, "pm_link")
    # PM can edit their own project in general, but linking the CRM customer
    # is finance-adjacent and restricted to ADMIN/MANAGEMENT/BILLING.
    resp = client.patch(
        f"/api/projects/{project['id']}", json={"customer_id": 1}, headers=pm_headers
    )
    assert resp.status_code == 403
    resp = client.patch(
        f"/api/projects/{project['id']}", json={"name": "Renamed"}, headers=pm_headers
    )
    assert resp.status_code == 200


def test_project_manager_can_edit_own_tig_but_not_invoices(client, admin_headers):
    pm = create_user(client, admin_headers, "pm_tig", "project_manager")
    pm_headers = login(client, "pm_tig")
    project = create_project(client, admin_headers, project_manager_id=pm["id"])
    other_project = create_project(client, admin_headers)
    partner = create_partner(client, admin_headers)

    # PM cannot view/act on a project they don't manage
    resp = create_tig(client, pm_headers, other_project["id"], partner["id"])
    assert resp.status_code == 403

    # PM can create/edit a TIG on their own project
    tig = create_tig(client, pm_headers, project["id"], partner["id"]).json()
    resp = client.patch(
        f"/api/finance/projects/{project['id']}/tigs/{tig['id']}",
        json={"note": "Rendben halad"},
        headers=pm_headers,
    )
    assert resp.status_code == 200
    resp = client.patch(
        f"/api/finance/projects/{project['id']}/tigs/{tig['id']}/status",
        json={"status": "approved"},
        headers=pm_headers,
    )
    assert resp.status_code == 200

    # ...but not a subcontractor invoice
    resp = create_subcontractor_invoice(client, pm_headers, project["id"], partner["id"])
    assert resp.status_code == 403
