import { expect, test, type BrowserContext } from "@playwright/test";

const user = { userId: 7, email: "manager@example.test", fullName: "Farm Manager", role: "MANAGER", farmId: 1 };
test.use({ serviceWorkers: "block" });

async function seedSession(context: BrowserContext, baseURL: string) {
  await context.addCookies([{ name: "pp_refresh", value: "first-refresh", domain: new URL(baseURL).hostname, path: "/api/backend", httpOnly: true, sameSite: "Strict" }]);
  await context.addInitScript((cachedUser) => {
    if (localStorage.getItem("pp_auth_e2e_seeded")) return;
    localStorage.setItem("pp_auth_session", JSON.stringify({ sessionId: "test-session", user: cachedUser }));
    localStorage.setItem("pp_auth_e2e_seeded", "1");
  }, user);
}

async function mockBackend(context: BrowserContext, onRefresh: (cookie: string) => Promise<string>) {
  await context.route("**/api/backend/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/backend", "");
    if (path === "/auth/refresh") {
      const nextCookie = await onRefresh(route.request().headers().cookie ?? "");
      return route.fulfill({ json: { ...user, token: `access-${nextCookie}` }, headers: { "set-cookie": `pp_refresh=${nextCookie}; Path=/api/backend; HttpOnly; SameSite=Strict` } });
    }
    if (path === "/auth/logout") return route.abort();
    if (path === "/farm") return route.fulfill({ json: { id: 1, name: "Fixture Farm", location: "Test", description: null } });
    if (path === "/alerts") return route.fulfill({ json: [] });
    if (path === "/alerts/summary") return route.fulfill({ json: { activeTotal: 0, critical: 0, warning: 0, info: 0 } });
    if (path === "/version") return route.fulfill({ json: { application: "poultry-prophet", version: "e2e", commitSha: "e2e", buildTime: "2026-11-11T00:00:00Z", environment: "test", compatibleFrontendVersion: "0.1.0-validation" } });
    if (path === "/health") return route.fulfill({ json: { status: "UP" } });
    if (path === "/offline/bootstrap") return route.fulfill({ json: { userId: 7, farmId: 1, batches: [], dashboard: [], products: [], tasks: [], vaccinationPlans: {}, overviews: {}, events: {}, inputs: {} } });
    return route.fulfill({ json: {} });
  });
}

test("tabs rotate the cookie serially and keep access tokens out of persistent storage", async ({ page, context, baseURL }) => {
  if (!baseURL) throw new Error("baseURL required");
  const seen: string[] = [];
  await mockBackend(context, async (cookie) => {
    seen.push(cookie);
    await new Promise((resolve) => setTimeout(resolve, 150));
    return `rotation-${seen.length}`;
  });
  await seedSession(context, baseURL);
  const secondTab = await context.newPage();
  await Promise.all([page.goto("/settings"), secondTab.goto("/settings")]);
  await expect(page.getByRole("heading", { name: "Settings", exact: true, level: 1 })).toBeVisible();
  await expect(secondTab.getByRole("heading", { name: "Settings", exact: true, level: 1 })).toBeVisible();
  expect(seen).toEqual(["pp_refresh=first-refresh", "pp_refresh=rotation-1"]);
  expect((await context.cookies()).find(cookie => cookie.name === "pp_refresh")?.httpOnly).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem("pp_auth_session"))).not.toMatch(/access-|refresh|rotation-/);
});

test("tabs without Web Locks serialize cookie rotation using IndexedDB", async ({ page, context, baseURL }) => {
  if (!baseURL) throw new Error("baseURL required");
  await context.addInitScript(() => Object.defineProperty(navigator, "locks", { value: undefined }));
  const seen: string[] = [];
  await mockBackend(context, async cookie => {
    seen.push(cookie);
    await new Promise(resolve => setTimeout(resolve, 150));
    return `rotation-${seen.length}`;
  });
  await seedSession(context, baseURL);
  const other = await context.newPage();
  await Promise.all([page.goto("/settings"), other.goto("/settings")]);
  await expect(page.getByRole("heading", { name: "Settings", exact: true, level: 1 })).toBeVisible();
  await expect(other.getByRole("heading", { name: "Settings", exact: true, level: 1 })).toBeVisible();
  expect(seen).toEqual(["pp_refresh=first-refresh", "pp_refresh=rotation-1"]);
});

