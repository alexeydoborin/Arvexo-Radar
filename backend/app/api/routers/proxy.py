from __future__ import annotations

import asyncio
import hmac
from collections.abc import AsyncIterator
from typing import Annotated, Any

import httpx
from fastapi import APIRouter, Body, Depends, Header, HTTPException
from fastapi.responses import JSONResponse, Response, StreamingResponse
from pydantic import ValidationError

from app.api.deps import get_openai_proxy_client, get_telemetry_recorder
from app.config import Settings, get_settings
from app.infrastructure.providers.openai_proxy import OpenAIProxyClient
from app.schemas.proxy import ChatCompletionRequest, RadarMetadata
from app.services.analytics_telemetry import (
    ErrorType,
    InvalidProviderResponse,
    SSEUsageParser,
    TelemetryContext,
    TelemetryRecorder,
    classify_exception,
    classify_http_error,
    extract_usage,
    response_has_content_filter,
    safe_error_message,
)

router = APIRouter(tags=["LLM proxy"])

_RESPONSE_HEADERS = {"content-type", "cache-control", "x-request-id", "openai-processing-ms"}


def _provider_headers(response: httpx.Response, request_id: str) -> dict[str, str]:
    headers = {
        name: value
        for name, value in response.headers.items()
        if name.lower() in _RESPONSE_HEADERS
    }
    headers["X-Radar-Request-ID"] = request_id
    return headers


def _metadata(
    body_metadata: RadarMetadata | None,
    user_id: str | None,
    department: str | None,
    scenario: str | None,
    role: str | None = None,
    team: str | None = None,
    agent_id: str | None = None,
    scenario_id: str | None = None,
) -> RadarMetadata:
    body = body_metadata or RadarMetadata()
    return RadarMetadata(
        user_id=user_id if user_id is not None else body.user_id,
        role=role if role is not None else body.role,
        department=department if department is not None else body.department,
        team=team if team is not None else body.team,
        location=body.location,
        agent_id=agent_id if agent_id is not None else body.agent_id,
        scenario_id=scenario_id if scenario_id is not None else body.scenario_id,
        scenario=scenario if scenario is not None else body.scenario,
        tool_calls=body.tool_calls,
    )


def require_proxy_client(
    authorization: str | None = Header(default=None, alias="Authorization"),
    settings: Settings = Depends(get_settings),
) -> None:
    """Reject callers that would spend the server's provider key without a token.

    In pass-through mode (no server key) the caller's own Authorization is
    forwarded and the provider authenticates it, so nothing is checked here.
    """
    if not settings.llm_proxy_api_key:
        return
    token = settings.llm_proxy_client_token
    expected = f"Bearer {token.get_secret_value()}" if token else ""
    if not token or not token.get_secret_value() or not hmac.compare_digest(
        (authorization or "").encode(), expected.encode()
    ):
        raise HTTPException(
            status_code=401,
            detail="A valid Radar proxy token is required.",
            headers={"WWW-Authenticate": "Bearer"},
        )


def _proxy_error(status_code: int, error_type: ErrorType, request_id: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        headers={"X-Radar-Request-ID": request_id},
        content={
            "error": {
                "type": error_type,
                "message": safe_error_message(error_type),
                "request_id": request_id,
            }
        },
    )


async def _finalize_cancelled(
    recorder: TelemetryRecorder, context: TelemetryContext
) -> None:
    task = asyncio.create_task(
        recorder.finalize(
            context,
            status="error",
            http_status=499,
            error_type="internal_proxy_error",
            error_message="The downstream client disconnected before stream completion.",
        )
    )
    try:
        await asyncio.shield(task)
    except asyncio.CancelledError:
        await task


