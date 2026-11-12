import type { NextRequest } from "next/server";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

const HOP_BY_HOP_HEADERS = [
  "connection",
  "content-encoding",
  "content-length",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
];

const UPSTREAM_TIMEOUT_MS = 30_000;
const REFRESH_COOKIE = "pp_refresh";

function refreshCookie(request: NextRequest) {
  const matches = (request.headers.get("cookie") ?? "").split(";").map((part) => part.trim()).filter((part) => part.startsWith(`${REFRESH_COOKIE}=`));
  if (matches.length !== 1) return null;
  const value = matches[0].slice(REFRESH_COOKIE.length + 1);
  return /^[A-Za-z0-9_-]+$/.test(value) ? value : null;
}

function cookieHeader(request: NextRequest, value: string, maxAge: number) {
  const secure = process.env.NODE_ENV === "production" || request.nextUrl.protocol === "https:" ? "; Secure" : "";
  return `${REFRESH_COOKIE}=${value}; Path=/api/backend; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

async function proxy(request: NextRequest, { params }: RouteContext) {
  const requestId = crypto.randomUUID();
  const errorHeaders: Record<string, string> = { "x-request-id": requestId, "cache-control": "no-store" };
  const path = (await params).path;
  const fetchSite = request.headers.get("sec-fetch-site");
  const sameOrigin = request.headers.get("origin") === request.nextUrl.origin &&
    (fetchSite === null || fetchSite === "same-origin" || fetchSite === "none");
  // Clear the browser cookie even if backend configuration is unavailable.
  if (request.method === "POST" && path.length === 2 && path[0] === "auth" && path[1] === "logout" && sameOrigin) {
    errorHeaders["set-cookie"] = cookieHeader(request, "", 0);
  }
  const backendApiUrl =
    process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL;

  if (!backendApiUrl) {
    return Response.json(
      {
        status: 500,
        error: "Server configuration error",
        message: "The backend API is not configured.",
      },
      { status: 500, headers: errorHeaders }
    );
  }

  let target: URL;
  let apiBasePath: string;
  try {
    const base = new URL(backendApiUrl);
    if (base.protocol !== "http:" && base.protocol !== "https:") {
      throw new Error("Unsupported backend URL protocol");
    }

    const pathname = path.map((segment) => encodeURIComponent(segment)).join("/");
    apiBasePath = `${base.pathname.replace(/\/+$/, "")}/`;
    base.pathname = apiBasePath;
    base.search = "";
    base.hash = "";
    target = new URL(`${pathname}${request.nextUrl.search}`, base);
  } catch {
    return Response.json(
      {
        status: 500,
        error: "Server configuration error",
        message: "The backend API URL is invalid.",
      },
      { status: 500, headers: errorHeaders }
    );
  }

  if (!target.pathname.startsWith(apiBasePath)) {
    return Response.json(
      { status: 400, error: "Bad Request", message: "Invalid backend API path." },
      { status: 400, headers: errorHeaders }
    );
  }

  // These endpoints issue or revoke credentials, including profile and invite
  // responses which also contain fresh credentials. Require an exact origin;
  // SameSite cookies alone do not distinguish sibling origins on the same site.
  const relativePath = target.pathname.slice(apiBasePath.length);
  const refresh = request.method === "POST" && relativePath === "auth/refresh";
  const logout = request.method === "POST" && relativePath === "auth/logout";
  const changesCredentials =
    (request.method === "POST" &&
      (/^auth\/(login|register|refresh|logout)$/.test(relativePath) ||
        /^invites\/[^/]+\/accept$/.test(relativePath))) ||
    (request.method === "PUT" && relativePath === "account/profile");
  if (changesCredentials) {
    if (!sameOrigin) {
      return Response.json(
        { status: 403, error: "Forbidden", message: "Invalid request origin." },
        { status: 403, headers: errorHeaders }
      );
    }
  }

  const headers = new Headers(request.headers);
  for (const header of ["host", "origin", "referer", "cookie", ...HOP_BY_HOP_HEADERS]) {
    headers.delete(header);
  }
  headers.set("x-request-id", requestId);

  let timedOut = false;
  try {
    const credential = refresh || logout ? refreshCookie(request) : null;
    if (refresh && !credential) {
      return Response.json({ status: 401, error: "Unauthorized", message: "Sign in again." }, { status: 401, headers: errorHeaders });
    }
    if (logout && !credential) {
      return new Response(null, { status: 204, headers: { ...errorHeaders, "set-cookie": cookieHeader(request, "", 0) } });
    }
    const body = refresh || logout
      ? JSON.stringify({ refreshToken: credential })
      :
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : await request.arrayBuffer();
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, UPSTREAM_TIMEOUT_MS);
    let upstream: Response;
    try {
      upstream = await fetch(target, {
        method: request.method,
        headers,
        body,
        cache: "no-store",
        redirect: "follow",
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const responseHeaders = new Headers(upstream.headers);
    for (const header of HOP_BY_HOP_HEADERS) responseHeaders.delete(header);
    responseHeaders.delete("set-cookie");
    responseHeaders.set("cache-control", "no-store");
    responseHeaders.set("x-request-id", requestId);

    if (logout) {
      responseHeaders.set("set-cookie", cookieHeader(request, "", 0));
      if (upstream.ok) return new Response(null, { status: 204, headers: responseHeaders });
    }
    if (changesCredentials && !logout && upstream.ok) {
      const auth = await upstream.json() as Record<string, unknown>;
      const token = auth.refreshToken;
      const expires = typeof auth.refreshTokenExpiresAt === "string" ? Date.parse(auth.refreshTokenExpiresAt) : NaN;
      const maxAge = Math.min(60 * 60 * 24 * 60, Math.floor((expires - Date.now()) / 1000));
      if (typeof token !== "string" || !/^[A-Za-z0-9_-]+$/.test(token) || !Number.isFinite(maxAge) || maxAge <= 0 || typeof auth.token !== "string") {
        return Response.json({ status: 502, error: "Bad Gateway", message: "Invalid authentication response." }, { status: 502, headers: errorHeaders });
      }
      delete auth.refreshToken;
      delete auth.refreshTokenExpiresAt;
      responseHeaders.set("set-cookie", cookieHeader(request, token, maxAge));
      responseHeaders.set("content-type", "application/json");
      return new Response(JSON.stringify(auth), { status: upstream.status, headers: responseHeaders });
    }
    if (refresh && (upstream.status === 400 || upstream.status === 401)) {
      responseHeaders.set("set-cookie", cookieHeader(request, "", 0));
    }
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch {
    if (logout) errorHeaders["set-cookie"] = cookieHeader(request, "", 0);
    return Response.json(
      timedOut
        ? { status: 504, error: "Gateway Timeout", message: "The backend service timed out." }
        : { status: 502, error: "Bad Gateway", message: "The backend service is unavailable." },
      { status: timedOut ? 504 : 502, headers: errorHeaders }
    );
  }
}

export {
  proxy as DELETE,
  proxy as GET,
  proxy as HEAD,
  proxy as OPTIONS,
  proxy as PATCH,
  proxy as POST,
  proxy as PUT,
};
