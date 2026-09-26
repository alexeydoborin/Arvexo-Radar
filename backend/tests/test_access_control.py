from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.api.auth import SESSION_COOKIE, tenant_id_for_account
from app.api.deps import get_analytics_repository
from app.api.security import SlidingWindowLimiter
from app.config import Settings, get_settings
from app.main import app
from tests.test_session_auth import SECRET, make_cookie

ADMIN = "owner@arvexo.ru"


@pytest.fixture
def client():
    settings = Settings(
        auth_mode="demo",
        radar_session_secret=SECRET,
        admin_emails=[ADMIN],
        rate_limit_per_minute=3,
    )
    app.dependency_overrides[get_settings] = lambda: settings
    try:
        yield TestClient(app, raise_server_exceptions=False)
    finally:
        app.dependency_overrides.clear()


def _sign_in(client: TestClient, email: str, user_id: str = "u1") -> None:
    client.cookies.set(SESSION_COOKIE, make_cookie(id=user_id, email=email))


def test_each_account_gets_its_own_stable_tenant() -> None:
    assert tenant_id_for_account("u1") == tenant_id_for_account("u1")
    assert tenant_id_for_account("u1") != tenant_id_for_account("u2")


def test_regular_user_reads_but_cannot_change_shared_methodology(client: TestClient) -> None:
    _sign_in(client, "user@example.com")
    current = client.get("/api/methodology")
    assert current.status_code == 200
    response = client.put("/api/methodology", json=current.json())
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "FORBIDDEN"
    assert client.delete("/api/cost-components/anything").status_code == 403


def test_admin_can_change_shared_methodology(client: TestClient) -> None:
    _sign_in(client, ADMIN.upper())
    current = client.get("/api/methodology").json()
    assert client.put("/api/methodology", json=current).status_code == 200


def test_regular_user_cannot_move_demo_best_practices(client: TestClient) -> None:
    _sign_in(client, "user@example.com")
    practice_id = client.get("/api/best-practices").json()["items"][0]["id"]
    assert client.post(f"/api/best-practices/{practice_id}/approve").status_code == 403


class _ExplodingTelemetry:
    def __getattr__(self, name: str):
        raise AssertionError("org-wide telemetry must not be queried for regular users")


def test_org_telemetry_is_hidden_from_regular_users(client: TestClient) -> None:
    app.dependency_overrides[get_analytics_repository] = lambda: _ExplodingTelemetry()
    _sign_in(client, "user@example.com")
    for path in ("overview", "usage", "models", "errors"):
        assert client.get(f"/api/analytics/{path}").status_code == 200, path


def test_writes_are_rate_limited_per_account(client: TestClient) -> None:
    _sign_in(client, "user@example.com")
    statuses = [client.put("/api/methodology", json={}).status_code for _ in range(4)]
    assert statuses[:3] != [429, 429, 429]
    assert statuses[3] == 429
    _sign_in(client, "other@example.com", user_id="u2")
    assert client.put("/api/methodology", json={}).status_code != 429


def test_sliding_window_limiter_frees_slots_after_window() -> None:
    limiter = SlidingWindowLimiter()
    assert limiter.allow("k", limit=1, window_seconds=0.01)
    assert not limiter.allow("k", limit=1, window_seconds=60)


@pytest.mark.parametrize(
    ("headers", "allowed"),
    [
        ({}, True),
        ({"Origin": "http://localhost:3000"}, True),
        ({"Origin": "https://evil.example"}, False),
        ({"Origin": "https://sub.arvexo.ru"}, False),
        ({"Origin": "null"}, False),
        ({"Referer": "https://evil.example/page"}, False),
        ({"Origin": "http://testserver"}, True),
    ],
    ids=["no-origin", "allowed-origin", "foreign", "sibling-subdomain", "null", "foreign-referer", "same-host"],
)
def test_cross_site_writes_are_rejected(headers: dict[str, str], allowed: bool) -> None:
    response = TestClient(app).post("/api/best-practices/missing/approve", headers=headers)
    assert (response.status_code != 403) is allowed
    if not allowed:
        assert response.json()["error"]["code"] == "CROSS_SITE_REQUEST_REJECTED"
