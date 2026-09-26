from datetime import UTC, datetime
from decimal import Decimal

import httpx
import pytest
from pydantic import ValidationError

from app.config import Settings
from app.infrastructure.db.models import LLMRequestEvent, ModelTariff
from app.schemas.proxy import ChatCompletionRequest
from app.services.analytics_telemetry import (
    MAX_SSE_EVENT_BYTES,
    InvalidProviderResponse,
    SSEUsageParser,
    TokenUsage,
    calculate_costs,
    classify_exception,
    classify_http_error,
    count_input_characters,
    extract_usage,
    hash_user_id,
)


def test_hash_user_id_is_salted_and_deterministic() -> None:
    first = hash_user_id("employee-42", "server-salt-one")
    second = hash_user_id("employee-42", "server-salt-one")
    different_salt = hash_user_id("employee-42", "server-salt-two")

    assert first == second
    assert first != different_salt
    assert len(first or "") == 64
    assert "employee-42" not in (first or "")
    assert hash_user_id(None, "server-salt-one") is None


def test_counts_only_message_content_characters() -> None:
    request = ChatCompletionRequest.model_validate(
        {
            "model": "test-model",
            "messages": [
                {"role": "system", "content": "abc"},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "hello"},
                        {"type": "image_url", "image_url": {"url": "xy"}},
                    ],
                },
            ],
        }
    )

    assert len(request.messages) == 2
    assert count_input_characters(request) == len("abc") + len("texthelloimage_urlxy")


def test_cost_formula_uses_exact_decimal_arithmetic() -> None:
    usage = TokenUsage(prompt_tokens=250_000, completion_tokens=125_000, total_tokens=375_000)

    input_cost, output_cost, total_cost = calculate_costs(
        usage, Decimal("2.50"), Decimal("10.00")
    )

    assert input_cost == Decimal("0.625")
    assert output_cost == Decimal("1.250")
    assert total_cost == Decimal("1.875")


def test_missing_token_count_does_not_invent_cost() -> None:
    costs = calculate_costs(TokenUsage(prompt_tokens=100), Decimal(1), Decimal(2))
    assert costs == (Decimal("0.0001"), None, None)


@pytest.mark.parametrize(
    ("status", "payload", "expected"),
    [
        (401, {}, "authentication_error"),
        (403, {}, "authentication_error"),
        (429, {}, "rate_limit"),
        (400, {"error": {"type": "content_filter"}}, "content_filter"),
        (400, {"error": {"type": "tool_error"}}, "tool_error"),
        (500, {}, "provider_error"),
    ],
)
def test_classifies_provider_http_errors(status: int, payload: dict, expected: str) -> None:
    assert classify_http_error(status, payload) == expected


def test_classifies_timeout_invalid_and_internal_exceptions() -> None:
    assert classify_exception(httpx.ReadTimeout("slow")) == "timeout"
    assert classify_exception(InvalidProviderResponse("bad")) == "invalid_response"
    assert classify_exception(RuntimeError("boom")) == "internal_proxy_error"


def test_extract_usage_derives_total_when_provider_omits_it() -> None:
    assert extract_usage({"usage": {"prompt_tokens": 3, "completion_tokens": 4}}) == TokenUsage(
        3, 4, 7
    )


def test_sse_parser_handles_split_final_usage_chunk() -> None:
    parser = SSEUsageParser()
    parser.feed(b'data: {"choices":[{"delta":{"content":"a"}}]}\n\n')
    parser.feed(b'data: {"choices":[],"usage":{"prompt_tokens":10,')
    parser.feed(b'"completion_tokens":5,"total_tokens":15}}\n\ndata: [DONE]\n\n')
    parser.finish()

    assert parser.usage == TokenUsage(10, 5, 15)


def test_sse_parser_rejects_invalid_data_frame() -> None:
    parser = SSEUsageParser()
    with pytest.raises(InvalidProviderResponse):
        parser.feed(b"data: not-json\n\n")


def test_sse_parser_rejects_unbounded_frame() -> None:
    parser = SSEUsageParser()
    with pytest.raises(InvalidProviderResponse):
        parser.feed(b"data: " + b"x" * MAX_SSE_EVENT_BYTES)


def test_analytics_tables_have_no_content_columns_and_use_utc_fields() -> None:
    event_columns = set(LLMRequestEvent.__table__.columns.keys())
    forbidden = {"prompt", "messages", "content", "response", "payload", "request_body"}
    assert event_columns.isdisjoint(forbidden)
    assert LLMRequestEvent.__table__.c.started_at.type.timezone is True
    assert LLMRequestEvent.__table__.c.completed_at.type.timezone is True
    assert ModelTariff.__table__.c.effective_from.type.timezone is True


def test_production_requires_non_demo_hash_salt() -> None:
    with pytest.raises(ValidationError):
        Settings(environment="production")
    settings = Settings(
        environment="production",
        auth_mode="demo",
        analytics_user_hash_salt="a-long-production-secret",
        radar_session_secret="a-long-production-session-secret-0123456789",
    )
    assert settings.analytics_user_hash_salt == "a-long-production-secret"


def test_request_metadata_is_removed_from_provider_payload() -> None:
    request = ChatCompletionRequest.model_validate(
        {
            "model": "test-model",
            "messages": [{"role": "user", "content": "secret input"}],
            "metadata": {"user_id": "u1", "department": "finance"},
            "temperature": 0.2,
        }
    )
    payload = request.provider_payload()
    assert "metadata" not in payload
    assert payload["temperature"] == 0.2


def test_utc_fixture_is_timezone_aware() -> None:
    assert datetime.now(UTC).utcoffset() is not None
