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


def test_update_project_clears_stale_pin_and_schedules_geocode(client, admin_headers, monkeypatch):
    calls = []
    monkeypatch.setattr(
        "app.api.projects.geocode_project_in_background",
        lambda pid, settlement, address: calls.append((pid, settlement, address)),
    )
    project = create_project(client, admin_headers, latitude=47.5, longitude=19.0)

    resp = client.patch(
        f"/api/projects/{project['id']}", json={"address": "New street 2"}, headers=admin_headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["latitude"] is None
    assert body["longitude"] is None
    assert calls == [(project["id"], project["settlement"], "New street 2")]


def test_update_project_keeps_coords_when_caller_supplies_both(client, admin_headers, monkeypatch):
    calls = []
    monkeypatch.setattr(
        "app.api.projects.geocode_project_in_background",
        lambda pid, settlement, address: calls.append((pid, settlement, address)),
    )
    # Give it coordinates at creation so create_project's own trigger stays
    # silent — otherwise its creation-time call would contaminate `calls`
    # before the PATCH under test even runs.
    project = create_project(client, admin_headers, latitude=47.5, longitude=19.0)

    resp = client.patch(
        f"/api/projects/{project['id']}",
        json={"address": "New street 2", "latitude": 1.0, "longitude": 2.0},
        headers=admin_headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["latitude"] == 1.0
    assert body["longitude"] == 2.0
    assert calls == []


def test_update_project_leaves_coords_alone_when_location_unchanged(client, admin_headers, monkeypatch):
    calls = []
    monkeypatch.setattr(
        "app.api.projects.geocode_project_in_background",
        lambda pid, settlement, address: calls.append((pid, settlement, address)),
    )
    project = create_project(client, admin_headers, latitude=47.5, longitude=19.0)

    resp = client.patch(
        f"/api/projects/{project['id']}", json={"floor_area_sqm": 150}, headers=admin_headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["latitude"] == 47.5
    assert body["longitude"] == 19.0
    assert calls == []


def test_geocode_project_in_background_skips_when_address_changed_since_scheduling(monkeypatch):
    from app.models import Project
    from app.services import geocoding

    monkeypatch.setattr(geocoding, "geocode_address", lambda settlement, address: (1.0, 2.0))
    monkeypatch.setattr("app.database.SessionLocal", TestingSessionLocal)

    db = TestingSessionLocal()
    try:
        project = Project(
            name="Race Test", project_code="RACE-1", settlement="Old town", address="Old address",
            client_name="Client", floor_area_sqm=100, delivery_date=date(2026, 12, 1),
        )
        db.add(project)
        db.commit()
        db.refresh(project)
        pid = project.id
        # Simulate a second, newer edit landing before this (stale) task runs.
        project.settlement = "New town"
        project.address = "New address"
        db.commit()
    finally:
        db.close()

    # This task was scheduled for the OLD address, which no longer matches.
    geocoding.geocode_project_in_background(pid, "Old town", "Old address")

    db = TestingSessionLocal()
    try:
        reloaded = db.query(Project).get(pid)
        assert reloaded.latitude is None
        assert reloaded.longitude is None
    finally:
        db.close()


def test_project_before_update_hook_clears_coords_on_address_change():
    from app.models import Project

    db = TestingSessionLocal()
    try:
        project = Project(
            name="Hook Test", project_code="HOOK-1", settlement="Town", address="Addr 1",
            client_name="Client", floor_area_sqm=100, delivery_date=date(2026, 12, 1),
            latitude=1.0, longitude=2.0,
        )
        db.add(project)
        db.commit()

        project.address = "Addr 2"
        db.commit()
        db.refresh(project)
        assert project.latitude is None
        assert project.longitude is None
    finally:
        db.close()
