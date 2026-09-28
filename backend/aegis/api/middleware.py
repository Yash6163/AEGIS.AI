"""HTTP middleware: request ids + access log, security headers, rate limiting."""

from __future__ import annotations

import logging
import re
import threading
import time
import uuid
from collections import defaultdict, deque

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from ..logging_setup import request_id_var

log = logging.getLogger("aegis.http")
_RID = re.compile(r"^[A-Za-z0-9._-]{8,64}$")


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:  # noqa: ANN001
        incoming = request.headers.get("x-request-id", "")
        rid = incoming if _RID.match(incoming) else uuid.uuid4().hex
        token = request_id_var.set(rid)
        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            log.exception("unhandled error", extra={"path": request.url.path, "method": request.method})
            response = JSONResponse(
                {"error": {"code": "internal_error", "message": "internal server error", "request_id": rid}},
                status_code=500,
            )
        finally:
            request_id_var.reset(token)
        elapsed = (time.perf_counter() - start) * 1000
        response.headers["X-Request-ID"] = rid
        response.headers["Server-Timing"] = f"app;dur={elapsed:.1f}"
        if request.url.path not in ("/api/v1/health",):
            log.info("request", extra={"request_id": rid, "method": request.method, "path": request.url.path,
                                       "status": response.status_code, "duration_ms": round(elapsed, 1)})
        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    DOCS = ("/docs", "/redoc", "/openapi.json")

    async def dispatch(self, request: Request, call_next) -> Response:  # noqa: ANN001
        response = await call_next(request)
        h = response.headers
        h.setdefault("X-Content-Type-Options", "nosniff")
        h.setdefault("X-Frame-Options", "DENY")
        h.setdefault("Referrer-Policy", "no-referrer")
        h.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        h.setdefault("Cross-Origin-Resource-Policy", "same-site")
        if not request.url.path.startswith(self.DOCS):
            h.setdefault("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
        if request.url.scheme == "https":
            h.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Per-client sliding-window limit (in-process; use a gateway/Redis when scaling out)."""

    EXEMPT = ("/api/v1/health", "/api/v1/ready")

    def __init__(self, app, per_minute: int, trusted_proxies: int = 0):  # noqa: ANN001
        super().__init__(app)
        self.per_minute = per_minute
        self.trusted_proxies = trusted_proxies
        self.hits: dict[str, deque[float]] = defaultdict(deque)
        self.lock = threading.Lock()

    def client_id(self, request: Request) -> str:
        if self.trusted_proxies:
            chain = [p.strip() for p in request.headers.get("x-forwarded-for", "").split(",") if p.strip()]
            if len(chain) >= self.trusted_proxies:
                return chain[-self.trusted_proxies]
        return request.client.host if request.client else "unknown"

    async def dispatch(self, request: Request, call_next) -> Response:  # noqa: ANN001
        if self.per_minute <= 0 or request.url.path in self.EXEMPT:
            return await call_next(request)
        now = time.monotonic()
        key = self.client_id(request)
        with self.lock:
            q = self.hits[key]
            while q and now - q[0] > 60:
                q.popleft()
            if len(q) >= self.per_minute:
                retry = int(60 - (now - q[0])) + 1
                return JSONResponse(
                    {"error": {"code": "rate_limited", "message": "too many requests", "request_id": request_id_var.get()}},
                    status_code=429, headers={"Retry-After": str(retry)},
                )
            q.append(now)
            if len(self.hits) > 10_000:  # bound memory under many distinct clients
                for k in [k for k, v in self.hits.items() if not v or now - v[-1] > 60]:
                    del self.hits[k]
        return await call_next(request)
