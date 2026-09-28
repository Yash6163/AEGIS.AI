/**
 * Same-origin proxy to the FastAPI backend.
 *
 * The browser only talks to this Next.js server; BACKEND_URL and API_KEY stay
 * server-side (never NEXT_PUBLIC_*), so the key is not shipped to clients.
 * Only paths under /api/v1 are forwarded, request/response bodies are
 * streamed (uploads, Server-Sent Events).
 */
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BACKEND_URL = (process.env.BACKEND_URL || "http://localhost:8000").replace(/\/$/, "");
const API_KEY = process.env.API_KEY || "";
const SAFE_SEGMENT = /^[A-Za-z0-9._~-]+$/;
const FORWARD_REQ_HEADERS = ["content-type", "content-length", "accept", "x-request-id"];
const FORWARD_RES_HEADERS = ["content-type", "cache-control", "x-request-id", "retry-after"];

async function proxy(req: NextRequest, ctx: { params: { path: string[] } }) {
  const segments = ctx.params.path ?? [];
  if (segments.length === 0 || !segments.every((s) => SAFE_SEGMENT.test(s) && s !== "." && s !== "..")) {
    return Response.json({ error: { code: "bad_path", message: "invalid API path" } }, { status: 400 });
  }
  const target = `${BACKEND_URL}/api/v1/${segments.join("/")}${req.nextUrl.search}`;
  const headers = new Headers();
  for (const h of FORWARD_REQ_HEADERS) {
    const v = req.headers.get(h);
    if (v) headers.set(h, v);
  }
  if (API_KEY) headers.set("X-API-Key", API_KEY);
  const hasBody = !["GET", "HEAD"].includes(req.method);
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      body: hasBody ? req.body : undefined,
      // @ts-expect-error - required by Node fetch for streaming request bodies
      duplex: hasBody ? "half" : undefined,
      cache: "no-store",
      signal: req.signal,
    });
  } catch {
    return Response.json(
      { error: { code: "backend_unreachable", message: "The analysis backend is not reachable." } },
      { status: 502 },
    );
  }
  const out = new Headers();
  for (const h of FORWARD_RES_HEADERS) {
    const v = upstream.headers.get(h);
    if (v) out.set(h, v);
  }
  return new Response(upstream.body, { status: upstream.status, headers: out });
}

export { proxy as GET, proxy as POST, proxy as PATCH, proxy as DELETE };
