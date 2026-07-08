import logging

from tests.conftest import TestingSessionLocal, create_project, create_user, login


def test_get_user_digest_items_scoped_to_procurement(client, admin_headers):
    from app.models import User
    from app.services.notifications import get_user_digest_items

    create_project(client, admin_headers, delivery_date="2026-01-01")
    create_user(client, admin_headers, "procdigest", "procurement")

    db = TestingSessionLocal()
    try:
        procurement_user = db.query(User).filter(User.username == "procdigest").first()
        overdue, upcoming = get_user_digest_items(db, procurement_user)
        for activity, _project in overdue + upcoming:
            assert activity.responsible_role.value == "procurement"
    finally:
        db.close()


def test_send_email_logs_when_smtp_not_configured(caplog, monkeypatch):
    import app.services.notifications as notifications_module

    monkeypatch.setattr(notifications_module.settings, "smtp_host", "")
    with caplog.at_level(logging.INFO, logger="planora.notifications"):
        notifications_module.send_email("someone@example.com", "Subject", "Body text")
    assert any("SMTP not configured" in record.message for record in caplog.records)


def test_trigger_digest_endpoint_admin_only(client, admin_headers, monkeypatch):
    monkeypatch.setattr("app.services.notifications.send_email", lambda *a, **k: None)
    create_project(client, admin_headers, delivery_date="2026-01-01")

    resp = client.post("/api/notifications/send-digest", headers=admin_headers)
    assert resp.status_code == 200
    assert "sent" in resp.json()


def test_trigger_digest_forbidden_for_non_admin(client, admin_headers):
    create_user(client, admin_headers, "pmdigest", "project_manager")
    headers = login(client, "pmdigest")
    resp = client.post("/api/notifications/send-digest", headers=headers)
    assert resp.status_code == 403


def test_digest_persists_notifications_and_read_flow(client, admin_headers, monkeypatch):
    monkeypatch.setattr("app.services.notifications.send_email", lambda *a, **k: None)
    create_project(client, admin_headers, delivery_date="2026-01-01")

    resp = client.post("/api/notifications/send-digest", headers=admin_headers)
    assert resp.status_code == 200

    listing = client.get("/api/notifications", headers=admin_headers).json()
    assert len(listing) >= 1
    assert all(n["read_at"] is None for n in listing)

    first_id = listing[0]["id"]
    mark = client.post(f"/api/notifications/{first_id}/read", headers=admin_headers)
    assert mark.status_code == 200

    listing_after = client.get("/api/notifications", headers=admin_headers).json()
    marked = next(n for n in listing_after if n["id"] == first_id)
    assert marked["read_at"] is not None


def test_digest_does_not_duplicate_unread_notifications(client, admin_headers, monkeypatch):
    monkeypatch.setattr("app.services.notifications.send_email", lambda *a, **k: None)
    create_project(client, admin_headers, delivery_date="2026-01-01")

    client.post("/api/notifications/send-digest", headers=admin_headers)
    client.post("/api/notifications/send-digest", headers=admin_headers)

    listing = client.get("/api/notifications", headers=admin_headers).json()
    titles = [n["title"] for n in listing]
    assert len(titles) == len(set(titles))


def test_digest_preview_matches_email_digest_content(client, admin_headers):
    create_project(client, admin_headers, delivery_date="2026-01-01")

    resp = client.get("/api/notifications/digest-preview", headers=admin_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "overdue" in data and "upcoming" in data
    assert all("activity_name" in item for item in data["overdue"])


def test_mark_all_read(client, admin_headers, monkeypatch):
    monkeypatch.setattr("app.services.notifications.send_email", lambda *a, **k: None)
    create_project(client, admin_headers, delivery_date="2026-01-01")
    client.post("/api/notifications/send-digest", headers=admin_headers)

    resp = client.post("/api/notifications/read-all", headers=admin_headers)
    assert resp.status_code == 200

    listing = client.get("/api/notifications", headers=admin_headers).json()
    assert all(n["read_at"] is not None for n in listing)
