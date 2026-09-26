from __future__ import annotations

import uuid
from collections import defaultdict
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.auth import Principal, require_principal
from app.api.deps import get_best_practice_repository, get_enterprise_analytics_service
from app.config import Settings, get_settings
from app.domain.enums import BestPracticeStatus, PracticeAdoptionStatus
from app.domain.errors import BestPracticeNotFoundError, BestPracticeStateError, ForbiddenError
from app.repositories.best_practice_repository import BestPracticeRepository
from app.schemas.best_practice import (
    BestPracticeListResponse,
    BestPracticeResponse,
    BestPracticeTopResponse,
)
from app.schemas.enterprise import (
    PracticeActionRequest,
    PracticeAdoptionInput,
    PracticeRecommendRequest,
)
from app.services.enterprise_analytics import EnterpriseAnalyticsService

router = APIRouter(prefix="/best-practices", tags=["best-practices"])


def _response(practice: Any) -> BestPracticeResponse:
    return BestPracticeResponse.model_validate(practice)


async def _db_practice(
    practice_id: str, repository: BestPracticeRepository, principal: Principal
):
    try:
        parsed_id = uuid.UUID(practice_id)
    except ValueError as exc:
        raise BestPracticeNotFoundError("Best practice not found.", details={}) from exc
    practice = await repository.get(tenant_id=principal.tenant_id, practice_id=parsed_id)
    if practice is None:
        raise BestPracticeNotFoundError("Best practice not found.", details={})
    return practice


def _require_admin_for_demo(is_demo: bool, principal: Principal) -> None:
    # The built-in demo catalog is shared by every account: read-only for
    # users, changeable by Radar administrators only.
    if is_demo and not principal.is_admin:
        raise ForbiddenError("Demo best practices are read-only.")


def _demo_practice(practice_id: str, service: EnterpriseAnalyticsService) -> dict[str, Any]:
    practice = service.practice(practice_id)
    if practice is None:
        raise HTTPException(status_code=404, detail="Best practice not found")
    return practice


async def _resolve_practice(
    practice_id: str,
    repository: BestPracticeRepository,
    service: EnterpriseAnalyticsService,
    settings: Settings,
    principal: Principal,
) -> tuple[Any, bool]:
    """Resolve a practice id to (practice, is_demo_source).

    Prefers a real DB row so genuinely detected practices always win; falls
    back to the built-in demo catalog when the id isn't a DB row (e.g. a
    production deployment with no seeded/detected practices yet, viewed via
    the UI's "demo" mode) — same fallback as list/top below.
    """
    if settings.environment != "demo":
        try:
            return await _db_practice(practice_id, repository, principal), False
        except BestPracticeNotFoundError:
            pass
    return _demo_practice(practice_id, service), True


@router.get("", response_model=BestPracticeListResponse)
async def list_best_practices(
    status: BestPracticeStatus | None = None,
    department: str | None = None,
    model: str | None = None,
    min_impact_score: float | None = Query(default=None, ge=0, le=100),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    repository: BestPracticeRepository = Depends(get_best_practice_repository),
    service: EnterpriseAnalyticsService = Depends(get_enterprise_analytics_service),
    settings: Settings = Depends(get_settings),
    principal: Principal = Depends(require_principal),
) -> BestPracticeListResponse:
    if settings.environment != "demo":
        items, total = await repository.list(
            tenant_id=principal.tenant_id,
            status=status,
            department=department,
            model=model,
            min_impact_score=min_impact_score,
            offset=offset,
            limit=limit,
        )
        if total > 0:
            return BestPracticeListResponse(
                items=[_response(item) for item in items], total=total, offset=offset, limit=limit
            )
        # No practice has been detected/seeded in this tenant's DB yet —
        # fall back to the built-in demo catalog rather than a silent empty
        # state, since "demo" mode in the UI is explicitly asking to see
        # what Radar looks like with data, not a bare install.

    rows = service.practices()
    if status:
        rows = [row for row in rows if row["status"] == status.value]
    if department:
        rows = [row for row in rows if row["department_origin"] == department]
    if model:
        rows = [row for row in rows if model in row.get("models", [])]
    if min_impact_score is not None:
        rows = [row for row in rows if float(row["impact_score"]) >= min_impact_score]
    total = len(rows)
    rows = rows[offset : offset + limit]
    return BestPracticeListResponse(
        items=[_response(row) for row in rows], total=total, offset=offset, limit=limit
    )


