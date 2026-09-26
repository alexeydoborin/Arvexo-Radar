from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.exc import SQLAlchemyError

from app.api.auth import Principal, require_principal
from app.api.deps import get_analytics_repository, get_enterprise_analytics_service
from app.repositories.analytics_repository import AnalyticsFilters, AnalyticsRepository
from app.schemas.analytics import ModelAnalytics, OverviewResponse
from app.services.enterprise_analytics import EnterpriseAnalyticsService, EnterpriseFilters

router = APIRouter(tags=["Enterprise analytics"])


def _as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def get_analytics_filters(
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
    department: str | None = Query(default=None, max_length=255),
    role: str | None = Query(default=None, max_length=150),
    user: str | None = Query(default=None, max_length=255),
    agent: str | None = Query(default=None, max_length=255),
    model: str | None = Query(default=None, max_length=255),
    scenario: str | None = Query(default=None, max_length=255),
    tool: str | None = Query(default=None, max_length=255),
) -> EnterpriseFilters:
    normalized_from = _as_utc(date_from)
    normalized_to = _as_utc(date_to)
    if normalized_from and normalized_to and normalized_to <= normalized_from:
        raise HTTPException(status_code=422, detail="date_to must be later than date_from")
    return EnterpriseFilters(
        date_from=normalized_from,
        date_to=normalized_to,
        department=department,
        role=role,
        user=user,
        agent=agent,
        model=model,
        scenario=scenario,
        tool=tool,
    )


def get_org_telemetry(
    principal: Principal = Depends(require_principal),
    repository: AnalyticsRepository = Depends(get_analytics_repository),
) -> AnalyticsRepository | None:
    """LLM proxy telemetry is organisation-wide (not per account), so only
    Radar administrators see it; everyone else gets the demo story."""
    return repository if principal.is_admin else None


def _legacy_filters(filters: EnterpriseFilters) -> AnalyticsFilters:
    return AnalyticsFilters(
        date_from=filters.date_from,
        date_to=filters.date_to,
        model=filters.model,
        department=filters.department,
        scenario=filters.scenario,
        role=filters.role,
        user=filters.user,
        agent=filters.agent,
        tool=filters.tool,
    )


@router.get("/overview")
async def overview(
    filters: EnterpriseFilters = Depends(get_analytics_filters),
    service: EnterpriseAnalyticsService = Depends(get_enterprise_analytics_service),
    repository: AnalyticsRepository | None = Depends(get_org_telemetry),
) -> dict[str, Any]:
    payload = service.overview(filters)
    # Keep the v0.1 technical fields at the top level for backward-compatible
    # clients. In demo/offline mode the coherent demo story is the fallback.
    technical: dict[str, Any] = {}
    try:
        if repository is not None:
            technical = OverviewResponse.model_validate(
                await repository.overview(_legacy_filters(filters))
            ).model_dump(mode="json")
    # Database access is optional in demo mode. Connection failures can surface
    # as either SQLAlchemy errors or OS-level socket errors.
    except (SQLAlchemyError, OSError):
        technical = {}
    requests = int(payload["usage_and_cost"][1]["value"])
    agents = payload["top_agents"]
    successful = sum(int(row["successful_requests"]) for row in agents)
    failed = sum(int(row["failed_requests"]) for row in agents)
    if not technical.get("total_requests"):
        total_tokens = sum(int(row["total_tokens"]) for row in agents)
        technical = {
            "total_requests": requests,
            "successful_requests": successful,
            "failed_requests": failed,
            "success_rate": successful / requests * 100 if requests else 0,
            "error_rate": failed / requests * 100 if requests else 0,
            "avg_latency_ms": (
                sum(float(row["latency_ms"]) * int(row["requests"]) for row in agents)
                / requests
                if requests
                else 0
            ),
            "median_latency_ms": 2010 if requests else 0,
            "p95_latency_ms": 4380 if requests else 0,
            "avg_time_to_first_token_ms": 610 if requests else 0,
            "prompt_tokens": sum(int(row["prompt_tokens"]) for row in agents),
            "completion_tokens": sum(int(row["completion_tokens"]) for row in agents),
            "total_tokens": total_tokens,
            "avg_tokens_per_request": total_tokens / requests if requests else 0,
            "total_cost": payload["usage_and_cost"][3]["value"],
            "avg_cost_per_request": payload["usage_and_cost"][3]["value"] / requests if requests else 0,
            "unique_users": payload["usage_and_cost"][0]["value"],
            "requests_by_model": [],
            "errors_by_type": [
                {"error_type": "tool_error", "count": 594},
                {"error_type": "provider_error", "count": 386},
            ],
            "requests_by_day": payload["requests_by_day"],
        }
    return {**technical, **payload}


