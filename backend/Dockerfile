# Production inference API. Build context: repository root
#   docker build -f backend/Dockerfile -t aegis-backend .
# Training (torch, xgboost) is deliberately NOT in this image; it loads the
# exported NumPy artifact from models/.

FROM python:3.12-slim AS builder
ENV PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /build
COPY backend/requirements.txt .
RUN pip wheel --wheel-dir /wheels -r requirements.txt

FROM python:3.12-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    APP_ENV=production \
    MODEL_DIR=/app/models/aegis-wm-1.0.0 \
    SCENARIO_PATH=/app/data/scenarios/cicids2017_replay.npz
RUN groupadd --system aegis && useradd --system --gid aegis --home /app aegis
WORKDIR /app/backend
COPY --from=builder /wheels /wheels
RUN pip install --no-cache-dir --no-index --find-links /wheels /wheels/* && rm -rf /wheels
COPY backend/aegis ./aegis
COPY backend/migrations ./migrations
COPY backend/alembic.ini ./
COPY models /app/models
COPY data/scenarios /app/data/scenarios
USER aegis
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health', timeout=2).status == 200 else 1)"
# One worker per container: analysis jobs, the rate limiter and the audit
# writer are in-process. Scale out with more containers behind a gateway.
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn aegis.main:app --host 0.0.0.0 --port 8000 --workers 1 --proxy-headers --forwarded-allow-ips='*' --no-server-header"]
