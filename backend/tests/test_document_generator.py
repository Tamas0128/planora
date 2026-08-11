import io
from datetime import date, timedelta

import pytest
from docx import Document

from tests.conftest import TestingSessionLocal, create_project, create_user, login


def _docx_bytes(lines: list[str]) -> bytes:
    doc = Document()
    for line in lines:
        doc.add_paragraph(line)
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


TIG_TEMPLATE_LINES = [
    "{{ PROJEKT_NEV }} ({{ PROJEKT_ID }})",
    "{{ UGYFEL_NEV }}",
    "{{ TIG_PARTNER_NEV }} {{ TIG_OSSZEG_NETTO }}",
    "{{ CSUSZAS_INDOKLAS }}",
]

CLIENT_CONTRACT_TEMPLATE_LINES = ["{{ SZERZODES_SZAM }}", "{{ UGYFEL_NEV }}"]

SUBCONTRACTOR_CONTRACT_TEMPLATE_LINES = ["{{ SZERZODES_SZAM }}", "{{ PARTNER_NEV }}"]


@pytest.fixture
def fake_pdf_conversion(monkeypatch):
    monkeypatch.setattr(
        "app.api.document_generator.convert_to_pdf", lambda docx_bytes, timeout=60: b"%PDF-1.4 fake"
    )
    # The PDF-conversion background task does its own `SessionLocal()`
    # lookup (deferred import, like services/geocoding.py) — without this,
    # it would resolve app.database's real (non-StaticPool) sqlite engine,
    # a separate empty in-memory DB from the one `client` talks to.
    monkeypatch.setattr("app.database.SessionLocal", TestingSessionLocal)


