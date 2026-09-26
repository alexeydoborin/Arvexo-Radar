from functools import lru_cache
from typing import Literal, Self

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration loaded from environment variables.

    Only required settings for the currently selected provider/auth mode are
    validated at startup; see docs/12-backend.md section 9.
    """

    model_config = SettingsConfigDict(env_file=".env", env_prefix="ARVEXO_", extra="ignore")

    environment: Literal["demo", "api", "production"] = "demo"
    # "demo": Arvexo Account session required (the only mode allowed in
    # production). "none": no authentication, local development/tests only.
    auth_mode: Literal["demo", "none"] = "demo"
    # Arvexo Account emails allowed to change shared demo data (methodology,
    # cost components, demo best practices) and to see org-wide LLM proxy
    # telemetry. JSON list, e.g. ARVEXO_ADMIN_EMAILS=["owner@arvexo.ru"].
    admin_emails: list[str] = []
    # Shared with the web app (ARVEXO_RADAR_SESSION_SECRET); verifies the signed
    # session cookie. Unset only in local development and tests.
    radar_session_secret: SecretStr | None = None

    database_url: str = "postgresql+asyncpg://arvexo:arvexo@localhost:5432/arvexo_radar"

    storage_path: str = "/data/storage"

    # 100MB / 2M chars per row: the case's own reference dataset generator
    # (data/sample_datasets/generate_sample_dataset.py) produces RAG-augmented
    # rows well above the "~100k tokens average" headline figure — some rows
    # exceed 1.3M chars — so the limits must clear that, not just the average.
    max_upload_bytes: int = 100_000_000
    max_row_chars: int = 2_000_000

    llm_provider_mode: Literal["mock", "bothub", "local"] = "mock"
    bothub_api_key: SecretStr | None = None
    bothub_base_url: str = "https://openai.bothub.chat/v1"
    bothub_model: str = "gemini-2.5-flash"
    # Balanced production profile: enough context/output for meaningful AI
    # wording while keeping every request explicitly bounded.
    llm_timeout_seconds: float = Field(default=60.0, gt=0, le=300)
    llm_max_retries: int = Field(default=1, ge=0, le=5)
    llm_max_output_tokens: int = Field(default=1024, ge=128, le=8192)
    llm_max_samples: int = Field(default=5, ge=1, le=10)
    llm_max_sample_chars: int = Field(default=800, ge=100, le=4000)
    llm_max_recommendations: int = Field(default=6, ge=1, le=20)

    # OpenAI-compatible proxy settings. The base URL should include the API
    # version prefix, for example https://api.openai.com/v1.
    llm_proxy_base_url: str | None = None
    llm_proxy_api_key: str | None = None
    # Bearer token agents must present whenever the proxy substitutes the
    # server's own key (llm_proxy_api_key). Unset means such requests are
    # rejected, so the proxy is never an open relay for the corporate key.
    llm_proxy_client_token: SecretStr | None = None
    llm_proxy_timeout_seconds: float = 60.0
    analytics_user_hash_salt: str = "demo-only-change-this-analytics-salt"
    analytics_currency: str = Field(
        default="RUB", min_length=3, max_length=3, pattern=r"^[A-Z]{3}$"
    )

    # Abuse limits per account (tenant). Uploads and runs cost disk and LLM
    # money, so they are bounded independently of the generic write limit.
    rate_limit_per_minute: int = Field(default=60, ge=1)
    upload_limit_per_hour: int = Field(default=20, ge=1)
    run_limit_per_day: int = Field(default=20, ge=1)
    report_limit_per_hour: int = Field(default=30, ge=1)
    tenant_storage_quota_bytes: int = Field(default=1_000_000_000, ge=0)
    # Uploads are refused while the storage volume has less free space than
    # this, so one tenant cannot fill a disk shared with Postgres/other apps.
    min_free_disk_bytes: int = Field(default=2_000_000_000, ge=0)
    max_concurrent_uploads: int = Field(default=2, ge=1)

    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    log_level: str = "INFO"

    # DejaVu Sans covers Cyrillic (unlike the PDF base-14 fonts) and ships via
    # the `fonts-dejavu-core` apt package installed in the api/worker Docker
    # images (see backend/Dockerfile). Override for other environments.
    report_font_regular_path: str = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    report_font_bold_path: str = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

    @model_validator(mode="after")
    def validate_runtime_settings(self) -> Self:
        if self.llm_provider_mode == "bothub" and (
            self.bothub_api_key is None or not self.bothub_api_key.get_secret_value().strip()
        ):
            raise ValueError(
                "ARVEXO_BOTHUB_API_KEY must be set when ARVEXO_LLM_PROVIDER_MODE=bothub"
            )
        if self.environment == "production" and (
            len(self.analytics_user_hash_salt) < 16
            or self.analytics_user_hash_salt == "demo-only-change-this-analytics-salt"
        ):
            raise ValueError("ARVEXO_ANALYTICS_USER_HASH_SALT must be set in production")
        if self.environment == "production" and self.auth_mode == "none":
            raise ValueError("ARVEXO_AUTH_MODE=none is not allowed in production")
        if self.environment == "production" and (
            self.radar_session_secret is None
            or len(self.radar_session_secret.get_secret_value()) < 32
            or self.radar_session_secret.get_secret_value().startswith("replace-with")
        ):
            raise ValueError("ARVEXO_RADAR_SESSION_SECRET must be set in production")
        return self

    @property
    def admin_email_set(self) -> frozenset[str]:
        return frozenset(email.strip().casefold() for email in self.admin_emails if email.strip())


@lru_cache
def get_settings() -> Settings:
    return Settings()
