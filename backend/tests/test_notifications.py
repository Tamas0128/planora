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
