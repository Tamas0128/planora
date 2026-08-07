import os

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret")

import io

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.api.auth as auth_module
import app.main as main_module
from app.database import Base, get_db
from app.main import app

# Tests make many login calls across the suite; disable the per-IP rate limit.
auth_module._MAX_ATTEMPTS = 10_000

test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(bind=test_engine, autoflush=False, autocommit=False)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


class FakeS3Client:
    def __init__(self):
        self.store: dict[str, dict[str, bytes]] = {}

    def head_bucket(self, Bucket):
        if Bucket not in self.store:
            raise Exception("bucket not found")

    def create_bucket(self, Bucket):
        self.store.setdefault(Bucket, {})

    def put_bucket_versioning(self, Bucket, VersioningConfiguration):
        pass

    def put_object(self, Bucket, Key, Body, ContentType=None):
        self.store.setdefault(Bucket, {})[Key] = Body

    def get_object(self, Bucket, Key):
        return {"Body": io.BytesIO(self.store.get(Bucket, {})[Key])}

    def generate_presigned_url(self, operation, Params, ExpiresIn=300):
        return f"http://fake-s3.local/{Params['Bucket']}/{Params['Key']}?expires={ExpiresIn}"

    def delete_object(self, Bucket, Key):
        self.store.get(Bucket, {}).pop(Key, None)


@pytest.fixture
def fresh_db():
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    yield


@pytest.fixture
def fake_s3(monkeypatch):
    fake_client = FakeS3Client()
    monkeypatch.setattr("app.api.documents.get_s3_client", lambda: fake_client)
    monkeypatch.setattr("app.api.documents.get_public_s3_client", lambda: fake_client)
    # ensure_bucket() memoizes "already ensured" per process; reset it so each
    # test's fresh FakeS3Client actually gets head/create/versioning exercised.
    monkeypatch.setattr("app.api.documents._bucket_ready", False)
    return fake_client


@pytest.fixture
def client(fresh_db, fake_s3, monkeypatch):
    monkeypatch.setattr(main_module, "SessionLocal", TestingSessionLocal)
    # Tests hardcode the seeded admin password as "admin123" (see
    # admin_headers below); ADMIN_PASSWORD leaking in from the host's
    # docker-compose environment (real-deployment value, whatever it
    # currently is) would otherwise seed a different password and break
    # every fixture that logs in as admin — same class of leak as the
    # SMTP_HOST one, fixed the same way: don't depend on the compose file.
    monkeypatch.setattr("app.main.settings.admin_password", "admin123")
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def admin_headers(client):
    resp = client.post(
        "/api/auth/login/json", json={"username": "admin", "password": "admin123"}
    )
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def create_user(client, admin_headers, username, role, email=None):
    resp = client.post(
        "/api/auth/users",
        json={
            "username": username,
            "email": email or f"{username}@example.com",
            "full_name": username.title(),
            "password": "testpass123",
            "role": role,
        },
        headers=admin_headers,
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


def login(client, username, password="testpass123"):
    resp = client.post(
        "/api/auth/login/json", json={"username": username, "password": password}
    )
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def create_project(client, headers, **overrides):
    body = {
        "name": "Test Project",
        "project_code": f"TP-{os.urandom(4).hex()}",
        "settlement": "Budapest",
        "address": "Test street 1",
        "client_name": "Test Client",
        "floor_area_sqm": 120,
        "delivery_date": "2026-12-01",
        "building_type": "light_steel",
    }
    body.update(overrides)
    resp = client.post("/api/projects", json=body, headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()
