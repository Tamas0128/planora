from datetime import date

from tests.conftest import TestingSessionLocal, create_project


def test_geocode_address_returns_none_when_disabled(monkeypatch):
    from app.services.geocoding import geocode_address

    monkeypatch.setattr("app.services.geocoding.settings.geocoding_enabled", False)
    assert geocode_address("Budapest", "Fő utca 1") is None


def test_geocode_address_parses_nominatim_response(monkeypatch):
    from app.services import geocoding

    monkeypatch.setattr(geocoding.settings, "geocoding_enabled", True)

    class FakeResponse:
        def raise_for_status(self):
            pass

        def json(self):
            return [{"lat": "47.4979", "lon": "19.0402"}]

    monkeypatch.setattr(geocoding.httpx, "get", lambda *a, **k: FakeResponse())
    result = geocoding.geocode_address("Budapest", "Fő utca 1")
    assert result == (47.4979, 19.0402)


def test_geocode_address_returns_none_on_empty_results(monkeypatch):
    from app.services import geocoding

    monkeypatch.setattr(geocoding.settings, "geocoding_enabled", True)

    class FakeResponse:
        def raise_for_status(self):
            pass

        def json(self):
            return []

    monkeypatch.setattr(geocoding.httpx, "get", lambda *a, **k: FakeResponse())
    assert geocoding.geocode_address("Nowhere", "Nonexistent 1") is None


def test_geocode_address_returns_none_on_network_error(monkeypatch):
    from app.services import geocoding

    monkeypatch.setattr(geocoding.settings, "geocoding_enabled", True)

    def raise_error(*a, **k):
        raise ConnectionError("no network")

    monkeypatch.setattr(geocoding.httpx, "get", raise_error)
    assert geocoding.geocode_address("Budapest", "Fő utca 1") is None


def test_geocode_project_in_background_never_overwrites_existing_coords(monkeypatch):
    from app.models import Project
    from app.services import geocoding

    monkeypatch.setattr(geocoding, "geocode_address", lambda settlement, address: (1.0, 2.0))
    monkeypatch.setattr("app.database.SessionLocal", TestingSessionLocal)

    db = TestingSessionLocal()
    try:
        project = Project(
            name="Geo Test", project_code="GEO-1", settlement="Test", address="Test 1",
            client_name="Client", floor_area_sqm=100, delivery_date=date(2026, 12, 1),
            latitude=9.9, longitude=9.9,
        )
        db.add(project)
        db.commit()
        db.refresh(project)
        pid = project.id
    finally:
        db.close()

    geocoding.geocode_project_in_background(pid, "Test", "Test 1")

    db = TestingSessionLocal()
    try:
        reloaded = db.query(Project).get(pid)
        assert reloaded.latitude == 9.9
        assert reloaded.longitude == 9.9
    finally:
        db.close()


def test_create_project_schedules_geocoding_when_no_coords_given(client, admin_headers, monkeypatch):
    calls = []
    monkeypatch.setattr(
        "app.api.projects.geocode_project_in_background",
        lambda pid, settlement, address: calls.append((pid, settlement, address)),
    )
    project = create_project(client, admin_headers)
    assert len(calls) == 1
    assert calls[0][0] == project["id"]


def test_create_project_skips_geocoding_when_coords_given(client, admin_headers, monkeypatch):
    calls = []
    monkeypatch.setattr(
        "app.api.projects.geocode_project_in_background",
        lambda pid, settlement, address: calls.append((pid, settlement, address)),
    )
    create_project(client, admin_headers, latitude=47.5, longitude=19.0)
    assert len(calls) == 0
