from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import Principal, require_principal
from app.api.deps import (
    get_analysis_repository,
    get_create_analysis_run_use_case,
    get_dataset_repository,
    get_run_queries,
    get_tenant_quotas,
)
from app.application.create_analysis_run import CreateAnalysisRun
from app.application.run_queries import RunQueries
from app.domain.errors import RunNotFoundError, ScenarioNotFoundError
from app.infrastructure.db.session import get_session
from app.repositories.analysis_repository import AnalysisRepository
from app.repositories.dataset_repository import DatasetRepository
from app.schemas.run import (
    CategoryDetailResponse,
    CreateRunRequest,
    Degradation,
    FindingsResponse,
    InsightsResponse,
    OverviewResponse,
    RunResponse,
    ScenarioDetailResponse,
)
from app.services.quotas import TenantQuotas

router = APIRouter(tags=["runs"])


async def _get_run_or_404(run_id: uuid.UUID, repo: AnalysisRepository, principal: Principal):
    run = await repo.get_run(tenant_id=principal.tenant_id, run_id=run_id)
    if run is None:
        raise RunNotFoundError("Run not found.", details={})
    return run


async def _dataset_id_for_run(run, dataset_repo: DatasetRepository) -> uuid.UUID:
    version = await dataset_repo.get_version(run.dataset_version_id)
    return version.dataset_id


async def _total_records_for_run(run, dataset_repo: DatasetRepository) -> int:
    version = await dataset_repo.get_version(run.dataset_version_id)
    summary = version.validation_summary
    return summary.get("accepted", 0) + summary.get("accepted_with_warnings", 0)


def _to_run_response(run, dataset_id: uuid.UUID) -> RunResponse:
    return RunResponse(
        run_id=run.id,
        dataset_id=dataset_id,
        status=run.status,
        stage=run.stage,
        degradations=[Degradation(**d) for d in run.degradations],
        provenance=run.model_provenance,
    )


@router.post("/datasets/{dataset_id}/runs", status_code=202, response_model=RunResponse)
async def create_run(
    dataset_id: uuid.UUID,
    body: CreateRunRequest,
    use_case: CreateAnalysisRun = Depends(get_create_analysis_run_use_case),
    session: AsyncSession = Depends(get_session),
    principal: Principal = Depends(require_principal),
    quotas: TenantQuotas = Depends(get_tenant_quotas),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> RunResponse:
    await quotas.check_run(principal.tenant_id)
    result = await use_case.execute(
        tenant_id=principal.tenant_id,
        dataset_id=dataset_id,
        provider_mode=body.provider_mode,
        locale=body.locale,
        created_by=principal.user_id,
        idempotency_key=idempotency_key,
    )
    await session.commit()
    return _to_run_response(result.run, dataset_id)


@router.get("/runs/{run_id}", response_model=RunResponse)
async def get_run(
    run_id: uuid.UUID,
    repo: AnalysisRepository = Depends(get_analysis_repository),
    principal: Principal = Depends(require_principal),
    dataset_repo: DatasetRepository = Depends(get_dataset_repository),
) -> RunResponse:
    run = await _get_run_or_404(run_id, repo, principal)
    dataset_id = await _dataset_id_for_run(run, dataset_repo)
    return _to_run_response(run, dataset_id)


@router.get("/runs/{run_id}/overview", response_model=OverviewResponse)
async def get_overview(
    run_id: uuid.UUID,
    repo: AnalysisRepository = Depends(get_analysis_repository),
    principal: Principal = Depends(require_principal),
    dataset_repo: DatasetRepository = Depends(get_dataset_repository),
    queries: RunQueries = Depends(get_run_queries),
) -> OverviewResponse:
    run = await _get_run_or_404(run_id, repo, principal)
    dataset_id = await _dataset_id_for_run(run, dataset_repo)
    total_records = await _total_records_for_run(run, dataset_repo)
    data = await queries.overview(run, dataset_id=dataset_id, total_records=total_records)
    return OverviewResponse(**data)


@router.get("/runs/{run_id}/categories")
async def get_categories(
    run_id: uuid.UUID,
    repo: AnalysisRepository = Depends(get_analysis_repository),
    principal: Principal = Depends(require_principal),
    queries: RunQueries = Depends(get_run_queries),
) -> list[dict]:
    await _get_run_or_404(run_id, repo, principal)
    return await queries.category_summaries(run_id)


@router.get("/runs/{run_id}/categories/{category_id}", response_model=CategoryDetailResponse)
async def get_category_detail(
    run_id: uuid.UUID,
    category_id: str,
    repo: AnalysisRepository = Depends(get_analysis_repository),
    principal: Principal = Depends(require_principal),
    queries: RunQueries = Depends(get_run_queries),
) -> CategoryDetailResponse:
    run = await _get_run_or_404(run_id, repo, principal)
    data = await queries.category_detail(run, category_id)
    return CategoryDetailResponse(**data)


@router.get("/runs/{run_id}/scenarios")
async def get_scenarios(
    run_id: uuid.UUID,
    repo: AnalysisRepository = Depends(get_analysis_repository),
    principal: Principal = Depends(require_principal),
    queries: RunQueries = Depends(get_run_queries),
) -> list[dict]:
    await _get_run_or_404(run_id, repo, principal)
    return await queries.scenario_summaries(run_id)


@router.get("/runs/{run_id}/scenarios/{scenario_id}", response_model=ScenarioDetailResponse)
async def get_scenario_detail(
    run_id: uuid.UUID,
    scenario_id: uuid.UUID,
    repo: AnalysisRepository = Depends(get_analysis_repository),
    principal: Principal = Depends(require_principal),
    queries: RunQueries = Depends(get_run_queries),
) -> ScenarioDetailResponse:
    run = await _get_run_or_404(run_id, repo, principal)
    data = await queries.scenario_detail(run, scenario_id)
    if data is None:
        raise ScenarioNotFoundError("Scenario not found.", details={})
    return ScenarioDetailResponse(**data)


@router.get("/runs/{run_id}/insights", response_model=InsightsResponse)
async def get_insights(
    run_id: uuid.UUID,
    repo: AnalysisRepository = Depends(get_analysis_repository),
    principal: Principal = Depends(require_principal),
    queries: RunQueries = Depends(get_run_queries),
) -> InsightsResponse:
    await _get_run_or_404(run_id, repo, principal)
    insights, recommendations = await queries.insights_and_recommendations(run_id)
    return InsightsResponse(insights=insights, recommendations=recommendations)


@router.get("/runs/{run_id}/prompt-health", response_model=FindingsResponse)
async def get_prompt_health(
    run_id: uuid.UUID,
    repo: AnalysisRepository = Depends(get_analysis_repository),
    principal: Principal = Depends(require_principal),
    queries: RunQueries = Depends(get_run_queries),
) -> FindingsResponse:
    await _get_run_or_404(run_id, repo, principal)
    findings = await queries.finding_summaries(run_id, finding_type="prompt_health")
    return FindingsResponse(findings=findings)


@router.get("/runs/{run_id}/security-findings", response_model=FindingsResponse)
async def get_security_findings(
    run_id: uuid.UUID,
    repo: AnalysisRepository = Depends(get_analysis_repository),
    principal: Principal = Depends(require_principal),
    queries: RunQueries = Depends(get_run_queries),
) -> FindingsResponse:
    await _get_run_or_404(run_id, repo, principal)
    findings = await queries.finding_summaries(run_id, finding_type="security")
    return FindingsResponse(findings=findings)
