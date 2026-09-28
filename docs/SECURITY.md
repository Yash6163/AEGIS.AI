# Security design

## Threat model

The service processes untrusted network-flow files and serves security
decisions to analysts. Main risks: malicious uploads (resource exhaustion,
parser abuse, path traversal, code execution via deserialisation),
unauthorised writes (fake alerts, deleting evidence), tampering with the
audit trail, and leakage of secrets or raw network data.

## Controls

| area | control | where |
|---|---|---|
| Upload type | only `.csv` / `.csv.gz`; extension must match content (gzip magic); NUL-byte sniff rejects binaries; parquet/pickle/xlsx never accepted | `ingestion/upload.py` |
| Upload size | streamed to an anonymous temp file with a hard byte cap (`MAX_UPLOAD_MB`), 413 on excess | `store_stream` |
| Decompression bombs | gzip decoded through a counting reader that aborts past `MAX_UNCOMPRESSED_MB` | `_LimitedReader` |
| Row / work limits | `MAX_UPLOAD_ROWS`, max 250 k host-minutes per job, bounded job pool, alert cap per job | `upload.py`, `services/analysis.py` |
| Parsing | only whitelisted columns parsed; content is data, never evaluated; malformed CSV -> failed job with a sanitised message | `read_flow_csv` |
| Path traversal | client filename is sanitised for display only and never used in a path; temp files use `mkstemp` and are deleted in `finally` | `sanitize_filename` |
| Model loading | weights `.npz` loaded with `allow_pickle=False`, SHA-256 checked against the manifest; no pickle or joblib anywhere in serving | `forecasting/runtime.py` |
| AuthN / AuthZ | all mutating endpoints (upload, forecast persist, alert updates, job delete, alert-raising replay stream) require `X-API-Key` (constant-time compare). `API_KEY` is mandatory when `APP_ENV=production` | `api/deps.py`, `config.py` |
| Secrets in browser | the web console calls a same-origin Next.js route that adds the API key server-side; no `NEXT_PUBLIC_*` secrets | `frontend/src/app/api/backend/[...path]/route.ts` |
| Proxy hardening | proxy forwards only `/api/v1/*` path segments matching `[A-Za-z0-9._~-]+` (no `..`), fixed backend URL (no SSRF), header allow-list | same |
| Rate limiting | per-client sliding window (in-process); health/readiness exempt | `api/middleware.py` |
| CORS | explicit origin list, no credentials, wildcard refused in production | `main.py`, `config.py` |
| Headers | API: `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, CSP `default-src 'none'`, HSTS over HTTPS. Web: CSP `default-src 'self'`, `frame-ancestors 'none'` | middleware, `next.config.mjs` |
| Input validation | Pydantic schemas (feature counts, finite values, horizon 1-10, enums for alert status/filters, max lengths); query bounds checked | `schemas/api.py`, routers |
| SQL injection | SQLAlchemy ORM / bound parameters only | `db/` |
| XSS | React escaping; no `dangerouslySetInnerHTML`; API returns JSON only | frontend |
| Error handling | uniform error envelope with request id; unhandled exceptions logged server-side, generic message to client | `main.py`, middleware |
| Data minimisation | raw flows are never stored, only per-minute aggregate features. Uploaded host IPs are pseudonymised with HMAC-SHA256(`SECRET_KEY`) by default | `services/analysis.py` |
| Audit trail | SHA-256 hash chain over analyses and alert lifecycle; `/audit/verify` recomputes it; `UNIQUE(prev_hash)` blocks forks | `services/audit.py` |
| Containers | non-root users, read-only root FS, `no-new-privileges`, only the web port published | Dockerfiles, compose |
| Production mode | `/docs` and OpenAPI disabled; schema managed by Alembic; startup refuses default `SECRET_KEY` or missing `API_KEY` | `main.py`, `config.py` |

## Honest limitations

* The API key is a single shared service credential. There are no per-user
  accounts or roles. A real deployment would put the console behind SSO
  (OIDC) and pass user identity to the audit log.
* The audit chain is tamper-*evident* on a single node, not tamper-proof: an
  attacker with full DB write access could rebuild the whole chain. Anchoring
  the head hash externally (e.g. periodic signed publication) would close this.
* The rate limiter and job queue are per process. Multi-instance deployments
  need a gateway limiter and a shared queue.
* Dependency vulnerability scanning (`pip-audit`, `npm audit`) is not yet part
  of CI.
