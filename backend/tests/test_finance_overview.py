from datetime import date, timedelta

from tests.conftest import create_project, create_user, login
from tests.test_finance_core import (
    create_customer_invoice,
    create_partner,
    create_subcontractor_invoice,
    create_tig,
    ensure_active_subcontractor_contract,
)

YESTERDAY = (date.today() - timedelta(days=1)).isoformat()
TOMORROW = (date.today() + timedelta(days=30)).isoformat()


def test_overview_row_shape_and_values(client, admin_headers):
    project = create_project(client, admin_headers)
    client.patch(
        f"/api/finance/projects/{project['id']}",
        json={"contract_net_value": "1000000", "contract_vat_type": "standard_27"},
        headers=admin_headers,
    )
    create_customer_invoice(client, admin_headers, project["id"], net_value="500000", due_date=YESTERDAY)

    resp = client.get("/api/finance/overview", headers=admin_headers)
    assert resp.status_code == 200
    row = next(r for r in resp.json() if r["project_id"] == project["id"])
    assert row["contract_gross"] == "1270000.00"
    assert row["invoiced_gross"] == "635000.00"
    assert row["overdue_receivable"] == "635000.00"
    assert row["finance_status"] == "red"


def test_overview_project_filter(client, admin_headers):
    project = create_project(client, admin_headers)
    resp = client.get(f"/api/finance/overview?project_id={project['id']}", headers=admin_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["project_id"] == project["id"]


def test_overview_date_range_filters_period(client, admin_headers):
    project = create_project(client, admin_headers)
    create_customer_invoice(client, admin_headers, project["id"], net_value="500000", due_date=TOMORROW)

    resp = client.get(
        f"/api/finance/overview?project_id={project['id']}&date_from=2000-01-01&date_to=2000-01-02",
        headers=admin_headers,
    )
    row = resp.json()[0]
    assert row["invoiced_gross"] == "0"


def test_overview_forbidden_for_non_overview_role(client, admin_headers):
    create_user(client, admin_headers, "site_mgr", "site_manager")
    headers = login(client, "site_mgr")
    resp = client.get("/api/finance/overview", headers=headers)
    assert resp.status_code == 403


def test_all_tigs_and_invoices_scoped_to_own_projects_for_pm(client, admin_headers):
    pm = create_user(client, admin_headers, "pm_overview", "project_manager")
    own_project = create_project(client, admin_headers, project_manager_id=pm["id"])
    other_project = create_project(client, admin_headers)
    partner = create_partner(client, admin_headers)
    ensure_active_subcontractor_contract(client, admin_headers, own_project["id"], partner["id"])
    ensure_active_subcontractor_contract(client, admin_headers, other_project["id"], partner["id"])
    create_tig(client, admin_headers, own_project["id"], partner["id"])
    create_tig(client, admin_headers, other_project["id"], partner["id"])

    pm_headers = login(client, "pm_overview")
    resp = client.get("/api/finance/all/tigs", headers=pm_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["project_id"] == own_project["id"]
    assert body[0]["project_name"] == own_project["name"]


def test_all_subcontractor_invoices_overdue_only_filter(client, admin_headers):
    project = create_project(client, admin_headers)
    partner = create_partner(client, admin_headers)
    create_subcontractor_invoice(
        client, admin_headers, project["id"], partner["id"], invoice_number="OD/1", due_date=YESTERDAY
    )
    create_subcontractor_invoice(
        client, admin_headers, project["id"], partner["id"], invoice_number="OD/2", due_date=TOMORROW
    )

    resp = client.get("/api/finance/all/subcontractor-invoices?overdue_only=true", headers=admin_headers)
    body = [r for r in resp.json() if r["project_id"] == project["id"]]
    assert len(body) == 1
    assert body[0]["invoice_number"] == "OD/1"
    assert body[0]["project_code"] == project["project_code"]


def test_all_customer_invoices_includes_customer_name(client, admin_headers):
    project = create_project(client, admin_headers)
    customer = client.post(
        "/api/crm/customers", json={"type": "company", "name": "Overview Ügyfél Kft.", "owner_id": 1},
        headers=admin_headers,
    ).json()
    client.patch(f"/api/projects/{project['id']}", json={"customer_id": customer["id"]}, headers=admin_headers)
    create_customer_invoice(client, admin_headers, project["id"])

    resp = client.get(f"/api/finance/all/customer-invoices?project_id={project['id']}", headers=admin_headers)
    body = resp.json()
    assert body[0]["customer_name"] == "Overview Ügyfél Kft."
