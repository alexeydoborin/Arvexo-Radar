from __future__ import annotations

import asyncio
import uuid
from datetime import UTC, datetime
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_openai_proxy_client, get_telemetry_recorder
from app.api.routers.proxy import chat_completions
from app.config import Settings, get_settings
from app.main import app
from app.schemas.proxy import ChatCompletionRequest, RadarMetadata
from app.services.analytics_telemetry import TelemetryContext


class ChunkStream(httpx.AsyncByteStream):
    def __init__(self, chunks: list[bytes]) -> None:
        self._chunks = chunks

    async def __aiter__(self):
        for chunk in self._chunks:
            yield chunk


class FakeProxyClient:
    def __init__(self, response: httpx.Response | None = None, error: Exception | None = None):
        self.response = response
        self.error = error
        self.payload: dict[str, Any] | None = None

    async def send(self, payload: dict[str, Any], **_: Any) -> httpx.Response:
        self.payload = payload
        if self.error:
            raise self.error
        assert self.response is not None
        return self.response

    async def aclose(self) -> None:
        return None


class FakeRecorder:
    def __init__(self) -> None:
        self.contexts: list[TelemetryContext] = []
        self.finalizations: list[dict[str, Any]] = []
        self.metadata: RadarMetadata | None = None

    def start(
        self, request: ChatCompletionRequest, metadata: RadarMetadata
    ) -> TelemetryContext:
        self.metadata = metadata
        context = TelemetryContext(
            request_id=uuid.uuid4(),
            started_at=datetime.now(UTC),
            model=request.model,
            stream=request.stream,
            messages_count=len(request.messages),
            input_characters=0,
            user_id_hash="hashed" if metadata.user_id else None,
            department=metadata.department,
            scenario=metadata.scenario,
        )
        self.contexts.append(context)
        return context

    @staticmethod
    def mark_first_token(context: TelemetryContext) -> None:
        if context.first_token_at is None:
            context.first_token_at = datetime.now(UTC)

    async def finalize(self, context: TelemetryContext, **kwargs: Any) -> None:
        if context.finalized:
            return
        self.finalizations.append(kwargs)
        context.finalized = True


def _response(*, status: int = 200, json: Any = None, stream: list[bytes] | None = None):
    request = httpx.Request("POST", "https://provider.example/v1/chat/completions")
    if stream is not None:
        return httpx.Response(
            status,
            headers={"content-type": "text/event-stream"},
            stream=ChunkStream(stream),
            request=request,
        )
    return httpx.Response(status, json=json, request=request)


def _client_with_overrides(proxy_client: FakeProxyClient, recorder: FakeRecorder):
    app.dependency_overrides[get_openai_proxy_client] = lambda: proxy_client
    app.dependency_overrides[get_telemetry_recorder] = lambda: recorder
    return TestClient(app)


def _cleanup_overrides() -> None:
    app.dependency_overrides.pop(get_openai_proxy_client, None)
    app.dependency_overrides.pop(get_telemetry_recorder, None)


def test_non_streaming_success_records_usage_and_strips_metadata() -> None:
    proxy_client = FakeProxyClient(
        _response(
            json={
                "choices": [{"message": {"role": "assistant", "content": "answer"}}],
                "usage": {"prompt_tokens": 10, "completion_tokens": 4, "total_tokens": 14},
            }
        )
    )
    recorder = FakeRecorder()
    client = _client_with_overrides(proxy_client, recorder)
    try:
        response = client.post(
            "/v1/chat/completions",
            headers={"X-Radar-User-Id": "employee", "X-Radar-Department": "IT"},
            json={
                "model": "DeepSeek-V4-Flash",
                "messages": [{"role": "user", "content": "hello"}],
                "metadata": {"user_id": "body-user", "scenario": "assistant"},
            },
        )
    finally:
        _cleanup_overrides()

    assert response.status_code == 200
    assert proxy_client.payload is not None and "metadata" not in proxy_client.payload
    assert recorder.metadata == RadarMetadata(
        user_id="employee", department="IT", scenario="assistant"
    )
    finalized = recorder.finalizations[-1]
    assert finalized["status"] == "success"
    assert finalized["usage"].total_tokens == 14


def test_streaming_success_records_first_chunk_and_final_usage() -> None:
    chunks = [
        b'data: {"choices":[{"delta":{"content":"a"}}]}\n\n',
        b'data: {"choices":[],"usage":{"prompt_tokens":8,"completion_tokens":2,',
        b'"total_tokens":10}}\n\ndata: [DONE]\n\n',
    ]
    proxy_client = FakeProxyClient(_response(stream=chunks))
    recorder = FakeRecorder()
    client = _client_with_overrides(proxy_client, recorder)
    try:
        response = client.post(
            "/v1/chat/completions",
            json={
                "model": "DeepSeek-V4-Flash",
                "stream": True,
                "stream_options": {"include_usage": True},
                "messages": [{"role": "user", "content": "hello"}],
            },
        )
    finally:
        _cleanup_overrides()

    assert response.status_code == 200
    assert recorder.contexts[0].first_token_at is not None
    assert recorder.finalizations[-1]["status"] == "success"
    assert recorder.finalizations[-1]["usage"].total_tokens == 10


def test_provider_rate_limit_is_recorded_and_propagated() -> None:
    proxy_client = FakeProxyClient(
        _response(status=429, json={"error": {"type": "rate_limit_error"}})
    )
    recorder = FakeRecorder()
    client = _client_with_overrides(proxy_client, recorder)
    try:
        response = client.post(
            "/v1/chat/completions",
            json={"model": "m", "messages": [{"role": "user", "content": "x"}]},
        )
    finally:
        _cleanup_overrides()

    assert response.status_code == 429
    assert recorder.finalizations[-1]["error_type"] == "rate_limit"


