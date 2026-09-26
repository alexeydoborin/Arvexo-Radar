from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Header
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import Principal, require_principal
from app.api.deps import (
    get_analysis_repository,
    get_generate_report_use_case,
    get_report_storage,
    get_tenant_quotas,
)
from app.application.generate_report import GenerateReport
from app.domain.errors import ReportNotFoundError, ReportNotReadyError
from app.infrastructure.db.session import get_session
from app.infrastructure.storage import ReportStorage
from app.repositories.analysis_repository import AnalysisRepository
from app.schemas.report import ReportResponse
from app.services.quotas import TenantQuotas

router = APIRouter(tags=["reports"])


def _to_report_response(report) -> ReportResponse:
    return ReportResponse(
        report_id=report.id,
        run_id=report.run_id,
        status=report.status,
        format=report.format,
        checksum=report.checksum,
        generated_at=report.generated_at,
        safe_error=report.safe_error,
    )


@router.post("/runs/{run_id}/reports", status_code=202, response_model=ReportResponse)
async def create_report(
    run_id: uuid.UUID,
    use_case: GenerateReport = Depends(get_generate_report_use_case),
    session: AsyncSession = Depends(get_session),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    principal: Principal = Depends(require_principal),
    quotas: TenantQuotas = Depends(get_tenant_quotas),
) -> ReportResponse:
    await quotas.check_report(principal.tenant_id)
    report = await use_case.execute(
        tenant_id=principal.tenant_id, run_id=run_id, idempotency_key=idempotency_key
    )
    await session.commit()
    return _to_report_response(report)


async def _get_report_for_tenant(
    report_id: uuid.UUID, repo: AnalysisRepository, principal: Principal
):
    report = await repo.get_report(report_id)
    if report is None:
        raise ReportNotFoundError("Report not found.", details={})
    run = await repo.get_run(tenant_id=principal.tenant_id, run_id=report.run_id)
    if run is None:
        # Report exists but its run does not belong to this tenant: treat the
        # same as not-found rather than confirming the report id is valid.
        raise ReportNotFoundError("Report not found.", details={})
    return report


@router.get("/reports/{report_id}", response_model=ReportResponse)
async def get_report(
    report_id: uuid.UUID,
    repo: AnalysisRepository = Depends(get_analysis_repository),
    principal: Principal = Depends(require_principal),
) -> ReportResponse:
    report = await _get_report_for_tenant(report_id, repo, principal)
    return _to_report_response(report)


@router.get("/reports/{report_id}/download")
async def download_report(
    report_id: uuid.UUID,
    repo: AnalysisRepository = Depends(get_analysis_repository),
    storage: ReportStorage = Depends(get_report_storage),
    principal: Principal = Depends(require_principal),
) -> Response:
    report = await _get_report_for_tenant(report_id, repo, principal)
    if report.status != "generated" or not report.storage_ref:
        raise ReportNotReadyError("Report is not ready for download.", details={"status": report.status})

    pdf_bytes = storage.read_pdf(report.storage_ref)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="report-{report.id}.pdf"'},
    )