@router.get("/usage")
async def usage(
    filters: EnterpriseFilters = Depends(get_analytics_filters),
    service: EnterpriseAnalyticsService = Depends(get_enterprise_analytics_service),
    repository: AnalyticsRepository | None = Depends(get_org_telemetry),
) -> dict[str, Any]:
    payload = service.usage(filters)
    summary = payload["summary"]
    try:
        live = (
            await repository.usage(_legacy_filters(filters), filters.date_to or datetime.now(UTC))
            if repository is not None
            else {}
        )
        if live.get("mau"):
            summary = {**summary, **live}
    except SQLAlchemyError:
        pass
    return {**summary, **payload, "summary": summary}


@router.get("/models")
async def models(
    filters: EnterpriseFilters = Depends(get_analytics_filters),
    service: EnterpriseAnalyticsService = Depends(get_enterprise_analytics_service),
    repository: AnalyticsRepository | None = Depends(get_org_telemetry),
) -> list[dict[str, Any]]:
    try:
        live = await repository.models(_legacy_filters(filters)) if repository is not None else []
        if live:
            return [
                ModelAnalytics.model_validate(row).model_dump(mode="json") for row in live
            ]
    except SQLAlchemyError:
        pass
    return service.models(filters)["items"]


@router.get("/errors")
async def errors(
    filters: EnterpriseFilters = Depends(get_analytics_filters),
    repository: AnalyticsRepository | None = Depends(get_org_telemetry),
) -> list[dict[str, Any]]:
    try:
        if repository is None:
            raise LookupError("organisation telemetry is admin-only")
        return await repository.errors(_legacy_filters(filters))
    except (SQLAlchemyError, LookupError):
        return [
            {"error_type": "tool_error", "count": 594, "share": 60.6, "affected_models": ["Corporate LLM 70B"], "affected_scenarios": ["crm-followup"]},
            {"error_type": "provider_error", "count": 386, "share": 39.4, "affected_models": ["GigaChat Pro", "YandexGPT 5 Pro"], "affected_scenarios": ["contract-review", "management-report"]},
        ]


@router.get("/agents")
async def agents(filters: EnterpriseFilters = Depends(get_analytics_filters), service: EnterpriseAnalyticsService = Depends(get_enterprise_analytics_service)) -> dict[str, Any]:
    return service.agents(filters)


@router.get("/tools")
async def tools(filters: EnterpriseFilters = Depends(get_analytics_filters), service: EnterpriseAnalyticsService = Depends(get_enterprise_analytics_service)) -> dict[str, Any]:
    return service.tools(filters)


@router.get("/departments")
async def departments(filters: EnterpriseFilters = Depends(get_analytics_filters), service: EnterpriseAnalyticsService = Depends(get_enterprise_analytics_service)) -> dict[str, Any]:
    return service.departments(filters)


@router.get("/costs")
async def costs(filters: EnterpriseFilters = Depends(get_analytics_filters), service: EnterpriseAnalyticsService = Depends(get_enterprise_analytics_service)) -> dict[str, Any]:
    return service.costs(filters)


@router.get("/business-effect")
async def business_effect(filters: EnterpriseFilters = Depends(get_analytics_filters), service: EnterpriseAnalyticsService = Depends(get_enterprise_analytics_service)) -> dict[str, Any]:
    return service.business_effect(filters)


@router.get("/roi")
async def roi(filters: EnterpriseFilters = Depends(get_analytics_filters), service: EnterpriseAnalyticsService = Depends(get_enterprise_analytics_service)) -> dict[str, Any]:
    return service.roi(filters)


@router.get("/insights")
async def insights(filters: EnterpriseFilters = Depends(get_analytics_filters), service: EnterpriseAnalyticsService = Depends(get_enterprise_analytics_service)) -> dict[str, Any]:
    return service.insights(filters)
