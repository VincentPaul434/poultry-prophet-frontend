import { chromium, expect, test, type BrowserContext, type Page } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";

const user = { userId: 7, email: "manager@example.test", fullName: "Farm Manager", role: "MANAGER", farmId: 1 };
test.use({ serviceWorkers: "block" });

async function openAccountMenu(page: Page) {
  const accountMenu = page.getByRole("button", { name: "Open account menu" });
  if (await accountMenu.count()) {
    await accountMenu.click();
    return;
  }
  await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  await expect(accountMenu).toBeVisible();
  await accountMenu.click();
}

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
      return route.fulfill({ json: { ...user, token: `access-${nextCookie}` }, headers: { "set-cookie": `pp_refresh=${nextCookie}; Path=/api/backend; HttpOnly; SameSite=Strict; Max-Age=5184000` } });
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

test("restores a persistent session after closing and reopening the browser", async ({ baseURL, browserName }) => {
  test.skip(browserName !== "chromium", "Persistent browser restart coverage uses Chromium.");
  if (!baseURL) throw new Error("baseURL required");
  const profileDir = await mkdtemp(join(tmpdir(), "poultry-auth-restart-"));
  let persistent: BrowserContext | undefined;
  const seen: string[] = [];
  const onRefresh = async (cookie: string) => { seen.push(cookie); return `rotation-${seen.length}`; };
  try {
    persistent = await chromium.launchPersistentContext(profileDir, { headless: true });
    await mockBackend(persistent, onRefresh);
    await seedSession(persistent, baseURL);
    await persistent.addCookies([{ name: "pp_refresh", value: "first-refresh", domain: new URL(baseURL).hostname, path: "/api/backend", httpOnly: true, sameSite: "Strict", expires: Math.floor(Date.now() / 1000) + 86_400 }]);
    await persistent.pages()[0].goto(`${baseURL}/settings`);
    await expect(persistent.pages()[0].getByRole("heading", { name: "Settings", exact: true, level: 1 })).toBeVisible();
    await expect.poll(() => seen.length).toBe(1);
    await persistent.close();
    persistent = undefined;
    persistent = await chromium.launchPersistentContext(profileDir, { headless: true });
    await mockBackend(persistent, onRefresh);
    const reopened = persistent.pages()[0];
    await reopened.goto(`${baseURL}/settings`);
    await expect(reopened.getByRole("heading", { name: "Settings", exact: true, level: 1 })).toBeVisible();
    await expect.poll(() => seen.length).toBe(2);
    expect(seen).toEqual(["pp_refresh=first-refresh", "pp_refresh=rotation-1"]);
    expect(await reopened.evaluate(() => JSON.parse(localStorage.getItem("pp_auth_session") ?? "null")?.authRequired)).not.toBe(true);
  } finally {
    await persistent?.close();
    if (resolve(profileDir).startsWith(`${resolve(tmpdir())}${sep}`)) await rm(profileDir, { recursive: true, force: true });
  }
});

test("a second tab waits for the active credential refresh", async ({ page, context, baseURL }) => {
  if (!baseURL) throw new Error("baseURL required");
  let release!: () => void;
  let started!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const firstStarted = new Promise<void>(resolve => { started = resolve; });
  const seen: string[] = [];
  await mockBackend(context, async cookie => {
    seen.push(cookie);
    if (seen.length === 1) { started(); await held; }
    return `rotation-${seen.length}`;
  });
  await seedSession(context, baseURL);
  try {
    await page.goto("/settings", { waitUntil: "domcontentloaded" });
    await firstStarted;
    const second = await context.newPage();
    await second.addInitScript(() => {
      const target = navigator.locks;
      const original = target.request.bind(target);
      Object.defineProperty(target, "request", { value: (...args: Parameters<LockManager["request"]>) => {
        (window as unknown as { secondTabRequestedLock: boolean }).secondTabRequestedLock = true;
        return original(...args);
      }});
    });
    await second.goto("/settings", { waitUntil: "domcontentloaded" });
    await second.waitForFunction(() =>
      (window as unknown as { secondTabRequestedLock?: boolean }).secondTabRequestedLock ||
      JSON.parse(localStorage.getItem("pp_auth_session") ?? "null")?.authRequired === true
    );
    expect(await second.evaluate(() => JSON.parse(localStorage.getItem("pp_auth_session") ?? "null")?.authRequired)).not.toBe(true);
    expect(await second.evaluate(() => (window as unknown as { secondTabRequestedLock?: boolean }).secondTabRequestedLock)).toBe(true);
    release();
    await expect.poll(() => seen.length).toBe(2);
    await expect.poll(async () => (await context.cookies()).find(cookie => cookie.name === "pp_refresh")?.value).toBe("rotation-2");
    expect(seen).toEqual(["pp_refresh=first-refresh", "pp_refresh=rotation-1"]);
  } finally { release(); }
});

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
  await openAccountMenu(page);
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
  await openAccountMenu(page);
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(() => localStorage.getItem("pp_auth_session"))).toBeNull();
  expect(refreshCalls).toBe(1);
});