def test_timeout_is_recorded_as_504() -> None:
    proxy_client = FakeProxyClient(error=httpx.ReadTimeout("slow"))
    recorder = FakeRecorder()
    client = _client_with_overrides(proxy_client, recorder)
    try:
        response = client.post(
            "/v1/chat/completions",
            json={"model": "m", "messages": [{"role": "user", "content": "x"}]},
        )
    finally:
        _cleanup_overrides()

    assert response.status_code == 504
    assert recorder.finalizations[-1]["error_type"] == "timeout"


def test_invalid_request_is_still_recorded() -> None:
    proxy_client = FakeProxyClient()
    recorder = FakeRecorder()
    client = _client_with_overrides(proxy_client, recorder)
    try:
        response = client.post("/v1/chat/completions", json={"model": "m"})
    finally:
        _cleanup_overrides()
    assert response.status_code == 422
    assert recorder.finalizations[-1]["error_type"] == "invalid_response"


@pytest.mark.asyncio
async def test_closing_stream_iterator_records_disconnect() -> None:
    proxy_client = FakeProxyClient(
        _response(
            stream=[
                b'data: {"choices":[{"delta":{"content":"a"}}]}\n\n',
                b'data: {"choices":[{"delta":{"content":"b"}}]}\n\n',
            ]
        )
    )
    recorder = FakeRecorder()
    response = await chat_completions(
        raw_body={
            "model": "m",
            "stream": True,
            "messages": [{"role": "user", "content": "x"}],
        },
        authorization=None,
        user_id=None,
        department=None,
        scenario=None,
        client=proxy_client,  # type: ignore[arg-type]
        recorder=recorder,  # type: ignore[arg-type]
    )
    iterator = response.body_iterator
    await anext(iterator)
    await iterator.aclose()

    assert recorder.finalizations[-1]["status"] == "error"
    assert recorder.finalizations[-1]["http_status"] == 499


@pytest.mark.asyncio
async def test_runtime_stream_failure_records_error() -> None:
    class FailingStream(httpx.AsyncByteStream):
        async def __aiter__(self):
            yield b'data: {"choices":[]}\n\n'
            raise RuntimeError("broken transport")

    response = httpx.Response(
        200,
        headers={"content-type": "text/event-stream"},
        stream=FailingStream(),
        request=httpx.Request("POST", "https://provider.example/v1/chat/completions"),
    )
    proxy_client = FakeProxyClient(response)
    recorder = FakeRecorder()
    streaming_response = await chat_completions(
        raw_body={
            "model": "m",
            "stream": True,
            "messages": [{"role": "user", "content": "x"}],
        },
        authorization=None,
        user_id=None,
        department=None,
        scenario=None,
        client=proxy_client,  # type: ignore[arg-type]
        recorder=recorder,  # type: ignore[arg-type]
    )
    iterator = streaming_response.body_iterator
    await anext(iterator)
    with pytest.raises(RuntimeError):
        await anext(iterator)
    assert recorder.finalizations[-1]["error_type"] == "internal_proxy_error"


def test_asyncio_is_available_for_disconnect_path() -> None:
    assert asyncio.CancelledError is not None


def _server_key_settings(client_token: str | None) -> Settings:
    return Settings(
        llm_proxy_base_url="https://provider.example/v1",
        llm_proxy_api_key="server-provider-key",
        llm_proxy_client_token=client_token,
    )


@pytest.mark.parametrize(
    ("client_token", "authorization"),
    [
        (None, None),
        (None, "Bearer anything"),
        ("radar-agent-token", None),
        ("radar-agent-token", "Bearer wrong-token"),
        ("radar-agent-token", "radar-agent-token"),
    ],
    ids=["no-token-configured", "token-unconfigured-any-bearer", "missing", "wrong", "no-scheme"],
)
def test_server_key_mode_rejects_callers_without_client_token(
    client_token: str | None, authorization: str | None
) -> None:
    proxy_client = FakeProxyClient(_response(json={"choices": []}))
    recorder = FakeRecorder()
    client = _client_with_overrides(proxy_client, recorder)
    app.dependency_overrides[get_settings] = lambda: _server_key_settings(client_token)
    headers = {"Authorization": authorization} if authorization else {}
    try:
        response = client.post(
            "/v1/chat/completions",
            headers=headers,
            json={"model": "m", "messages": [{"role": "user", "content": "x"}]},
        )
    finally:
        app.dependency_overrides.pop(get_settings, None)
        _cleanup_overrides()

    assert response.status_code == 401
    assert proxy_client.payload is None
    assert recorder.contexts == []


def test_server_key_mode_accepts_valid_client_token() -> None:
    proxy_client = FakeProxyClient(_response(json={"choices": []}))
    recorder = FakeRecorder()
    client = _client_with_overrides(proxy_client, recorder)
    app.dependency_overrides[get_settings] = lambda: _server_key_settings("radar-agent-token")
    try:
        response = client.post(
            "/v1/chat/completions",
            headers={"Authorization": "Bearer radar-agent-token"},
            json={"model": "m", "messages": [{"role": "user", "content": "x"}]},
        )
    finally:
        app.dependency_overrides.pop(get_settings, None)
        _cleanup_overrides()

    assert response.status_code == 200
    assert proxy_client.payload is not None
