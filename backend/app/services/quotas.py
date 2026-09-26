"""Per-account quotas for the operations that cost disk space or LLM money.

Counts come from the database (not process memory), so the limits survive
restarts and cannot be reset by crashing the API.
"""

from __future__ import annotations

import asyncio
import shutil
import uuid
from datetime import timedelta
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.domain.errors import RateLimitedError, StorageUnavailableError, UploadTooLargeError
from app.infrastructure.db.base import utcnow
from app.infrastructure.db.models import AnalysisRun, Dataset, DatasetVersion, Report


class TenantQuotas:
    def __init__(self, session: AsyncSession, settings: Settings) -> None:
        self._session = session
        self._settings = settings

    async def check_upload(self, tenant_id: uuid.UUID) -> None:
        settings = self._settings
        free = shutil.disk_usage(settings.storage_path).free
        if free < settings.min_free_disk_bytes + settings.max_upload_bytes:
            raise StorageUnavailableError("Radar storage is full. Try again later.")

        recent = await self._count_since(
            select(func.count(Dataset.id)).where(Dataset.tenant_id == tenant_id),
            Dataset.created_at,
            timedelta(hours=1),
        )
        if recent >= settings.upload_limit_per_hour:
            raise RateLimitedError(
                "Upload limit reached. Try again later.",
                details={"limit_per_hour": settings.upload_limit_per_hour},
            )

        used = await self._stored_bytes(tenant_id)
        if used + settings.max_upload_bytes > settings.tenant_storage_quota_bytes:
            raise UploadTooLargeError(
                "Your Radar storage quota is exhausted.",
                details={"quota_bytes": settings.tenant_storage_quota_bytes},
            )

    async def check_run(self, tenant_id: uuid.UUID) -> None:
        recent = await self._count_since(
            select(func.count(AnalysisRun.id)).where(AnalysisRun.tenant_id == tenant_id),
            AnalysisRun.created_at,
            timedelta(days=1),
        )
        if recent >= self._settings.run_limit_per_day:
            raise RateLimitedError(
                "Daily analysis limit reached. Try again tomorrow.",
                details={"limit_per_day": self._settings.run_limit_per_day},
            )

    async def check_report(self, tenant_id: uuid.UUID) -> None:
        recent = await self._count_since(
            select(func.count(Report.id))
            .join(AnalysisRun, AnalysisRun.id == Report.run_id)
            .where(AnalysisRun.tenant_id == tenant_id),
            Report.created_at,
            timedelta(hours=1),
        )
        if recent >= self._settings.report_limit_per_hour:
            raise RateLimitedError(
                "Report limit reached. Try again later.",
                details={"limit_per_hour": self._settings.report_limit_per_hour},
            )

    async def _count_since(self, stmt, created_at, window: timedelta) -> int:
        return int(
            (await self._session.execute(stmt.where(created_at >= utcnow() - window))).scalar_one()
        )

    async def _stored_bytes(self, tenant_id: uuid.UUID) -> int:
        refs = (
            await self._session.execute(
                select(DatasetVersion.storage_refs)
                .join(Dataset, Dataset.id == DatasetVersion.dataset_id)
                .where(Dataset.tenant_id == tenant_id)
            )
        ).scalars()
        paths = [ref.get("raw") for ref in refs if isinstance(ref, dict) and ref.get("raw")]
        return await asyncio.to_thread(_total_size, paths)


def _total_size(paths: list[str]) -> int:
    total = 0
    for path in paths:
        try:
            total += Path(path).stat().st_size
        except OSError:
            continue
    return total
