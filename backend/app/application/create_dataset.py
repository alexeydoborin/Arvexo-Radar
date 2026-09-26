"""CreateDataset + ValidateDataset use case (docs/12-backend.md section 3).

Runs validation synchronously within the request for the Hackathon MVP: file
sizes are bounded by `max_upload_bytes` and validation is a single
deterministic local pass, so no queued job is required yet. Moving this call
behind `analysis_jobs` later is a worker-wiring change only — this service
already returns the same typed result the job would persist, so callers
would not need to change.
"""

from __future__ import annotations

import asyncio
import hashlib

from app.config import Settings
from app.domain.dataset_validation import parse_and_validate
from app.domain.enums import DatasetStatus
from app.domain.errors import UploadTooLargeError
from app.infrastructure.db.models import Dataset, DatasetVersion
from app.infrastructure.storage import DatasetStorage
from app.repositories.dataset_repository import DatasetRepository

NORMALIZATION_VERSION = "norm-v1"
MASKING_VERSION = "mask-v1"


class CreateDatasetResult:
    def __init__(self, dataset: Dataset, version: DatasetVersion, reused_existing: bool) -> None:
        self.dataset = dataset
        self.version = version
        self.reused_existing = reused_existing


class CreateDataset:
    def __init__(
        self,
        repository: DatasetRepository,
        storage: DatasetStorage,
        settings: Settings,
    ) -> None:
        self._repository = repository
        self._storage = storage
        self._settings = settings

    async def execute(
        self,
        *,
        display_name: str,
        raw_bytes: bytes,
        created_by: str,
    ) -> CreateDatasetResult:
        if len(raw_bytes) > self._settings.max_upload_bytes:
            raise UploadTooLargeError(
                "Uploaded file exceeds the configured size limit.",
                details={"max_bytes": self._settings.max_upload_bytes},
            )

        tenant = await self._repository.get_or_create_demo_tenant()
        checksum = hashlib.sha256(raw_bytes).hexdigest()

        existing = await self._repository.find_dataset_by_checksum(tenant.id, checksum)
        if existing is not None:
            latest_version = await self._repository.get_latest_version(dataset_id=existing.id)
            assert latest_version is not None  # every persisted dataset has >=1 version
            return CreateDatasetResult(existing, latest_version, reused_existing=True)

        # CPU-bound pass over up to max_upload_bytes: run it off the event loop
        # so one large upload cannot stall every other API request.
        parsed = await asyncio.to_thread(
            parse_and_validate, raw_bytes, max_row_chars=self._settings.max_row_chars
        )

        status = DatasetStatus.VALIDATED
        if parsed.is_dataset_rejected:
            status = DatasetStatus.REJECTED
        elif parsed.has_conflict:
            status = DatasetStatus.CONFLICT

        dataset = await self._repository.create_dataset(
            tenant_id=tenant.id,
            display_name=display_name,
            source_filename_safe="upload.csv",
            checksum=checksum,
            created_by=created_by,
            status=status,
        )
        storage_ref = self._storage.save_raw_upload(dataset.id, raw_bytes)

        version = await self._repository.create_dataset_version(
            dataset_id=dataset.id,
            schema_mapping=parsed.schema_mapping,
            validation_summary=parsed.to_summary(),
            normalization_version=NORMALIZATION_VERSION,
            masking_version=MASKING_VERSION,
            storage_refs={"raw": storage_ref},
        )

        if not parsed.is_dataset_rejected:
            await self._repository.bulk_create_records(
                dataset_version_id=version.id,
                rows=parsed.rows,
                raw_storage_ref=storage_ref,
            )

        return CreateDatasetResult(dataset, version, reused_existing=False)
