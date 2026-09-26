import uuid

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.auth import require_principal
from app.api.error_handlers import arvexo_error_handler, unhandled_error_handler
from app.api.routers import (
    analytics,
    best_practices,
    datasets,
    methodology,
    proxy,
    reports,
    runs,
    system,
)
from app.api.security import SAFE_METHODS, enforce_write_rate_limit, is_trusted_origin
from app.config import get_settings
from app.domain.errors import ArvexoError

app = FastAPI(title="Arvexo Radar API", version="0.1.0")

settings = get_settings()


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Content-Security-Policy"] = "default-src 'none'; base-uri 'none'; frame-ancestors 'none'"
    response.headers["Permissions-Policy"] = "camera=(), geolocation=(), microphone=()"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    return response


@app.middleware("http")
async def reject_cross_site_writes(request: Request, call_next):
    if (
        request.method not in SAFE_METHODS
        and request.url.path.startswith("/api/")
        and not is_trusted_origin(request, settings.cors_origins)
    ):
        return JSONResponse(
            status_code=403,
            content={
                "error": {
                    "code": "CROSS_SITE_REQUEST_REJECTED",
                    "message": "Cross-site requests cannot change Radar data.",
                    "retryable": False,
                    "details": {},
                    "correlation_id": str(uuid.uuid4()),
                }
            },
        )
    return await call_next(request)


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.add_exception_handler(ArvexoError, arvexo_error_handler)
app.add_exception_handler(Exception, unhandled_error_handler)

protected = [Depends(require_principal), Depends(enforce_write_rate_limit)]

app.include_router(system.router, prefix="/api/v1")
app.include_router(datasets.router, prefix="/api/v1", dependencies=protected)
app.include_router(runs.router, prefix="/api/v1", dependencies=protected)
app.include_router(reports.router, prefix="/api/v1", dependencies=protected)
app.include_router(best_practices.router, prefix="/api", dependencies=protected)
app.include_router(proxy.router)
app.include_router(analytics.router, prefix="/api/analytics", dependencies=protected)
app.include_router(methodology.router, prefix="/api", dependencies=protected)
