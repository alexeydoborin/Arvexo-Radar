from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time

import pytest
from fastapi.testclient import TestClient

from app.api.auth import SESSION_COOKIE, verify_session
from app.config import Settings, get_settings
from app.main import app

SECRET = "unit-test-session-secret-0123456789abcdef"

PROTECTED_PATHS = [
    "/api/analytics/overview",
    "/api/methodology",
    "/api/best-practices",
    "/api/v1/datasets",
]


def _b64(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode()


def make_cookie(*, secret: str = SECRET, exp_offset: int = 3600, **overrides: object) -> str:
    claims = {"id": "u1", "email": "user@example.com", "name": None, "exp": int(time.time()) + exp_offset}
    claims.update(overrides)
    payload = _b64(json.dumps(claims).encode())
    signature = _b64(hmac.new(secret.encode(), payload.encode(), hashlib.sha256).digest())
    return f"{payload}.{signature}"


@pytest.fixture
def secured_client():
    settings = Settings(radar_session_secret=SECRET)
    app.dependency_overrides[get_settings] = lambda: settings
    try:
        yield TestClient(app, raise_server_exceptions=False)
    finally:
        app.dependency_overrides.pop(get_settings, None)


@pytest.mark.parametrize("path", PROTECTED_PATHS)
def test_protected_routes_reject_anonymous_requests(secured_client: TestClient, path: str) -> None:
    response = secured_client.get(path)
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "AUTHENTICATION_REQUIRED"


def test_upload_and_run_creation_reject_anonymous_requests(secured_client: TestClient) -> None:
    upload = secured_client.post("/api/v1/datasets", files={"file": ("a.csv", b"text\nhello\n")})
    run = secured_client.post(
        "/api/v1/datasets/00000000-0000-0000-0000-000000000000/runs", json={"provider_mode": "mock"}
    )
    assert upload.status_code == 401
    assert run.status_code == 401


def test_health_stays_public(secured_client: TestClient) -> None:
    assert secured_client.get("/api/v1/health").status_code == 200


def test_valid_session_is_accepted(secured_client: TestClient) -> None:
    secured_client.cookies.set(SESSION_COOKIE, make_cookie())
    assert secured_client.get("/api/methodology").status_code == 200


@pytest.mark.parametrize(
    "cookie",
    [
        make_cookie(secret="another-secret-0123456789abcdefghijk"),
        make_cookie(exp_offset=-10),
        make_cookie(email=""),
        "not-a-cookie",
        "a.b.c",
        ".",
    ],
    ids=["wrong-secret", "expired", "no-email", "malformed", "three-parts", "empty-parts"],
)
def test_invalid_cookies_are_rejected(secured_client: TestClient, cookie: str) -> None:
    secured_client.cookies.set(SESSION_COOKIE, cookie)
    assert secured_client.get("/api/analytics/overview").status_code == 401


def test_tampered_payload_is_rejected() -> None:
    payload, signature = make_cookie().split(".")
    forged = _b64(json.dumps({"id": "admin", "email": "a@b.c", "exp": int(time.time()) + 3600}).encode())
    assert verify_session(f"{payload}.{signature}", SECRET) is not None
    assert verify_session(f"{forged}.{signature}", SECRET) is None


def test_without_secret_local_development_stays_open() -> None:
    settings = Settings(radar_session_secret=None)
    app.dependency_overrides[get_settings] = lambda: settings
    try:
        assert TestClient(app).get("/api/methodology").status_code == 200
    finally:
        app.dependency_overrides.pop(get_settings, None)


@pytest.mark.parametrize("secret", [None, "short", "replace-with-at-least-32-random-characters"])
def test_production_requires_a_real_session_secret(secret: str | None) -> None:
    with pytest.raises(ValueError, match="ARVEXO_RADAR_SESSION_SECRET"):
        Settings(
            environment="production",
            analytics_user_hash_salt="x" * 32,
            radar_session_secret=secret,
        )
