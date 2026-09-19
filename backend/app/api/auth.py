"""Session check for the Radar API.

The web app signs a session cookie after Arvexo Account sign-in
(``frontend/lib/arvexo-auth.ts``): ``base64url(payload).base64url(HMAC-SHA256)``
with the shared ``ARVEXO_RADAR_SESSION_SECRET``. The API verifies the same
cookie so that datasets, analytics and best practices are reachable only by
registered users, not just through the ``/app`` page.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import json
import time

from fastapi import Depends, Request

from app.config import Settings, get_settings
from app.domain.errors import AuthenticationRequiredError

SESSION_COOKIE = "arvexo_radar_session"


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


async def require_session(
    request: Request, settings: Settings = Depends(get_settings)
) -> dict | None:
    """Reject requests without a valid Arvexo Radar session.

    When no session secret is configured (local development and tests) the
    check is skipped; ``Settings`` refuses to start in production without one.
    """
    if settings.radar_session_secret is None:
        return None
    session = verify_session(
        request.cookies.get(SESSION_COOKIE), settings.radar_session_secret.get_secret_value()
    )
    if session is None:
        raise AuthenticationRequiredError("Sign in with Arvexo Account to use Radar.")
    return session
