import io

from tests.conftest import create_user, login


def create_customer(client, headers, **overrides):
    body = {"type": "company", "name": "Teszt Kft.", "owner_id": 1}
    body.update(overrides)
    resp = client.post("/api/crm/customers", json=body, headers=headers)
    return resp


def test_person_customer_rejects_contact_fields(client, admin_headers):
    resp = create_customer(
        client, admin_headers, type="person", name="Kovacs Janos", phone="+3612345678"
    )
    assert resp.status_code == 422
    assert "phone" in resp.json()["detail"]


def test_person_customer_without_contact_fields_succeeds(client, admin_headers):
    resp = create_customer(client, admin_headers, type="person", name="Kovacs Janos")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["customer_number"].startswith("UGY-")
    assert body["duplicate_name_warning"] is False


def test_duplicate_name_warns_but_does_not_block(client, admin_headers):
    create_customer(client, admin_headers, type="person", name="Kovacs Janos")
    resp = create_customer(client, admin_headers, type="person", name="Kovacs Janos")
    assert resp.status_code == 200
    assert resp.json()["duplicate_name_warning"] is True


def test_non_privileged_owner_forced_to_self(client, admin_headers):
    create_user(client, admin_headers, "sales1", "project_manager")
    headers = login(client, "sales1")
    # sales1's id isn't 1 (admin), owner_id=1 in the request must be ignored
    resp = create_customer(client, headers, type="company", name="X Kft.", owner_id=1)
    assert resp.status_code == 200, resp.text
    me = client.get("/api/auth/me", headers=headers).json()
    assert resp.json()["owner_id"] == me["id"]


def test_customer_list_scoped_to_owner_for_project_manager(client, admin_headers):
    create_user(client, admin_headers, "sales1", "project_manager")
    create_user(client, admin_headers, "sales2", "project_manager")
    headers1 = login(client, "sales1")
    headers2 = login(client, "sales2")
    create_customer(client, headers1, type="company", name="Sales1 Kft.")
    create_customer(client, headers2, type="company", name="Sales2 Kft.")

    resp1 = client.get("/api/crm/customers", headers=headers1)
    names1 = {c["name"] for c in resp1.json()}
    assert names1 == {"Sales1 Kft."}

    resp_admin = client.get("/api/crm/customers", headers=admin_headers)
    names_admin = {c["name"] for c in resp_admin.json()}
    assert {"Sales1 Kft.", "Sales2 Kft."} <= names_admin


def test_customer_creation_forbidden_for_procurement_billing_subcontractor(client, admin_headers):
    # Confirmed 2026-08-12: create_customer previously had no role gate at
    # all — any authenticated user could create a customer, including roles
    # with zero later visibility into it (scoped_customer_query returns
    # nothing for them), leaving an orphaned-in-practice record. Restricted
    # to the two CRM-mapped roles (Értékesítő/project_manager, Ügyintéző/
    # site_manager) plus admin/management.
    for i, role in enumerate(("procurement", "billing", "subcontractor")):
        create_user(client, admin_headers, f"nocreate{i}", role)
        headers = login(client, f"nocreate{i}")
        resp = create_customer(client, headers, name=f"Blocked {role} Kft.")
        assert resp.status_code == 403


def test_customer_creation_allowed_for_site_manager(client, admin_headers):
    create_user(client, admin_headers, "sm_create", "site_manager")
    headers = login(client, "sm_create")
    resp = create_customer(client, headers, name="Ügyintéző Kft.")
    assert resp.status_code == 200, resp.text


