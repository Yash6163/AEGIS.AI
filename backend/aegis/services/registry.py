"""Process-wide model and scenario registry, loaded once at startup."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path

from ..config import Settings
from ..forecasting.engine import ForecastEngine
from ..forecasting.runtime import ArtifactError
from ..ingestion.sources import ScenarioStore

log = logging.getLogger("aegis.registry")


@dataclass
class Registry:
    production: ForecastEngine | None = None
    cv_folds: dict[int, ForecastEngine] = field(default_factory=dict)
    metrics: dict | None = None
    scenarios: ScenarioStore | None = None
    errors: list[str] = field(default_factory=list)

    @property
    def ready(self) -> bool:
        return self.production is not None

    def engine_for_replay(self, fold: int, use_cv: bool = True) -> tuple[ForecastEngine, str]:
        """CV model of the fold that held this minute out, so replayed forecasts
        are out-of-sample; falls back to the production model."""
        if use_cv and fold in self.cv_folds:
            return self.cv_folds[fold], "cross-validation (out-of-sample)"
        assert self.production is not None
        return self.production, "production"


_registry = Registry()


def load_registry(settings: Settings) -> Registry:
    global _registry
    reg = Registry()
    model_dir = Path(settings.model_dir)
    try:
        reg.production = ForecastEngine.load(model_dir)
        log.info("model loaded", extra={"model_version": reg.production.version, "path": str(model_dir)})
    except (ArtifactError, OSError, ValueError, KeyError) as exc:
        reg.errors.append(f"model: {exc}")
        log.error("model failed to load", extra={"error": str(exc)})
    for fold_dir in sorted((model_dir / "cv").glob("fold*")):
        try:
            reg.cv_folds[int(fold_dir.name[4:])] = ForecastEngine.load(fold_dir)
        except (ArtifactError, OSError, ValueError, KeyError) as exc:
            reg.errors.append(f"cv {fold_dir.name}: {exc}")
    metrics_path = model_dir / "metrics.json"
    if metrics_path.is_file():
        reg.metrics = json.loads(metrics_path.read_text())
    try:
        reg.scenarios = ScenarioStore(settings.scenario_path)
    except (OSError, ValueError, KeyError) as exc:
        reg.errors.append(f"scenarios: {exc}")
        log.warning("replay scenarios unavailable", extra={"error": str(exc)})
    _registry = reg
    return reg


def get_registry() -> Registry:
    return _registry
