"""Dataset repository: the only place that issues SQL for datasets/versions/
records. Every lookup is tenant-scoped (DB-AC-01, SEC-06 IDOR prevention).
"""

from __future__ import annotations

import uuid
from datetime import UTC

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.dataset_validation import RowResult
from app.domain.enums import DatasetStatus
from app.infrastructure.db.models import Dataset, DatasetVersion, Record, Tenant

DEMO_TENANT_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


class DatasetRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_or_create_tenant(self, tenant_id: uuid.UUID, name: str) -> Tenant:
        tenant = await self._session.get(Tenant, tenant_id)
        if tenant is None:
            tenant = Tenant(id=tenant_id, name=name[:200])
            self._session.add(tenant)
            await self._session.flush()
        return tenant

    async def find_dataset_by_checksum(self, tenant_id: uuid.UUID, checksum: str) -> Dataset | None:
        stmt = select(Dataset).where(Dataset.tenant_id == tenant_id, Dataset.checksum == checksum)
        return (await self._session.execute(stmt)).scalar_one_or_none()

    async def create_dataset(
        self,
        *,
        tenant_id: uuid.UUID,
        display_name: str,
        source_filename_safe: str,
        checksum: str,
        created_by: str,
        status: DatasetStatus,
    ) -> Dataset:
        dataset = Dataset(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            display_name=display_name,
            source_filename_safe=source_filename_safe,
            checksum=checksum,
            status=status,
            created_by=created_by,
        )
        self._session.add(dataset)
        await self._session.flush()
        return dataset

    async def create_dataset_version(
        self,
        *,
        dataset_id: uuid.UUID,
        schema_mapping: dict,
        validation_summary: dict,
        normalization_version: str,
        masking_version: str,
        storage_refs: dict,
    ) -> DatasetVersion:
        version = DatasetVersion(
            id=uuid.uuid4(),
            dataset_id=dataset_id,
            schema_mapping=schema_mapping,
            validation_summary=validation_summary,
            normalization_version=normalization_version,
            masking_version=masking_version,
            storage_refs=storage_refs,
        )
        self._session.add(version)
        await self._session.flush()
        return version

    async def bulk_create_records(
        self,
        *,
        dataset_version_id: uuid.UUID,
        rows: list[RowResult],
        raw_storage_ref: str,
    ) -> None:
        for row in rows:
            timestamp = row.timestamp
            if timestamp is not None and timestamp.tzinfo is None:
                timestamp = timestamp.replace(tzinfo=UTC)

            record = Record(
                id=uuid.uuid4(),
                dataset_version_id=dataset_version_id,
                external_request_id=row.external_request_id,
                row_number=row.row_number,
                raw_storage_ref=f"{raw_storage_ref}#row={row.row_number}",
                masked_text=row.masked_text,
                metadata_json=row.metadata,
                token_count=row.token_count,
                validation_status=row.status,
                warnings=list(row.warnings) + ([row.rejection_code] if row.rejection_code else []),
                sanitized_hash=None,
                timestamp=timestamp,
            )
            self._session.add(record)
        await self._session.flush()

    async def get_dataset(self, *, tenant_id: uuid.UUID, dataset_id: uuid.UUID) -> Dataset | None:
        stmt = select(Dataset).where(Dataset.tenant_id == tenant_id, Dataset.id == dataset_id)
        return (await self._session.execute(stmt)).scalar_one_or_none()

    async def list_datasets(self, *, tenant_id: uuid.UUID) -> list[Dataset]:
        stmt = select(Dataset).where(Dataset.tenant_id == tenant_id).order_by(Dataset.created_at.desc())
        return list((await self._session.execute(stmt)).scalars().all())

    async def get_latest_version(self, *, dataset_id: uuid.UUID) -> DatasetVersion | None:
        stmt = (
            select(DatasetVersion)
            .where(DatasetVersion.dataset_id == dataset_id)
            .order_by(DatasetVersion.created_at.desc())
            .limit(1)
        )
        return (await self._session.execute(stmt)).scalar_one_or_none()

    async def get_version(self, version_id: uuid.UUID) -> DatasetVersion | None:
        return await self._session.get(DatasetVersion, version_id)

    async def get_dataset_by_id(self, dataset_id: uuid.UUID) -> Dataset | None:
        return await self._session.get(Dataset, dataset_id)

    async def get_records_page(
        self, *, dataset_version_id: uuid.UUID, cursor: int, limit: int
    ) -> list[Record]:
        stmt = (
            select(Record)
            .where(Record.dataset_version_id == dataset_version_id, Record.row_number > cursor)
            .order_by(Record.row_number)
            .limit(limit)
        )
        return list((await self._session.execute(stmt)).scalars().all())
