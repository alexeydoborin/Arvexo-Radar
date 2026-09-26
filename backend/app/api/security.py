"""Request-level abuse and CSRF protections for the cookie-authenticated API."""

from __future__ import annotations

import time
from collections import deque
from urllib.parse import urlsplit

from fastapi import Depends, Request

from app.api.auth import Principal, require_principal
from app.config import Settings, get_settings
from app.domain.errors import RateLimitedError

SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})


def is_trusted_origin(request: Request, allowed_origins: list[str]) -> bool:
    """CSRF check for state-changing requests.

    SameSite=Lax does not stop requests from sibling *.arvexo.ru subdomains
    (same site, different origin), so writes must come from an allowed origin
    or from the API's own host. Browsers always send Origin (or at least
    Referer) on cross-origin POST/PUT/DELETE; a request with neither comes
    from a non-browser client, which cannot ride a victim's cookies.
    """
    origin = request.headers.get("origin")
    if origin is None:
        referer = request.headers.get("referer")
        if referer is None:
            return True
        parts = urlsplit(referer)
        origin = f"{parts.scheme}://{parts.netloc}"
    if origin in allowed_origins:
        return True
    parts = urlsplit(origin)
    host = request.headers.get("host")
    return parts.scheme in {"http", "https"} and bool(host) and parts.netloc == host


class SlidingWindowLimiter:
    """In-memory limiter; the API runs as a single uvicorn process."""

    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = {}

    def allow(self, key: str, *, limit: int, window_seconds: float) -> bool:
        now = time.monotonic()
        hits = self._hits.setdefault(key, deque())
        while hits and hits[0] <= now - window_seconds:
            hits.popleft()
        if len(hits) >= limit:
            return False
        hits.append(now)
        return True

    def reset(self) -> None:
        self._hits.clear()


write_limiter = SlidingWindowLimiter()


async def enforce_write_rate_limit(
    request: Request,
    principal: Principal = Depends(require_principal),
    settings: Settings = Depends(get_settings),
) -> None:
    if request.method in SAFE_METHODS:
        return
    if not write_limiter.allow(
        principal.user_id, limit=settings.rate_limit_per_minute, window_seconds=60
    ):
        raise RateLimitedError(
            "Too many changes in a short time. Try again in a minute.",
            details={"limit_per_minute": settings.rate_limit_per_minute},
        )
