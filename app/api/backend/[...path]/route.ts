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

async function proxy(request: NextRequest, { params }: RouteContext) {
  const backendApiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  if (!backendApiUrl) {
    return Response.json(
      {
        status: 500,
        error: "Server configuration error",
        message: "The backend API is not configured.",
      },
      { status: 500 }
    );
  }

  let target: URL;
  let apiBasePath: string;
  try {
    const base = new URL(backendApiUrl);
    if (base.protocol !== "http:" && base.protocol !== "https:") {
      throw new Error("Unsupported backend URL protocol");
    }

    const { path } = await params;
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
      { status: 500 }
    );
  }

  if (!target.pathname.startsWith(apiBasePath)) {
    return Response.json(
      { status: 400, error: "Bad Request", message: "Invalid backend API path." },
      { status: 400 }
    );
  }

  const headers = new Headers(request.headers);
  for (const header of ["host", "origin", "referer", "cookie", ...HOP_BY_HOP_HEADERS]) {
    headers.delete(header);
  }

  try {
    const body =
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : await request.arrayBuffer();
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
      redirect: "follow",
    });

    const responseHeaders = new Headers(upstream.headers);
    for (const header of HOP_BY_HOP_HEADERS) responseHeaders.delete(header);
    responseHeaders.set("cache-control", "no-store");

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch {
    return Response.json(
      { status: 502, error: "Bad Gateway", message: "The backend service is unavailable." },
      { status: 502 }
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
