import { expect, test } from "@playwright/test";
import { NextRequest } from "next/server";
import { maxDuration, POST } from "../app/api/backend/[...path]/route";

test.describe.configure({ mode: "serial" });

test("allows enough time for the proxy's own timeouts", () => {
  expect(maxDuration).toBeGreaterThan(45);
});

function refreshRequest() {
  return new NextRequest("https://farm.example/api/backend/auth/refresh", {
    method: "POST",
    headers: { origin: "https://farm.example", host: "farm.example", "sec-fetch-site": "same-origin", cookie: "pp_refresh=test-refresh", "content-type": "application/json" },
    body: "{}",
  });
}

test("does not send the refresh credential when the backend is not ready", async () => {
  const originalFetch = globalThis.fetch;
  const originalBackend = process.env.BACKEND_API_URL;
  const calls: string[] = [];
  process.env.BACKEND_API_URL = "https://backend.example/api";
  globalThis.fetch = (async (input) => {
    calls.push(String(input));
    return new Response(null, { status: 503 });
  }) as typeof fetch;
  try {
    const response = await POST(refreshRequest(), { params: Promise.resolve({ path: ["auth", "refresh"] }) });
    expect(response.status).toBe(503);
    expect(response.headers.get("x-pp-refresh-not-started")).toBe("1");
    expect(calls).toEqual(["https://backend.example/api/health/ready"]);
    expect(response.headers.get("set-cookie")).toBeNull();
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBackend === undefined) delete process.env.BACKEND_API_URL;
    else process.env.BACKEND_API_URL = originalBackend;
  }
});

test("rotates a ready session while keeping the refresh credential in an HttpOnly cookie", async () => {
  const originalFetch = globalThis.fetch;
  const originalBackend = process.env.BACKEND_API_URL;
  const calls: string[] = [];
  process.env.BACKEND_API_URL = "https://backend.example/api";
  globalThis.fetch = (async (input, init) => {
    calls.push(String(input));
    if (calls.length === 1) return Response.json({ status: "UP" });
    expect(JSON.parse(String(init?.body))).toEqual({ refreshToken: "test-refresh" });
    return Response.json({ userId: 7, farmId: 1, token: "access", refreshToken: "replacement", refreshTokenExpiresAt: new Date(Date.now() + 86_400_000).toISOString() }, { headers: { "x-pp-refresh-not-started": "1" } });
  }) as typeof fetch;
  try {
    const response = await POST(refreshRequest(), { params: Promise.resolve({ path: ["auth", "refresh"] }) });
    expect(calls).toEqual(["https://backend.example/api/health/ready", "https://backend.example/api/auth/refresh"]);
    expect(response.status).toBe(200);
    expect(response.headers.get("x-pp-refresh-not-started")).toBeNull();
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toMatch(/Max-Age=[1-9]\d*/);
    expect(await response.json()).not.toHaveProperty("refreshToken");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBackend === undefined) delete process.env.BACKEND_API_URL;
    else process.env.BACKEND_API_URL = originalBackend;
  }
});

test("does not trust an upstream claim that a sent rotation was not started", async () => {
  const originalFetch = globalThis.fetch;
  const originalBackend = process.env.BACKEND_API_URL;
  let calls = 0;
  process.env.BACKEND_API_URL = "https://backend.example/api";
  globalThis.fetch = (async () => ++calls === 1
    ? Response.json({ status: "UP" })
    : new Response(null, { status: 503, headers: { "x-pp-refresh-not-started": "1" } })) as typeof fetch;
  try {
    const response = await POST(refreshRequest(), { params: Promise.resolve({ path: ["auth", "refresh"] }) });
    expect(calls).toBe(2);
    expect(response.status).toBe(503);
    expect(response.headers.get("x-pp-refresh-not-started")).toBeNull();
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBackend === undefined) delete process.env.BACKEND_API_URL;
    else process.env.BACKEND_API_URL = originalBackend;
  }
});