test("tabs with different Web Locks support still share one credential lock", async ({ page, context, baseURL }) => {
  if (!baseURL) throw new Error("baseURL required");
  await page.addInitScript(() => Object.defineProperty(navigator, "locks", { value: undefined }));
  const seen: string[] = [];
  await mockBackend(context, async cookie => {
    seen.push(cookie);
    await new Promise(resolve => setTimeout(resolve, 150));
    return `rotation-${seen.length}`;
  });
  await seedSession(context, baseURL);
  const other = await context.newPage();
  await Promise.all([page.goto("/settings"), other.goto("/settings")]);
  await expect(page.getByRole("heading", { name: "Settings", exact: true, level: 1 })).toBeVisible();
  await expect(other.getByRole("heading", { name: "Settings", exact: true, level: 1 })).toBeVisible();
  expect(seen).toEqual(["pp_refresh=first-refresh", "pp_refresh=rotation-1"]);
});

test("logout clears both tabs even when revocation is unreachable", async ({ page, context, baseURL }) => {
  if (!baseURL) throw new Error("baseURL required");
  await mockBackend(context, async () => "rotation-1");
  await seedSession(context, baseURL);
  const secondTab = await context.newPage();
  await Promise.all([page.goto("/settings"), secondTab.goto("/settings")]);
  await expect(secondTab.getByRole("heading", { name: "Settings", exact: true, level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Open account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(secondTab).toHaveURL(/\/login$/);
  expect(await page.evaluate(() => localStorage.getItem("pp_auth_session"))).toBeNull();
});

test("explicit logout removes a rejected session and does not restore its offline identity", async ({ page, context, baseURL }) => {
  if (!baseURL) throw new Error("baseURL required");
  await mockBackend(context, async () => "unused");
  let refreshCalls = 0;
  await context.route("**/api/backend/auth/refresh", route => { refreshCalls++; return route.fulfill({ status: 401, json: { message: "Expired" } }); });
  await seedSession(context, baseURL);
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Settings", exact: true, level: 1 })).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("pp_auth_session") ?? "null")?.authRequired)).toBe(true);
  await page.getByRole("button", { name: "Open account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(() => localStorage.getItem("pp_auth_session"))).toBeNull();
  expect(refreshCalls).toBe(1);
});

test("a rejected refresh marks the shared profile without signing out other tabs", async ({ page, context, baseURL }) => {
  if (!baseURL) throw new Error("baseURL required");
  await mockBackend(context, async () => "rotation-1");
  await seedSession(context, baseURL);
  const other = await context.newPage();
  await Promise.all([page.goto("/settings"), other.goto("/settings")]);
  await expect(page.getByRole("heading", { name: "Settings", exact: true, level: 1 })).toBeVisible();
  await expect(other.getByRole("heading", { name: "Settings", exact: true, level: 1 })).toBeVisible();
  await page.route("**/api/backend/auth/refresh", route => route.fulfill({ status: 400, json: { message: "Expired" } }));
  await page.reload();
  await expect.poll(() => other.evaluate(() => JSON.parse(localStorage.getItem("pp_auth_session") ?? "null")?.authRequired)).toBe(true);
  await expect(other.getByRole("heading", { name: "Settings", exact: true, level: 1 })).toBeVisible();
  await expect(other.getByRole("button", { name: /sign in to send|mag-sign in para maipadala/i }).first()).toBeVisible();
});

test("logout waits for an in-flight rotation before revoking its replacement", async ({ page, context, baseURL }) => {
  if (!baseURL) throw new Error("baseURL required");
  let next = 0;
  await mockBackend(context, async () => `rotation-${++next}`);
  await seedSession(context, baseURL);
  const secondTab = await context.newPage();
  await Promise.all([page.goto("/settings"), secondTab.goto("/settings")]);
  await expect(page.getByRole("heading", { name: "Settings", exact: true, level: 1 })).toBeVisible();
  await expect(secondTab.getByRole("heading", { name: "Settings", exact: true, level: 1 })).toBeVisible();
  let release!: () => void;
  let started!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const rotationStarted = new Promise<void>(resolve => { started = resolve; });
  let revokedCookie = "";
  await secondTab.route("**/api/backend/auth/refresh", async route => {
    started();
    await pending;
    await route.fulfill({ json: { ...user, token: "new-access" }, headers: { "set-cookie": "pp_refresh=last-rotation; Path=/api/backend; HttpOnly; SameSite=Strict" } });
  });
  await context.route("**/api/backend/auth/logout", async route => {
    revokedCookie = route.request().headers().cookie ?? "";
    await route.fulfill({ status: 204, headers: { "set-cookie": "pp_refresh=; Path=/api/backend; HttpOnly; SameSite=Strict; Max-Age=0" } });
  });
  const reload = secondTab.reload().catch(() => null);
  await rotationStarted;
  await page.getByRole("button", { name: "Open account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  release();
  await reload;
  await expect.poll(() => revokedCookie).toContain("pp_refresh=last-rotation");
  await expect(secondTab).toHaveURL(/\/login$/);
  expect((await context.cookies()).find(cookie => cookie.name === "pp_refresh")).toBeUndefined();
});

test("a delayed logout cannot revoke a different account that signed in meanwhile", async ({ page, context, baseURL }) => {
  if (!baseURL) throw new Error("baseURL required");
  await mockBackend(context, async () => "initial-rotation");
  await seedSession(context, baseURL);
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Settings", exact: true, level: 1 })).toBeVisible();
  const loginTab = await context.newPage();
  await loginTab.goto("/login", { waitUntil: "networkidle" });
  await page.evaluate(() => {
    const state = window as unknown as { releaseLogout: () => void; logoutDone: boolean };
    const original = navigator.locks.request.bind(navigator.locks);
    Object.defineProperty(navigator.locks, "request", { value: (name: string, callback: () => Promise<unknown>) => new Promise(resolve => {
      state.releaseLogout = () => { void original(name, callback).then(resolve).finally(() => { state.logoutDone = true; }); };
    }) });
  });
  let logoutCalls = 0;
  await context.route("**/api/backend/auth/logout", route => { logoutCalls++; return route.fulfill({ status: 204 }); });
  const newUser = { ...user, userId: 8, farmId: 2, email: "other@example.test" };
  await context.route("**/api/backend/auth/login", route => route.fulfill({ json: { ...newUser, token: "new-access" }, headers: { "set-cookie": "pp_refresh=new-account; Path=/api/backend; HttpOnly; SameSite=Strict" } }));
  await context.route("**/api/backend/auth/refresh", route => route.fulfill({ json: { ...newUser, token: "renewed-access" }, headers: { "set-cookie": "pp_refresh=new-account-rotated; Path=/api/backend; HttpOnly; SameSite=Strict" } }));
  await page.getByRole("button", { name: "Open account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Sign out" }).click();
  await expect.poll(() => page.evaluate(() => typeof (window as unknown as { releaseLogout?: () => void }).releaseLogout)).toBe("function");
  await loginTab.getByLabel(/^(email|email address)$/i).fill("other@example.test");
  await loginTab.getByLabel(/^password$/i).fill("password-for-test");
  await loginTab.getByRole("button", { name: /^(mag-sign in|sign in|log in|login)$/i }).click();
  await expect(loginTab).toHaveURL(/\/dashboard$/);
  await page.evaluate(() => (window as unknown as { releaseLogout: () => void }).releaseLogout());
  await expect.poll(() => page.evaluate(() => (window as unknown as { logoutDone: boolean }).logoutDone)).toBe(true);
  expect(logoutCalls).toBe(0);
  expect((await context.cookies()).find(cookie => cookie.name === "pp_refresh")?.value).toMatch(/^new-account/);
});