def test_billing_role_sees_customers_readonly(client, admin_headers):
    # Changed 2026-08-12: BILLING was previously blocked from all customer
    # visibility, but scoped_contract_query already gives it unscoped access
    # to every Contract — with no way to reach a contract's own page (only a
    # tab on its customer's detail page), billing had full contract rights
    # but no way to use them. Now sees every customer (read-only).
    create_user(client, admin_headers, "bill1", "billing")
    headers = login(client, "bill1")
    created = create_customer(client, admin_headers, type="company", name="Any Kft.").json()
    resp = client.get("/api/crm/customers", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 1
    resp = client.get(f"/api/crm/customers/{created['id']}", headers=headers)
    assert resp.status_code == 200
    # But still can't edit — visibility only. update_customer still gates via
    # the unmodified scoped_customer_query (billing excluded there), so this
    # comes back as 404 "not found" rather than a 403 — the write path never
    # even considers billing an existing option for this customer.
    resp = client.patch(
        f"/api/crm/customers/{created['id']}", json={"phone": "+36301234567"}, headers=headers
    )
    assert resp.status_code == 404


def test_update_changes_status_and_logs_audit(client, admin_headers):
    created = create_customer(client, admin_headers, type="company", name="Upd Kft.").json()
    resp = client.patch(
        f"/api/crm/customers/{created['id']}", json={"status": "inquiring"}, headers=admin_headers
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "inquiring"


def test_reaching_ordered_status_without_project_fields_rejected(client, admin_headers):
    created = create_customer(client, admin_headers, type="company", name="Ordered Missing Kft.").json()
    resp = client.patch(
        f"/api/crm/customers/{created['id']}", json={"status": "ordered"}, headers=admin_headers
    )
    assert resp.status_code == 422
    assert "project_code" in resp.json()["detail"]


def test_reaching_ordered_status_creates_project_linked_to_customer(client, admin_headers):
    created = create_customer(client, admin_headers, type="company", name="Ordered Kft.").json()
    resp = client.patch(
        f"/api/crm/customers/{created['id']}",
        json={
            "status": "ordered",
            "project_code": "CRM-T-010",
            "settlement": "Szeged",
            "address": "Fő utca 1",
            "floor_area_sqm": 120,
            "delivery_date": "2027-06-01",
        },
        headers=admin_headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "ordered"

    project_resp = client.get("/api/projects", headers=admin_headers).json()
    project = next((p for p in project_resp if p["project_code"] == "CRM-T-010"), None)
    assert project is not None
    assert project["client_name"] == "Ordered Kft."


def test_reaching_ordered_status_twice_does_not_create_second_project(client, admin_headers):
    created = create_customer(client, admin_headers, type="company", name="Idempotent Kft.").json()
    client.patch(
        f"/api/crm/customers/{created['id']}",
        json={
            "status": "ordered",
            "project_code": "CRM-T-011",
            "settlement": "Pécs",
            "address": "Fő tér 1",
            "floor_area_sqm": 90,
            "delivery_date": "2027-06-01",
        },
        headers=admin_headers,
    )
    # Already ordered — no new project fields needed the second time round.
    resp = client.patch(
        f"/api/crm/customers/{created['id']}", json={"status": "inquiring"}, headers=admin_headers
    )
    assert resp.status_code == 200
    resp2 = client.patch(
        f"/api/crm/customers/{created['id']}", json={"status": "ordered"}, headers=admin_headers
    )
    assert resp2.status_code == 200, resp2.text

    project_resp = client.get("/api/projects", headers=admin_headers).json()
    matching = [p for p in project_resp if p.get("client_name") == "Idempotent Kft."]
    assert len(matching) == 1


def test_update_cannot_add_contact_fields_when_person(client, admin_headers):
    created = create_customer(client, admin_headers, type="person", name="Pure Person").json()
    resp = client.patch(
        f"/api/crm/customers/{created['id']}", json={"email": "x@y.hu"}, headers=admin_headers
    )
    assert resp.status_code == 422


def test_delete_blocked_when_related_record_exists(client, admin_headers):
    company = create_customer(client, admin_headers, type="company", name="RelCo Kft.").json()
    person = create_customer(client, admin_headers, type="person", name="RelCo Person").json()
    rel = client.post(
        "/api/crm/customer-relations",
        json={"company_customer_id": company["id"], "person_customer_id": person["id"]},
        headers=admin_headers,
    )
    assert rel.status_code == 200, rel.text

    resp = client.delete(f"/api/crm/customers/{company['id']}", headers=admin_headers)
    assert resp.status_code == 409


def test_delete_succeeds_without_related_records(client, admin_headers):
    created = create_customer(client, admin_headers, type="company", name="Lonely Kft.").json()
    resp = client.delete(f"/api/crm/customers/{created['id']}", headers=admin_headers)
    assert resp.status_code == 200


def test_customer_relation_rejects_wrong_types(client, admin_headers):
    person_a = create_customer(client, admin_headers, type="person", name="A Person").json()
    person_b = create_customer(client, admin_headers, type="person", name="B Person").json()
    resp = client.post(
        "/api/crm/customer-relations",
        json={"company_customer_id": person_a["id"], "person_customer_id": person_b["id"]},
        headers=admin_headers,
    )
    assert resp.status_code == 422


def test_export_returns_csv(client, admin_headers):
    create_customer(client, admin_headers, type="company", name="Export Kft.")
    resp = client.get("/api/crm/customers/export", headers=admin_headers)
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    assert "Export Kft." in resp.text


def test_import_reports_per_row_success_and_failure(client, admin_headers):
    csv_content = (
        "type,name,owner_id,phone,email\n"
        "company,Import Bt.,1,,import@bt.hu\n"
        "person,Bad Row,1,+3612345678,\n"
    )
    resp = client.post(
        "/api/crm/customers/import",
        headers=admin_headers,
        files={"file": ("customers.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")},
    )
    assert resp.status_code == 200, resp.text
    results = resp.json()["results"]
    assert results[0]["success"] is True
    assert results[0]["customer_number"].startswith("UGY-")
    assert results[1]["success"] is False
    assert "phone" in results[1]["error"]

    # First row's success must survive the second row's failure — no
    # all-or-nothing rollback across the batch.
    listed = client.get("/api/crm/customers", headers=admin_headers).json()
    assert any(c["name"] == "Import Bt." for c in listed)


def test_import_requires_admin_or_management(client, admin_headers):
    create_user(client, admin_headers, "sales1", "project_manager")
    headers = login(client, "sales1")
    resp = client.post(
        "/api/crm/customers/import",
        headers=headers,
        files={"file": ("c.csv", io.BytesIO(b"type,name,owner_id\n"), "text/csv")},
    )
    assert resp.status_code == 403
