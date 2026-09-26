"""Typed domain/application errors.

These carry a stable machine-readable code and a message that is always safe
to return to a client (docs/12-backend.md section 8, docs/15-api.md section 2).
Never put dataset text, secrets, or stack traces into `message` or `details`.
"""

from __future__ import annotations


class ArvexoError(Exception):
    code: str = "INTERNAL_ERROR"
    status: int = 500
    retryable: bool = False

    def __init__(self, message: str, *, details: dict | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or {}


class DatasetInvalidError(ArvexoError):
    code = "DATASET_INVALID"
    status = 422


class DatasetNotFoundError(ArvexoError):
    code = "DATASET_NOT_FOUND"
    status = 404


class DatasetConflictError(ArvexoError):
    code = "DATASET_CONFLICT"
    status = 409


class RunStateError(ArvexoError):
    code = "RUN_INVALID_STATE"
    status = 409


class RunNotFoundError(ArvexoError):
    code = "RUN_NOT_FOUND"
    status = 404


class ScenarioNotFoundError(ArvexoError):
    code = "SCENARIO_NOT_FOUND"
    status = 404


class ProviderUnavailableError(ArvexoError):
    code = "LLM_PROVIDER_UNAVAILABLE"
    status = 503
    retryable = True


class UploadTooLargeError(ArvexoError):
    code = "UPLOAD_TOO_LARGE"
    status = 413


class ReportGenerationError(ArvexoError):
    code = "REPORT_GENERATION_FAILED"
    status = 500


class ReportNotFoundError(ArvexoError):
    code = "REPORT_NOT_FOUND"
    status = 404


class ReportNotReadyError(ArvexoError):
    code = "REPORT_NOT_READY"
    status = 409


class BestPracticeNotFoundError(ArvexoError):
    code = "BEST_PRACTICE_NOT_FOUND"
    status = 404


class BestPracticeStateError(ArvexoError):
    code = "BEST_PRACTICE_INVALID_STATE"
    status = 409


class AuthenticationRequiredError(ArvexoError):
    code = "AUTHENTICATION_REQUIRED"
    status = 401


class ForbiddenError(ArvexoError):
    code = "FORBIDDEN"
    status = 403


class RateLimitedError(ArvexoError):
    code = "RATE_LIMITED"
    status = 429
    retryable = True


class StorageUnavailableError(ArvexoError):
    code = "STORAGE_UNAVAILABLE"
    status = 507
    retryable = True
