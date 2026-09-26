"""Session check for the Radar API.

The web app signs a session cookie after Arvexo Account sign-in
(``frontend/lib/arvexo-auth.ts``): ``base64url(payload).base64url(HMAC-SHA256)``
with the shared ``ARVEXO_RADAR_SESSION_SECRET``. The API verifies the same
cookie so that datasets, analytics and best practices are reachable only by
registered users, not just through the ``/app`` page.

Every account works in its own tenant, derived deterministically from the
Arvexo Account user id, so one user can never read or change another user's
datasets, runs, reports or best practices.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import json
import time
import uuid
from dataclasses import dataclass

from fastapi import Depends, Request

from app.config import Settings, get_settings
from app.domain.errors import AuthenticationRequiredError, ForbiddenError
from app.repositories.dataset_repository import DEMO_TENANT_ID

SESSION_COOKIE = "arvexo_radar_session"

# Namespace for uuid5(account user id) -> tenant id. Never change it: existing
# tenants would lose access to their data.
_TENANT_NAMESPACE = uuid.UUID("6f1d3c5e-2b8a-4d7e-9c41-8a2f0e6b3d19")


@dataclass(frozen=True)
class Principal:
    user_id: str
    email: str
    tenant_id: uuid.UUID
    is_admin: bool


def tenant_id_for_account(account_user_id: str) -> uuid.UUID:
    return uuid.uuid5(_TENANT_NAMESPACE, f"arvexo-account:{account_user_id}")


# Only when ARVEXO_AUTH_MODE=none (local development and tests): the seeded
# demo tenant with full rights, so demo data and admin screens stay usable.
LOCAL_DEVELOPER = Principal(
    user_id="local-developer",
    email="local-developer@localhost",
    tenant_id=DEMO_TENANT_ID,
    is_admin=True,
)


def _b64url_decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def verify_session(value: str | None, secret: str) -> dict | None:
    """Return the session payload for a valid, unexpired cookie, else ``None``."""
    if not value:
        return None
    parts = value.split(".")
    if len(parts) != 2 or not all(parts):
        return None
    payload, supplied = parts
    expected = base64.urlsafe_b64encode(
        hmac.new(secret.encode(), payload.encode(), hashlib.sha256).digest()
    ).rstrip(b"=")
    if not hmac.compare_digest(supplied.encode(), expected):
        return None
    try:
        session = json.loads(_b64url_decode(payload))
    except (binascii.Error, ValueError, UnicodeDecodeError):
        return None
    if not isinstance(session, dict) or not session.get("id") or not session.get("email"):
        return None
    expires_at = session.get("exp")
    if not isinstance(expires_at, int | float) or expires_at <= time.time():
        return None
    return session


async def require_principal(
    request: Request, settings: Settings = Depends(get_settings)
) -> Principal:
    """Reject requests without a valid Arvexo Radar session.

    Fails closed: the check is skipped only when ARVEXO_AUTH_MODE=none is set
    explicitly (``Settings`` refuses that in production). A missing session
    secret otherwise rejects every request instead of opening the API.
    """
    if settings.auth_mode == "none":
        return LOCAL_DEVELOPER
    secret = settings.radar_session_secret
    session = (
        verify_session(request.cookies.get(SESSION_COOKIE), secret.get_secret_value())
        if secret is not None and secret.get_secret_value()
        else None
    )
    if session is None:
        raise AuthenticationRequiredError("Sign in with Arvexo Account to use Radar.")
    user_id = str(session["id"])
    email = str(session["email"])
    return Principal(
        user_id=user_id,
        email=email,
        tenant_id=tenant_id_for_account(user_id),
        is_admin=email.casefold() in settings.admin_email_set,
    )


async def require_admin(principal: Principal = Depends(require_principal)) -> Principal:
    """Shared demo data and org-wide telemetry are changed/seen by admins only."""
    if not principal.is_admin:
        raise ForbiddenError("Only Radar administrators can do this.")
    return principal