def upload_template(
    client,
    headers,
    *,
    family,
    lines,
    doc_subtype="normal",
    building_type=None,
    is_delay_variant=False,
    name="Placeholder",
):
    data = {
        "family": family,
        "doc_subtype": doc_subtype,
        "is_delay_variant": "true" if is_delay_variant else "false",
        "name": name,
    }
    if building_type:
        data["building_type"] = building_type
    files = {
        "file": (
            "template.docx",
            io.BytesIO(_docx_bytes(lines)),
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
    }
    return client.post("/api/document-templates", data=data, files=files, headers=headers)


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
    resp = client.post(f"/api/finance/projects/{project_id}/tigs", json=body, headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()


def create_subcontractor_contract(client, headers, project_id, partner_id, **overrides):
    body = {
        "partner_id": partner_id,
        "scope_of_work": "Villanyszerelés",
        "value": "500000",
        "vat_type": "standard_27",
        "start_date": "2026-07-01",
        "end_date": "2026-12-01",
    }
    body.update(overrides)
    resp = client.post(
        f"/api/finance/projects/{project_id}/subcontractor-contracts", json=body, headers=headers
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


def create_customer(client, headers, **overrides):
    body = {"type": "company", "name": "Teszt Ügyfél Kft.", "owner_id": 1}
    body.update(overrides)
    resp = client.post("/api/crm/customers", json=body, headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()


def create_contract(client, headers, customer_id, **overrides):
    body = {"customer_id": customer_id, "start_date": "2026-07-01", "end_date": "2027-07-01", "value": "10000000"}
    body.update(overrides)
    resp = client.post(
        "/api/crm/contracts",
        data={k: str(v) for k, v in body.items()},
        files={"file": ("contract.pdf", io.BytesIO(b"contract content"), "application/pdf")},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


# --- Admin template management -------------------------------------------


def test_non_admin_cannot_manage_templates(client, admin_headers):
    create_user(client, admin_headers, "pm_docs", "project_manager")
    pm_headers = login(client, "pm_docs")
    resp = upload_template(client, pm_headers, family="tig", lines=TIG_TEMPLATE_LINES)
    assert resp.status_code == 403


def test_admin_can_upload_and_list_templates(client, admin_headers):
    resp = upload_template(client, admin_headers, family="tig", lines=TIG_TEMPLATE_LINES, name="TIG sablon")
    assert resp.status_code == 200, resp.text
    template = resp.json()
    assert template["family"] == "tig"
    assert template["is_active"] is True
    assert template["version"] == 1

    listing = client.get("/api/document-templates", headers=admin_headers).json()
    assert any(t["id"] == template["id"] for t in listing)


def test_reuploading_same_combination_bumps_version(client, admin_headers):
    first = upload_template(client, admin_headers, family="tig", lines=TIG_TEMPLATE_LINES).json()
    second = upload_template(client, admin_headers, family="tig", lines=TIG_TEMPLATE_LINES).json()
    assert first["version"] == 1
    assert second["version"] == 2


# --- Template selection priority ------------------------------------------


def test_generate_without_active_template_returns_422(client, admin_headers, fake_pdf_conversion):
    project = create_project(client, admin_headers)
    partner = create_partner(client, admin_headers)
    tig = create_tig(client, admin_headers, project["id"], partner["id"])

    resp = client.post(
        "/api/generated-documents",
        json={"family": "tig", "source_id": tig["id"]},
        headers=admin_headers,
    )
    assert resp.status_code == 422
    assert "sablon" in resp.json()["detail"].lower()


def test_building_type_specific_template_preferred_over_catch_all(client, admin_headers, fake_pdf_conversion):
    catch_all = upload_template(
        client, admin_headers, family="tig", lines=TIG_TEMPLATE_LINES, name="Catch-all"
    ).json()
    specific = upload_template(
        client,
        admin_headers,
        family="tig",
        lines=TIG_TEMPLATE_LINES,
        building_type="light_steel",
        name="Light steel specific",
    ).json()

    project = create_project(client, admin_headers, building_type="light_steel")
    partner = create_partner(client, admin_headers)
    tig = create_tig(client, admin_headers, project["id"], partner["id"])

    resp = client.post(
        "/api/generated-documents", json={"family": "tig", "source_id": tig["id"]}, headers=admin_headers
    )
    assert resp.status_code == 200, resp.text
    doc = resp.json()
    assert doc["template_id"] == specific["id"]
    assert doc["template_id"] != catch_all["id"]


def test_delay_variant_preferred_when_project_is_late(client, admin_headers, fake_pdf_conversion):
    normal = upload_template(
        client, admin_headers, family="tig", lines=TIG_TEMPLATE_LINES, name="Normal"
    ).json()
    delayed = upload_template(
        client,
        admin_headers,
        family="tig",
        lines=TIG_TEMPLATE_LINES,
        is_delay_variant=True,
        name="Delayed",
    ).json()

    past_delivery = (date.today() - timedelta(days=5)).isoformat()
    project = create_project(client, admin_headers, delivery_date=past_delivery)
    partner = create_partner(client, admin_headers)
    tig = create_tig(client, admin_headers, project["id"], partner["id"])

    resp = client.post(
        "/api/generated-documents",
        json={"family": "tig", "source_id": tig["id"], "delay_reason": "Alvállalkozó csúszik"},
        headers=admin_headers,
    )
    assert resp.status_code == 200, resp.text
    doc = resp.json()
    assert doc["template_id"] == delayed["id"]
    assert doc["template_id"] != normal["id"]
    assert doc["delay_reason"] == "Alvállalkozó csúszik"


# --- End-to-end per family + download ------------------------------------


def test_generate_tig_document_end_to_end(client, admin_headers, fake_pdf_conversion):
    upload_template(client, admin_headers, family="tig", lines=TIG_TEMPLATE_LINES)
    project = create_project(client, admin_headers)
    partner = create_partner(client, admin_headers)
    tig = create_tig(client, admin_headers, project["id"], partner["id"])

    resp = client.post(
        "/api/generated-documents", json={"family": "tig", "source_id": tig["id"]}, headers=admin_headers
    )
    assert resp.status_code == 200, resp.text
    doc = resp.json()
    # response body is serialized before BackgroundTasks runs (Starlette
    # sends the body, then runs the background task) — status here is
    # still "pending"; re-fetch to see the post-conversion state.
    assert doc["status"] == "pending"

    listing = client.get(f"/api/projects/{project['id']}/generated-documents", headers=admin_headers).json()
    updated = next(d for d in listing if d["id"] == doc["id"])
    assert updated["status"] == "ready"
    assert updated["has_pdf"] is True

    download_docx = client.get(
        f"/api/generated-documents/{doc['id']}/download?format=docx", headers=admin_headers
    )
    assert download_docx.status_code == 200
    download_pdf = client.get(
        f"/api/generated-documents/{doc['id']}/download?format=pdf", headers=admin_headers
    )
    assert download_pdf.status_code == 200


def test_generate_subcontractor_contract_document(client, admin_headers, fake_pdf_conversion):
    upload_template(client, admin_headers, family="subcontractor_contract", lines=SUBCONTRACTOR_CONTRACT_TEMPLATE_LINES)
    project = create_project(client, admin_headers)
    partner = create_partner(client, admin_headers)
    sc_contract = create_subcontractor_contract(client, admin_headers, project["id"], partner["id"])

    resp = client.post(
        "/api/generated-documents",
        json={"family": "subcontractor_contract", "source_id": sc_contract["id"]},
        headers=admin_headers,
    )
    assert resp.status_code == 200, resp.text
    doc_id = resp.json()["id"]

    listing = client.get(f"/api/projects/{project['id']}/generated-documents", headers=admin_headers).json()
    updated = next(d for d in listing if d["id"] == doc_id)
    assert updated["status"] == "ready"


def test_generate_client_contract_document_with_and_without_project(client, admin_headers, fake_pdf_conversion):
    upload_template(client, admin_headers, family="client_contract", lines=CLIENT_CONTRACT_TEMPLATE_LINES)
    customer = create_customer(client, admin_headers)
    contract = create_contract(client, admin_headers, customer["id"])

    # No project linked to the customer yet — should still generate.
    resp = client.post(
        "/api/generated-documents",
        json={"family": "client_contract", "source_id": contract["id"]},
        headers=admin_headers,
    )
    assert resp.status_code == 200, resp.text
    doc = resp.json()
    assert doc["project_id"] is None

    listing = client.get(
        f"/api/crm/customers/{customer['id']}/generated-documents", headers=admin_headers
    ).json()
    assert any(d["id"] == doc["id"] for d in listing)

    # Link a project to the customer, generate again — project_id should now populate.
    project = create_project(client, admin_headers)
    link = client.patch(
        f"/api/projects/{project['id']}", json={"customer_id": customer["id"]}, headers=admin_headers
    )
    assert link.status_code == 200, link.text
    resp2 = client.post(
        "/api/generated-documents",
        json={"family": "client_contract", "source_id": contract["id"]},
        headers=admin_headers,
    )
    assert resp2.status_code == 200, resp2.text
    assert resp2.json()["project_id"] == project["id"]


# --- RBAC ------------------------------------------------------------------


def test_pm_can_generate_only_for_own_project(client, admin_headers, fake_pdf_conversion):
    upload_template(client, admin_headers, family="tig", lines=TIG_TEMPLATE_LINES)
    pm = create_user(client, admin_headers, "pm_gen", "project_manager")
    pm_headers = login(client, "pm_gen")

    own_project = create_project(client, admin_headers, project_manager_id=pm["id"])
    other_project = create_project(client, admin_headers)
    partner = create_partner(client, admin_headers)
    own_tig = create_tig(client, admin_headers, own_project["id"], partner["id"])
    other_tig = create_tig(client, admin_headers, other_project["id"], partner["id"])

    resp = client.post(
        "/api/generated-documents", json={"family": "tig", "source_id": own_tig["id"]}, headers=pm_headers
    )
    assert resp.status_code == 200, resp.text

    resp_denied = client.post(
        "/api/generated-documents", json={"family": "tig", "source_id": other_tig["id"]}, headers=pm_headers
    )
    assert resp_denied.status_code == 403


def test_only_admin_can_delete_generated_document(client, admin_headers, fake_pdf_conversion):
    upload_template(client, admin_headers, family="tig", lines=TIG_TEMPLATE_LINES)
    project = create_project(client, admin_headers)
    partner = create_partner(client, admin_headers)
    tig = create_tig(client, admin_headers, project["id"], partner["id"])
    doc = client.post(
        "/api/generated-documents", json={"family": "tig", "source_id": tig["id"]}, headers=admin_headers
    ).json()

    create_user(client, admin_headers, "pm_del", "project_manager")
    pm_headers = login(client, "pm_del")
    resp = client.delete(f"/api/generated-documents/{doc['id']}", headers=pm_headers)
    assert resp.status_code == 403

    resp = client.delete(f"/api/generated-documents/{doc['id']}", headers=admin_headers)
    assert resp.status_code == 200