test("an uncertain refresh asks for sign-in instead of leaving a ghost session", async ({ page, context }) => {
  let refreshCalls = 0;
  await context.addInitScript((cachedUser) => {
    localStorage.setItem("pp_auth_session", JSON.stringify({
      sessionId: "uncertain-session",
      user: cachedUser,
      refreshUncertain: true,
    }));
  }, user);
  await context.route("**/api/backend/auth/refresh", (route) => {
    refreshCalls += 1;
    return route.fulfill({ status: 500, json: { message: "This credential must not be replayed" } });
  });

  await page.goto("/settings");
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("pp_auth_session") ?? "null")?.authRequired)).toBe(true);
  await expect(page.getByText("Sign in to load farm", { exact: true }).first()).toBeVisible();
  expect(refreshCalls).toBe(0);
});

test("a refresh confirmed not sent can recover after a temporary outage", async ({ page, context, baseURL }) => {
  if (!baseURL) throw new Error("baseURL required");
  await mockBackend(context, async () => "recovered-refresh");
  await seedSession(context, baseURL);
  let refreshCalls = 0;
  await context.route("**/api/backend/auth/refresh", (route) => {
    refreshCalls++;
    if (refreshCalls === 1) return route.fulfill({ status: 503, headers: { "x-pp-refresh-not-started": "1" }, json: { message: "Backend not ready" } });
    return route.fulfill({ json: { ...user, token: "recovered-access" }, headers: { "set-cookie": "pp_refresh=recovered-refresh; Path=/api/backend; HttpOnly; SameSite=Strict" } });
  });
  await page.goto("/settings");
  await expect.poll(() => refreshCalls).toBe(1);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("pp_auth_session") ?? "null")?.refreshUncertain ?? false)).toBe(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(() => refreshCalls).toBe(2);
  await expect(page.getByRole("heading", { name: "Settings", exact: true, level: 1 })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("pp_auth_session") ?? "null")?.authRequired)).not.toBe(true);
  expect((await context.cookies()).find(cookie => cookie.name === "pp_refresh")?.value).toBe("recovered-refresh");
});

test("a protected request retries with the restored token after a safe refresh outage", async ({ page, context, baseURL }) => {
  if (!baseURL) throw new Error("baseURL required");
  await mockBackend(context, async () => "recovered-refresh");
  await seedSession(context, baseURL);
  let refreshCalls = 0;
  const authorizations: string[] = [];
  await context.route("**/api/backend/auth/refresh", (route) => {
    refreshCalls++;
    if (refreshCalls === 1) return route.fulfill({ status: 503, headers: { "x-pp-refresh-not-started": "1" }, json: { message: "Backend not ready" } });
    return route.fulfill({ json: { ...user, token: "recovered-access" }, headers: { "set-cookie": "pp_refresh=recovered-refresh; Path=/api/backend; HttpOnly; SameSite=Strict" } });
  });
  await context.route("**/api/backend/farm", (route) => {
    const authorization = route.request().headers().authorization ?? "";
    authorizations.push(authorization);
    return authorization === "Bearer recovered-access"
      ? route.fulfill({ json: { id: 1, name: "Fixture Farm", location: "Test", description: null } })
      : route.fulfill({ status: 401, json: { message: "Unauthorized" } });
  });
  await page.goto("/settings");
  await expect.poll(() => refreshCalls).toBe(2);
  await expect.poll(() => authorizations).toContain("Bearer recovered-access");
  await expect(page.getByText("Fixture Farm").first()).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("pp_auth_session") ?? "null")?.authRequired)).not.toBe(true);
});

test("an ambiguous refresh failure is not replayed", async ({ page, context, baseURL }) => {
  if (!baseURL) throw new Error("baseURL required");
  await mockBackend(context, async () => "unused");
  await seedSession(context, baseURL);
  let refreshCalls = 0;
  await context.route("**/api/backend/auth/refresh", (route) => {
    refreshCalls++;
    return route.fulfill({ status: 502, json: { message: "The refresh outcome is unknown" } });
  });
  await page.goto("/settings");
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("pp_auth_session") ?? "null")?.refreshUncertain)).toBe(true);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("pp_auth_session") ?? "null")?.authRequired)).toBe(true);
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
  await openAccountMenu(page);
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
  await openAccountMenu(page);
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Sign out" }).click();
  await expect.poll(() => page.evaluate(() => typeof (window as unknown as { releaseLogout?: () => void }).releaseLogout)).toBe("function");
  await loginTab.goto("/login", { waitUntil: "networkidle" });
  await expect(loginTab.getByLabel(/^(email|email address)$/i)).toBeVisible();
  await loginTab.getByLabel(/^(email|email address)$/i).fill("other@example.test");
  await loginTab.getByLabel(/^password$/i).fill("password-for-test");
  await loginTab.getByRole("button", { name: /^(mag-sign in|sign in|log in|login)$/i }).click();
  await expect(loginTab).toHaveURL(/\/dashboard$/);
  await page.evaluate(() => (window as unknown as { releaseLogout: () => void }).releaseLogout());
  await expect.poll(() => page.evaluate(() => (window as unknown as { logoutDone: boolean }).logoutDone)).toBe(true);
  expect(logoutCalls).toBe(0);
  expect((await context.cookies()).find(cookie => cookie.name === "pp_refresh")?.value).toMatch(/^new-account/);
});
