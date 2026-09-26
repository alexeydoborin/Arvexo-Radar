"""End-to-end account isolation against a real database (runs in CI, where
ARVEXO_DATABASE_URL points at the Postgres service)."""

from __future__ import annotations

import os
import uuid

import pytest
from fastapi.testclient import TestClient

from app.api.auth import SESSION_COOKIE
from app.config import Settings, get_settings
from app.infrastructure.db.session import engine
from app.main import app
from tests.test_session_auth import SECRET, make_cookie

pytestmark = pytest.mark.skipif(
    "ARVEXO_DATABASE_URL" not in os.environ, reason="needs a migrated Postgres database"
)

CSV = b"text,request_id\nHelp me draft an email to a client,r1\nSummarise this contract,r2\n"


@pytest.fixture
def configure(tmp_path):
    def apply(**overrides: object) -> None:
        settings = Settings(
            auth_mode="demo",
            radar_session_secret=SECRET,
            storage_path=str(tmp_path),
            **overrides,
        )
        app.dependency_overrides[get_settings] = lambda: settings

    apply()
    yield apply
    app.dependency_overrides.pop(get_settings, None)


@pytest.fixture
def client(configure):
    # One client (one event loop) for the whole test: the asyncpg pool is
    # bound to the loop that opened its connections.
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client
        # Close pooled connections on this loop before the next test opens its own.
        test_client.portal.call(engine.dispose)


def _as(client: TestClient, user_id: str) -> TestClient:
    client.cookies.set(SESSION_COOKIE, make_cookie(id=user_id, email=f"{user_id}@example.com"))
    return client


def _upload(client: TestClient, content: bytes = CSV):
    return client.post("/api/v1/datasets", files={"file": ("data.csv", content)})


def test_accounts_cannot_see_or_use_each_others_data(client: TestClient) -> None:
    alice, bob = f"alice-{uuid.uuid4()}", f"bob-{uuid.uuid4()}"

    uploaded = _upload(_as(client, alice))
    assert uploaded.status_code == 201
    dataset_id = uploaded.json()["id"]
    run = client.post(f"/api/v1/datasets/{dataset_id}/runs", json={})
    assert run.status_code == 202
    run_id = run.json()["run_id"]

    _as(client, bob)
    assert client.get("/api/v1/datasets").json() == []
    assert client.get(f"/api/v1/datasets/{dataset_id}").status_code == 404
    assert client.get(f"/api/v1/datasets/{dataset_id}/preview").status_code == 404
    assert client.post(f"/api/v1/datasets/{dataset_id}/runs", json={}).status_code == 404
    assert client.get(f"/api/v1/runs/{run_id}").status_code == 404
    assert client.post(f"/api/v1/runs/{run_id}/reports").status_code == 404
    # The same file uploaded by another account becomes that account's own copy.
    own_copy = _upload(client)
    assert own_copy.status_code == 201 and own_copy.json()["id"] != dataset_id

    _as(client, alice)
    assert [row["id"] for row in client.get("/api/v1/datasets").json()] == [dataset_id]
    assert client.get(f"/api/v1/runs/{run_id}").status_code == 200


def test_quotas_bound_uploads_runs_and_disk(client: TestClient, configure) -> None:
    _as(client, f"carol-{uuid.uuid4()}")
    dataset_id = _upload(client).json()["id"]

    configure(upload_limit_per_hour=1)
    assert _upload(client, CSV + b"more,r3\n").status_code == 429
    configure(tenant_storage_quota_bytes=10)
    assert _upload(client, CSV + b"more,r4\n").status_code == 413
    configure(min_free_disk_bytes=10**15)
    assert _upload(client, CSV + b"more,r5\n").status_code == 507
    configure(max_upload_bytes=10)
    assert _upload(client, CSV + b"more,r6\n").status_code == 413

    configure()
    assert client.post(f"/api/v1/datasets/{dataset_id}/runs", json={}).status_code == 202
    configure(run_limit_per_day=1)
    response = client.post(
        f"/api/v1/datasets/{dataset_id}/runs", json={}, headers={"Idempotency-Key": "second"}
    )
    assert response.status_code == 429