@router.get("/top", response_model=BestPracticeTopResponse)
async def top_best_practices(
    limit: int = Query(default=5, ge=1, le=20),
    repository: BestPracticeRepository = Depends(get_best_practice_repository),
    service: EnterpriseAnalyticsService = Depends(get_enterprise_analytics_service),
    settings: Settings = Depends(get_settings),
    principal: Principal = Depends(require_principal),
) -> BestPracticeTopResponse:
    practices: list[Any] = []
    if settings.environment != "demo":
        practices, _ = await repository.list(tenant_id=principal.tenant_id, limit=200)
    if not practices:
        practices = service.practices()
    practices = [item for item in practices if str(item.get("status") if isinstance(item, dict) else item.status) not in {"rejected", "archived"}]
    get = lambda item, key: item.get(key) if isinstance(item, dict) else getattr(item, key)
    new_items = sorted(practices, key=lambda item: get(item, "detected_at"), reverse=True)[:limit]
    fast_growing = sorted(practices, key=lambda item: get(item, "growth_rate") or 0, reverse=True)[:limit]
    most_effective = sorted(practices, key=lambda item: get(item, "impact_score"), reverse=True)[:limit]
    departments: dict[str, list[Any]] = defaultdict(list)
    models: dict[str, list[Any]] = defaultdict(list)
    for practice in practices:
        practice_departments = get(practice, "departments") or [get(practice, "department_origin") or get(practice, "department")]
        for department_name in practice_departments:
            departments[department_name].append(practice)
        for model_name in get(practice, "models") or ["Не определена"]:
            models[model_name].append(practice)
    return BestPracticeTopResponse(
        new=[_response(item) for item in new_items],
        fast_growing=[_response(item) for item in fast_growing],
        most_effective=[_response(item) for item in most_effective],
        by_department={key: [_response(item) for item in values[:limit]] for key, values in sorted(departments.items())},
        by_model={key: [_response(item) for item in values[:limit]] for key, values in sorted(models.items())},
    )


@router.get("/{practice_id}", response_model=BestPracticeResponse)
async def get_best_practice(
    practice_id: str,
    repository: BestPracticeRepository = Depends(get_best_practice_repository),
    service: EnterpriseAnalyticsService = Depends(get_enterprise_analytics_service),
    settings: Settings = Depends(get_settings),
    principal: Principal = Depends(require_principal),
) -> BestPracticeResponse:
    practice, _ = await _resolve_practice(practice_id, repository, service, settings, principal)
    return _response(practice)


async def _transition(
    practice_id: str,
    action: str,
    request: PracticeActionRequest,
    repository: BestPracticeRepository,
    service: EnterpriseAnalyticsService,
    settings: Settings,
    principal: Principal,
) -> BestPracticeResponse:
    practice, is_demo = await _resolve_practice(
        practice_id, repository, service, settings, principal
    )
    _require_admin_for_demo(is_demo, principal)
    # The audit trail records the signed-in account, never a client-supplied name.
    actor = principal.email
    if is_demo:
        current_status = practice["status"]
        allowed = {
            "review": {"detected", "under_review"},
            "approve": {"detected", "under_review", "approved"},
            "reject": {"detected", "under_review", "rejected"},
            "publish": {"approved", "published"},
        }[action]
        if current_status not in allowed:
            raise HTTPException(status_code=409, detail=f"Cannot {action} practice in {current_status} status")
        return _response(service.transition_practice(practice_id, action, actor))
    current = BestPracticeStatus(practice.status)
    allowed_db = {
        "review": {BestPracticeStatus.DETECTED, BestPracticeStatus.UNDER_REVIEW},
        "approve": {BestPracticeStatus.DETECTED, BestPracticeStatus.UNDER_REVIEW, BestPracticeStatus.APPROVED},
        "reject": {BestPracticeStatus.DETECTED, BestPracticeStatus.UNDER_REVIEW, BestPracticeStatus.REJECTED},
        "publish": {BestPracticeStatus.APPROVED, BestPracticeStatus.PUBLISHED},
    }[action]
    if current not in allowed_db:
        raise BestPracticeStateError(f"Cannot {action} practice in {current.value} status.", details={})
    if action == "publish":
        await repository.publish(practice)
    else:
        target = {"review": BestPracticeStatus.UNDER_REVIEW, "approve": BestPracticeStatus.APPROVED, "reject": BestPracticeStatus.REJECTED}[action]
        await repository.set_status(practice, target, actor=actor)
    await repository.commit()
    return _response(practice)


@router.post("/{practice_id}/review", response_model=BestPracticeResponse)
async def review_best_practice(practice_id: str, request: PracticeActionRequest, repository: BestPracticeRepository = Depends(get_best_practice_repository), service: EnterpriseAnalyticsService = Depends(get_enterprise_analytics_service), settings: Settings = Depends(get_settings), principal: Principal = Depends(require_principal)) -> BestPracticeResponse:
    return await _transition(practice_id, "review", request, repository, service, settings, principal)


@router.post("/{practice_id}/approve", response_model=BestPracticeResponse)
async def approve_best_practice(practice_id: str, request: PracticeActionRequest = PracticeActionRequest(), repository: BestPracticeRepository = Depends(get_best_practice_repository), service: EnterpriseAnalyticsService = Depends(get_enterprise_analytics_service), settings: Settings = Depends(get_settings), principal: Principal = Depends(require_principal)) -> BestPracticeResponse:
    return await _transition(practice_id, "approve", request, repository, service, settings, principal)