@router.post("/v1/chat/completions", dependencies=[Depends(require_proxy_client)])
async def chat_completions(
    raw_body: dict[str, Any] = Body(...),
    authorization: str | None = Header(default=None, alias="Authorization"),
    user_id: str | None = Header(default=None, alias="X-Radar-User-Id"),
    department: str | None = Header(default=None, alias="X-Radar-Department"),
    scenario: str | None = Header(default=None, alias="X-Radar-Scenario"),
    role: Annotated[str | None, Header(alias="X-Radar-Role")] = None,
    team: Annotated[str | None, Header(alias="X-Radar-Team")] = None,
    agent_id: Annotated[str | None, Header(alias="X-Radar-Agent-Id")] = None,
    scenario_id: Annotated[str | None, Header(alias="X-Radar-Scenario-Id")] = None,
    client: OpenAIProxyClient = Depends(get_openai_proxy_client),
    recorder: TelemetryRecorder = Depends(get_telemetry_recorder),
) -> Response:
    try:
        request = ChatCompletionRequest.model_validate(raw_body)
    except ValidationError as exc:
        fallback = ChatCompletionRequest.model_construct(
            model=str(raw_body.get("model") or "unknown")[:255],
            messages=[],
            stream=bool(raw_body.get("stream", False)),
        )
        context = recorder.start(
            fallback,
            _metadata(None, user_id, department, scenario, role, team, agent_id, scenario_id),
        )
        await recorder.finalize(
            context,
            status="error",
            http_status=422,
            error_type="invalid_response",
            error_message="The OpenAI-compatible request body is invalid.",
        )
        return JSONResponse(
            status_code=422,
            headers={"X-Radar-Request-ID": str(context.request_id)},
            content={"detail": exc.errors()},
        )

    metadata = _metadata(
        request.metadata, user_id, department, scenario, role, team, agent_id, scenario_id
    )
    context = recorder.start(request, metadata)

    try:
        upstream = await client.send(
            request.provider_payload(),
            inbound_authorization=authorization,
            stream=request.stream,
        )
    except asyncio.CancelledError:
        await _finalize_cancelled(recorder, context)
        raise
    # The proxy boundary must turn every unexpected transport/configuration
    # exception into a persisted internal_proxy_error event.
    except Exception as exc:  # noqa: BLE001
        error_type = classify_exception(exc)
        status_code = 504 if error_type == "timeout" else 502
        if error_type == "internal_proxy_error":
            status_code = 500
        await recorder.finalize(
            context,
            status="error",
            http_status=status_code,
            error_type=error_type,
            error_message=safe_error_message(error_type),
        )
        return _proxy_error(status_code, error_type, str(context.request_id))

    if upstream.status_code >= 400:
        content = await upstream.aread()
        try:
            payload = upstream.json()
        except ValueError:
            payload = None
        error_type = classify_http_error(upstream.status_code, payload)
        await recorder.finalize(
            context,
            status="error",
            http_status=upstream.status_code,
            error_type=error_type,
            error_message=safe_error_message(error_type, upstream.status_code),
        )
        headers = _provider_headers(upstream, str(context.request_id))
        media_type = upstream.headers.get("content-type")
        await upstream.aclose()
        return Response(
            content=content,
            status_code=upstream.status_code,
            headers=headers,
            media_type=media_type,
        )

    if not request.stream:
        try:
            payload = upstream.json()
            if not isinstance(payload, dict):
                raise InvalidProviderResponse("Provider response is not a JSON object")
        except (ValueError, InvalidProviderResponse) as exc:
            error_type = classify_exception(exc)
            await recorder.finalize(
                context,
                status="error",
                http_status=502,
                error_type=error_type,
                error_message=safe_error_message(error_type),
            )
            await upstream.aclose()
            return _proxy_error(502, error_type, str(context.request_id))

        usage = extract_usage(payload)
        content_filtered = response_has_content_filter(payload)
        await recorder.finalize(
            context,
            status="error" if content_filtered else "success",
            http_status=upstream.status_code,
            usage=usage,
            error_type="content_filter" if content_filtered else None,
            error_message=(
                safe_error_message("content_filter") if content_filtered else None
            ),
        )
        content = upstream.content
        headers = _provider_headers(upstream, str(context.request_id))
        media_type = upstream.headers.get("content-type", "application/json")
        await upstream.aclose()
        return Response(
            content=content,
            status_code=upstream.status_code,
            headers=headers,
            media_type=media_type,
        )

    parser = SSEUsageParser()

    async def stream_body() -> AsyncIterator[bytes]:
        try:
            async for chunk in upstream.aiter_bytes():
                if chunk:
                    recorder.mark_first_token(context)
                    parser.feed(chunk)
                    yield chunk
            parser.finish()
            await recorder.finalize(
                context,
                status="error" if parser.content_filtered else "success",
                http_status=upstream.status_code,
                usage=parser.usage,
                error_type="content_filter" if parser.content_filtered else None,
                error_message=(
                    safe_error_message("content_filter")
                    if parser.content_filtered
                    else None
                ),
            )
        except asyncio.CancelledError:
            await _finalize_cancelled(recorder, context)
            raise
        except GeneratorExit:
            await _finalize_cancelled(recorder, context)
            raise
        except Exception as exc:
            error_type = classify_exception(exc)
            await recorder.finalize(
                context,
                status="error",
                http_status=502,
                usage=parser.usage,
                error_type=error_type,
                error_message=safe_error_message(error_type),
            )
            raise
        finally:
            await upstream.aclose()
            if not context.finalized:
                await recorder.finalize(
                    context,
                    status="error",
                    http_status=502,
                    usage=parser.usage,
                    error_type="internal_proxy_error",
                    error_message=safe_error_message("internal_proxy_error"),
                )

    return StreamingResponse(
        stream_body(),
        status_code=upstream.status_code,
        headers=_provider_headers(upstream, str(context.request_id)),
        media_type=upstream.headers.get("content-type", "text/event-stream"),
    )
