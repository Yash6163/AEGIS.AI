"""FastAPI application factory."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .api.middleware import RateLimitMiddleware, RequestContextMiddleware, SecurityHeadersMiddleware
from .api.v1 import alerts, analysis, forecast, scenarios, system
from .config import Settings, get_settings
from .db.models import Base
from .db.session import get_engine, init_engine
from .logging_setup import configure_logging, request_id_var
from .services import analysis as analysis_svc
from .services.registry import load_registry

log = logging.getLogger("aegis")
API_PREFIX = "/api/v1"

DESCRIPTION = """
Forecasts how a host's **attack stage** will evolve over the next K minutes from
network-flow features, using a GRU latent world model of
P(S[t+1] | S[t], traffic history) rolled forward by Monte-Carlo sampling.

* Trained and cross-validated on CIC-IDS2017 (see `/model` and `/model/metrics`).
* `/scenarios/*` replays recorded dataset traffic - a simulation, not a live feed.
* `/analysis/upload` accepts CICFlowMeter CSV files.
"""


def _error(status: int, code: str, message: str, details=None) -> JSONResponse:  # noqa: ANN001
    body = {"code": code, "message": message, "request_id": request_id_var.get()}
    if details is not None:
        body["details"] = details
    return JSONResponse({"error": body}, status_code=status)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level, settings.log_json)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        init_engine(settings)
        if settings.app_env != "production":
            # production schema is managed by Alembic (`alembic upgrade head`)
            Base.metadata.create_all(get_engine())
        reg = load_registry(settings)
        log.info("startup", extra={"env": settings.app_env, "model_ready": reg.ready, "cv_models": len(reg.cv_folds)})
        yield
        analysis_svc.shutdown()

    app = FastAPI(
        title="AEGIS attack-forecasting API",
        version="1.0.0",
        description=DESCRIPTION,
        lifespan=lifespan,
        docs_url="/docs" if settings.app_env != "production" else None,
        redoc_url=None,
        openapi_url="/openapi.json" if settings.app_env != "production" else None,
    )
    app.add_middleware(RateLimitMiddleware, per_minute=settings.rate_limit_per_minute,
                       trusted_proxies=settings.trusted_proxy_count)
    app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=False,
                       allow_methods=["GET", "POST", "PATCH", "DELETE"],
                       allow_headers=["Content-Type", "X-API-Key", "X-Request-ID"], expose_headers=["X-Request-ID"])
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(RequestContextMiddleware)

    @app.exception_handler(HTTPException)
    async def http_error(_: Request, exc: HTTPException):
        detail = exc.detail
        if isinstance(detail, dict):
            return _error(exc.status_code, "http_error", str(detail.get("status", "error")), detail)
        return _error(exc.status_code, "http_error", str(detail))

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, exc: RequestValidationError):
        details = [{"loc": list(e.get("loc", [])), "msg": e.get("msg")} for e in exc.errors()[:20]]
        return _error(422, "validation_error", "request validation failed", details)

    for r in (system.router, forecast.router, scenarios.router, analysis.router, alerts.router):
        app.include_router(r, prefix=API_PREFIX)
    return app


app = create_app()