@router.post("/{practice_id}/reject", response_model=BestPracticeResponse)
async def reject_best_practice(practice_id: str, request: PracticeActionRequest, repository: BestPracticeRepository = Depends(get_best_practice_repository), service: EnterpriseAnalyticsService = Depends(get_enterprise_analytics_service), settings: Settings = Depends(get_settings), principal: Principal = Depends(require_principal)) -> BestPracticeResponse:
    return await _transition(practice_id, "reject", request, repository, service, settings, principal)


@router.post("/{practice_id}/publish", response_model=BestPracticeResponse)
async def publish_best_practice(practice_id: str, request: PracticeActionRequest = PracticeActionRequest(), repository: BestPracticeRepository = Depends(get_best_practice_repository), service: EnterpriseAnalyticsService = Depends(get_enterprise_analytics_service), settings: Settings = Depends(get_settings), principal: Principal = Depends(require_principal)) -> BestPracticeResponse:
    return await _transition(practice_id, "publish", request, repository, service, settings, principal)


@router.post("/{practice_id}/recommend", response_model=BestPracticeResponse)
async def recommend_best_practice(practice_id: str, request: PracticeRecommendRequest, repository: BestPracticeRepository = Depends(get_best_practice_repository), service: EnterpriseAnalyticsService = Depends(get_enterprise_analytics_service), settings: Settings = Depends(get_settings), principal: Principal = Depends(require_principal)) -> BestPracticeResponse:
    practice, is_demo = await _resolve_practice(
        practice_id, repository, service, settings, principal
    )
    _require_admin_for_demo(is_demo, principal)
    if is_demo:
        if practice["status"] not in {"approved", "published", "scaling"}:
            raise HTTPException(status_code=409, detail="Practice must be approved before recommendation")
        return _response(service.recommend_practice(practice_id, request.departments, request.owner, request.comment))
    if practice.status not in {BestPracticeStatus.APPROVED, BestPracticeStatus.PUBLISHED, BestPracticeStatus.SCALING}:
        raise BestPracticeStateError("Practice must be approved before recommendation.", details={})
    await repository.recommend(practice, request.departments)
    for department in request.departments:
        await repository.upsert_adoption(practice_id=practice.id, target_department=department, status=PracticeAdoptionStatus.RECOMMENDED, active_users=0, usages=0, time_saved_after_adoption=0, money_saved_after_adoption=0, owner=request.owner, comment=request.comment)
    await repository.commit()
    return _response(practice)


@router.get("/{practice_id}/adoption")
async def get_practice_adoption(practice_id: str, repository: BestPracticeRepository = Depends(get_best_practice_repository), service: EnterpriseAnalyticsService = Depends(get_enterprise_analytics_service), settings: Settings = Depends(get_settings), principal: Principal = Depends(require_principal)) -> dict[str, Any]:
    if settings.environment == "demo":
        rows = service.adoptions(practice_id)
        if rows is None:
            raise HTTPException(status_code=404, detail="Best practice not found")
    else:
        practice = await _db_practice(practice_id, repository, principal)
        rows = [{column.name: getattr(item, column.name) for column in item.__table__.columns} for item in await repository.list_adoptions(practice.id)]
    return {"items": rows, "summary": {"active_users": sum(int(row["active_users"]) for row in rows), "usages": sum(int(row["usages"]) for row in rows), "time_saved_after_adoption": sum(float(row["time_saved_after_adoption"]) for row in rows), "money_saved_after_adoption": sum(float(row["money_saved_after_adoption"]) for row in rows)}}


@router.post("/{practice_id}/adoption")
async def upsert_practice_adoption(practice_id: str, request: PracticeAdoptionInput, repository: BestPracticeRepository = Depends(get_best_practice_repository), service: EnterpriseAnalyticsService = Depends(get_enterprise_analytics_service), settings: Settings = Depends(get_settings), principal: Principal = Depends(require_principal)) -> dict[str, Any]:
    if settings.environment == "demo":
        _require_admin_for_demo(True, principal)
        row = service.upsert_adoption(practice_id, request)
        if row is None:
            raise HTTPException(status_code=404, detail="Best practice not found")
        return row
    practice = await _db_practice(practice_id, repository, principal)
    row = await repository.upsert_adoption(practice_id=practice.id, target_department=request.target_department, status=PracticeAdoptionStatus(request.status), active_users=request.active_users, usages=request.usages, time_saved_after_adoption=request.time_saved_after_adoption, money_saved_after_adoption=request.money_saved_after_adoption, owner=request.owner, comment=request.comment)
    await repository.commit()
    return {column.name: getattr(row, column.name) for column in row.__table__.columns}
