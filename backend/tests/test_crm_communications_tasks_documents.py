import io


def create_customer(client, headers, **overrides):
    body = {"type": "person", "name": "Comm Ügyfél", "owner_id": 1}
    body.update(overrides)
    return client.post("/api/crm/customers", json=body, headers=headers).json()


def test_communication_event_create_and_list(client, admin_headers):
    customer = create_customer(client, admin_headers)
    resp = client.post(
        "/api/crm/communications",
        json={
            "customer_id": customer["id"],
            "type": "phone",
            "date": "2026-07-31",
            "summary": "Érdeklődés telefonon",
        },
        headers=admin_headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["agent_id"] == 1  # defaults to the calling user

    listed = client.get(
        f"/api/crm/communications?customer_id={customer['id']}", headers=admin_headers
    ).json()
    assert len(listed) == 1


def test_crm_task_create_and_close(client, admin_headers):
    customer = create_customer(client, admin_headers)
    task = client.post(
        "/api/crm/tasks",
        json={
            "name": "Kövesd fel",
            "customer_id": customer["id"],
            "due_date": "2026-08-05",
            "owner_id": 1,
            "priority": "high",
        },
        headers=admin_headers,
    ).json()
    assert task["status"] == "open"

    closed = client.patch(
        f"/api/crm/tasks/{task['id']}", json={"status": "done"}, headers=admin_headers
    ).json()
    assert closed["status"] == "done"


def test_crm_task_not_found_for_non_owner(client, admin_headers):
    from tests.conftest import create_user, login

    create_user(client, admin_headers, "sales1", "project_manager")
    create_user(client, admin_headers, "sales2", "project_manager")
    headers1 = login(client, "sales1")
    headers2 = login(client, "sales2")
    customer = create_customer(client, headers1)

    task = client.post(
        "/api/crm/tasks",
        json={"name": "Sales1 task", "customer_id": customer["id"], "due_date": "2026-08-05"},
        headers=headers1,
    ).json()
    resp = client.patch(
        f"/api/crm/tasks/{task['id']}", json={"status": "done"}, headers=headers2
    )
    # scoped_crm_task_query filters out other users' tasks entirely — 404,
    # not 403, so the endpoint doesn't leak that the task exists.
    assert resp.status_code == 404


def test_crm_document_upload_multi_link_and_download(client, admin_headers, fake_s3):
    customer = create_customer(client, admin_headers)
    upload = client.post(
        "/api/crm/documents",
        data={"entity_type": "customer", "entity_id": str(customer["id"]), "document_type": "other"},
        files={"file": ("test.pdf", io.BytesIO(b"hello world"), "application/pdf")},
        headers=admin_headers,
    )
    assert upload.status_code == 200, upload.text
    doc = upload.json()
    assert doc["original_filename"] == "test.pdf"

    listed = client.get(
        f"/api/crm/documents?entity_type=customer&entity_id={customer['id']}", headers=admin_headers
    ).json()
    assert len(listed) == 1

    # link the same document to a second, unrelated entity — BRS 6.9 "egy
    # dokumentum több üzleti rekordhoz is kapcsolható"
    link_resp = client.post(
        f"/api/crm/documents/{doc['id']}/link",
        data={"entity_type": "opportunity", "entity_id": "1"},
        headers=admin_headers,
    )
    assert link_resp.status_code == 200

    listed_opp = client.get(
        "/api/crm/documents?entity_type=opportunity&entity_id=1", headers=admin_headers
    ).json()
    assert len(listed_opp) == 1
    assert listed_opp[0]["id"] == doc["id"]

    download = client.get(f"/api/crm/documents/{doc['id']}/download", headers=admin_headers)
    assert download.status_code == 200
    assert "url" in download.json()


def test_crm_document_rejects_disallowed_extension(client, admin_headers, fake_s3):
    customer = create_customer(client, admin_headers)
    resp = client.post(
        "/api/crm/documents",
        data={"entity_type": "customer", "entity_id": str(customer["id"])},
        files={"file": ("virus.exe", io.BytesIO(b"x"), "application/octet-stream")},
        headers=admin_headers,
    )
    assert resp.status_code == 400
