from __future__ import annotations

import hmac

from fastapi import Depends, Header, HTTPException, status

from ..config import Settings, get_settings
from ..services.registry import Registry, get_registry


def settings_dep() -> Settings:
    return get_settings()


def registry_dep() -> Registry:
    return get_registry()


def ready_registry(reg: Registry = Depends(registry_dep)) -> Registry:
    if not reg.ready:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "model not loaded")
    return reg


def scenarios_registry(reg: Registry = Depends(ready_registry)) -> Registry:
    if reg.scenarios is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "replay scenarios not available")
    return reg


def require_api_key(
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
    settings: Settings = Depends(settings_dep),
) -> None:
    """Mutating endpoints. Disabled only when no API_KEY is configured (dev)."""
    if not settings.api_key:
        return
    if not x_api_key or not hmac.compare_digest(x_api_key.encode(), settings.api_key.encode()):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "missing or invalid API key")
