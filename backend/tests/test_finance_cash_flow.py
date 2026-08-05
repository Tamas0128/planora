from datetime import date, timedelta

from tests.conftest import create_project
from tests.test_finance_core import create_customer_invoice, create_partner, create_subcontractor_invoice, create_tig

YESTERDAY = (date.today() - timedelta(days=1)).isoformat()
TOMORROW = (date.today() + timedelta(days=30)).isoformat()


def _get_project(client, headers, project_id):
    resp = client.get(f"/api/projects/{project_id}", headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()


def _set_contract(client, headers, project_id, net_value, vat_type="standard_27"):
    resp = client.patch(
        f"/api/finance/projects/{project_id}",
        json={"contract_net_value": net_value, "contract_vat_type": vat_type},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


def test_cash_flow_calculation_exact_values(client, admin_headers):
    project = create_project(client, admin_headers)
    partner = create_partner(client, admin_headers)
    _set_contract(client, admin_headers, project["id"], "10000000")

    create_tig(client, admin_headers, project["id"], partner["id"], net_value="4000000")

    inv1 = create_subcontractor_invoice(
        client, admin_headers, project["id"], partner["id"],
        invoice_number="S/1", net_value="2000000", due_date=TOMORROW,
    ).json()
    client.patch(
        f"/api/finance/projects/{project['id']}/subcontractor-invoices/{inv1['id']}/status",
        json={"status": "paid"}, headers=admin_headers,
    )
    create_subcontractor_invoice(
        client, admin_headers, project["id"], partner["id"],
        invoice_number="S/2", net_value="1000000", due_date=TOMORROW,
    )

    ci1 = create_customer_invoice(
        client, admin_headers, project["id"], net_value="5000000", due_date=TOMORROW
    ).json()
    client.patch(
        f"/api/finance/projects/{project['id']}/customer-invoices/{ci1['id']}/status",
        json={"status": "paid"}, headers=admin_headers,
    )
    create_customer_invoice(client, admin_headers, project["id"], net_value="3000000", due_date=TOMORROW)

    resp = client.get(f"/api/finance/projects/{project['id']}/cash-flow", headers=admin_headers)
    assert resp.status_code == 200
    body = resp.json()

    assert body["contract_net"] == "10000000.00"
    assert body["contract_gross"] == "12700000.00"
    assert body["invoiced_net"] == "8000000.00"
    assert body["invoiced_gross"] == "10160000.00"
    assert body["received_gross"] == "6350000.00"
    assert body["outstanding_receivable"] == "3810000.00"
    assert body["tig_total_net"] == "4000000.00"
    assert body["subcontractor_invoiced_gross"] == "3810000.00"
    assert body["subcontractor_paid_gross"] == "2540000.00"
    assert body["payable_obligations"] == "1270000.00"
    assert body["expected_margin"] == "6000000.00"
    assert body["actual_margin"] == "3810000.00"
    assert body["cash_flow_balance"] == "3810000.00"
    assert body["has_overdue_customer_invoice"] is False
    assert body["has_overdue_subcontractor_invoice"] is False

    project_detail = _get_project(client, admin_headers, project["id"])
    assert project_detail["finance_status"] == "green"


def test_finance_status_red_overdue_customer_invoice(client, admin_headers):
    project = create_project(client, admin_headers)
    create_customer_invoice(client, admin_headers, project["id"], due_date=YESTERDAY)
    project_detail = _get_project(client, admin_headers, project["id"])
    assert project_detail["finance_status"] == "red"


def test_finance_status_red_overdue_subcontractor_invoice(client, admin_headers):
    project = create_project(client, admin_headers)
    partner = create_partner(client, admin_headers)
    create_subcontractor_invoice(client, admin_headers, project["id"], partner["id"], due_date=YESTERDAY)
    project_detail = _get_project(client, admin_headers, project["id"])
    assert project_detail["finance_status"] == "red"


def test_finance_status_red_negative_cash_flow(client, admin_headers):
    project = create_project(client, admin_headers)
    partner = create_partner(client, admin_headers)
    inv = create_subcontractor_invoice(
        client, admin_headers, project["id"], partner["id"], net_value="1000000", due_date=TOMORROW,
    ).json()
    client.patch(
        f"/api/finance/projects/{project['id']}/subcontractor-invoices/{inv['id']}/status",
        json={"status": "paid"}, headers=admin_headers,
    )
    # no customer invoices at all -> received_gross (0) - subcontractor_paid_gross (>0) < 0
    project_detail = _get_project(client, admin_headers, project["id"])
    assert project_detail["finance_status"] == "red"


def test_finance_status_red_overspend_vs_contract(client, admin_headers):
    project = create_project(client, admin_headers)
    partner = create_partner(client, admin_headers)
    _set_contract(client, admin_headers, project["id"], "1000000")
    create_subcontractor_invoice(
        client, admin_headers, project["id"], partner["id"], net_value="5000000", due_date=TOMORROW,
    )
    project_detail = _get_project(client, admin_headers, project["id"])
    assert project_detail["finance_status"] == "red"


def test_finance_status_yellow_low_coverage(client, admin_headers):
    project = create_project(client, admin_headers)
    # invoiced but nothing received yet -> received_gross (0) < invoiced_gross * 0.5,
    # and no subcontractor invoices at all so cash_flow_balance stays 0 (not negative)
    create_customer_invoice(client, admin_headers, project["id"], net_value="2000000", due_date=TOMORROW)
    project_detail = _get_project(client, admin_headers, project["id"])
    assert project_detail["finance_status"] == "yellow"


def test_finance_status_green_clean_project(client, admin_headers):
    project = create_project(client, admin_headers)
    project_detail = _get_project(client, admin_headers, project["id"])
    assert project_detail["finance_status"] == "green"


def test_kanban_finance_status_matches_project_detail(client, admin_headers):
    project = create_project(client, admin_headers)
    create_customer_invoice(client, admin_headers, project["id"], due_date=YESTERDAY)
    project_detail = _get_project(client, admin_headers, project["id"])

    resp = client.get("/api/projects/kanban", headers=admin_headers)
    assert resp.status_code == 200
    board = resp.json()
    card = next(c for col in board.values() for c in col if c["id"] == project["id"])
    assert card["finance_status"] == project_detail["finance_status"] == "red"
