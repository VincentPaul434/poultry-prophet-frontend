import { expect, test, type Page } from "@playwright/test";

test.use({ serviceWorkers: "block" });
test.setTimeout(90_000);

const profile = { userId: 7, farmId: 1, role: "MANAGER", email: "manager@example.test", fullName: "Fixture Manager" };
const emptyPage = { items: [], page: 0, size: 20, totalItems: 0, totalPages: 0, hasPrevious: false, hasNext: false };

async function guard(page: Page, reminderStatus?: 403 | 500) {
  const paths: string[] = [];
  await page.route("**/api/backend/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/api/backend", "");
    paths.push(path);
    if (path === "/auth/refresh") return route.fulfill({ json: { ...profile, token: "fixture-access" } });
    if (request.method() !== "GET") return route.abort("blockedbyclient");
    if (path === "/incubation-cycles/attention") return reminderStatus
      ? route.fulfill({ status: reminderStatus, json: { message: reminderStatus === 403 ? "You cannot access incubation reminders." : "Incubation service is unavailable." } })
      : route.fulfill({ json: [] });
    if (path === "/alerts/page") return route.fulfill({ json: emptyPage });
    if (path === "/alerts/summary") return route.fulfill({ json: { activeTotal: 0, critical: 0, warning: 0, info: 0 } });
    if (path === "/alerts" || path === "/batches" || path === "/batches/dashboard" || path === "/invites/pending") return route.fulfill({ json: [] });
    if (path === "/farm") return route.fulfill({ json: { id: 1, name: "Fixture farm", location: null, description: null } });
    if (path === "/version") return route.fulfill({ json: { application: "poultry-prophet", version: "test", environment: "test" } });
    if (path === "/health") return route.fulfill({ json: { status: "UP" } });
    if (path === "/offline/bootstrap") return route.fulfill({ json: { userId: 7, farmId: 1, batches: [], dashboard: [], products: [], tasks: [], vaccinationPlans: {}, overviews: {}, events: {}, inputs: {} } });
    return route.fulfill({ status: 404, json: { message: "Unexpected fixture request" } });
  });
  return paths;
}

async function sentinel(page: Page, write: boolean) {
  return page.evaluate(async (shouldWrite) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("poultry-prophet-offline-v1");
      request.onupgradeneeded = () => request.result.createObjectStore("outbox", { keyPath: "operationId" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const data = { operationId: "auth-alert-test-offline-record", schemaVersion: 1, entityType: "BATCH_EVENT", userId: 7, farmId: 1, batchId: 1, status: "CONFLICT", attemptCount: 1, sequence: 1, occurredAt: "2026-11-19T00:00:00Z", queuedAt: "2026-11-19T00:00:00Z", payload: { note: "preserve offline work" } };
    const result = await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction("outbox", shouldWrite ? "readwrite" : "readonly");
      const store = tx.objectStore("outbox");
      if (shouldWrite) store.put(data);
      const request = store.get(data.operationId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
    return result;
  }, write);
}

test("an expired session offers one sign-in action and preserves offline work", async ({ page, context }) => {
  await context.addInitScript((user) => {
    if (!localStorage.getItem("pp_auth_session")) localStorage.setItem("pp_auth_session", JSON.stringify({ sessionId: "expired-fixture", user, authRequired: true }));
    localStorage.setItem("pp_language", "en");
  }, profile);
  const paths = await guard(page);
  await page.goto("/alerts", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Alerts", exact: true })).toBeVisible({ timeout: 45_000 });
  const saved = await sentinel(page, true);
  await expect(page.getByRole("heading", { name: "Sign in to view alerts" })).toBeVisible();
  await expect(page.getByText("Sign in again to see current batch alerts and incubation reminders. Your offline records are still on this device.")).toBeVisible();
  await expect(page.getByText("Incubation reminders unavailable")).toHaveCount(0);
  await expect(page.getByText("Failed to load alerts")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(0);
  await expect(page.getByLabel("Alert severity")).toHaveCount(0);
  await expect(page.getByText("You're all caught up")).toHaveCount(0);
  expect(paths.filter((path) => ["/alerts/page", "/alerts/summary", "/incubation-cycles/attention"].includes(path))).toEqual([]);
  await page.getByRole("link", { name: "Sign in again", exact: true }).click();
  await expect(page).toHaveURL(/\/login(?:[?#].*)?$/);
  expect(await sentinel(page, false)).toEqual(saved);
  const session = await page.evaluate(() => JSON.parse(localStorage.getItem("pp_auth_session") ?? "null"));
  expect(session?.sessionId).toBe("expired-fixture");
  expect(session?.authRequired).toBe(true);
  await page.route("**/api/backend/auth/login", async (route) => {
    expect(route.request().postDataJSON()).toEqual({ email: profile.email, password: "fixture-password" });
    return route.fulfill({ json: { ...profile, token: "fixture-access" } });
  });
  await page.route("**/api/backend/incubation-cycles/attention", (route) => route.fulfill({ json: [{ cycleId: 12, cycleName: "Fixture hatch", expectedHatchDate: "2026-11-19", actualHatchDate: null, hatchedCount: null, kind: "HATCH_DUE_TODAY", asOfDate: "2026-11-19" }] }));
  await page.getByLabel(/^(email|email address)$/i).fill(profile.email);
  await page.getByLabel(/^password$/i).fill("fixture-password");
  await page.getByRole("button", { name: /^(mag-sign in|sign in|log in|login)$/i }).click();
  await expect(page).toHaveURL(/\/dashboard(?:[?#].*)?$/);
  expect(await sentinel(page, false)).toEqual(saved);
  await page.goto("/alerts", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Fixture hatch")).toBeVisible({ timeout: 45_000 });
  expect(await sentinel(page, false)).toEqual(saved);
});

for (const status of [403, 500] as const) {
  test(`authenticated incubation HTTP ${status} shows a truthful retryable error`, async ({ page, context }) => {
    await context.addInitScript((user) => {
      if (!localStorage.getItem("pp_auth_session")) localStorage.setItem("pp_auth_session", JSON.stringify({ sessionId: "active-fixture", user }));
      localStorage.setItem("pp_language", "en");
    }, profile);
    const paths = await guard(page, status);
    await page.goto("/alerts", { waitUntil: "domcontentloaded" });
    const error = page.getByRole("alert").filter({ hasText: "Incubation reminders unavailable" });
    await expect(error).toBeVisible({ timeout: 45_000 });
    await expect(error).toContainText(status === 403 ? "You cannot access incubation reminders." : "Incubation service is unavailable.");
    await expect(error).not.toContainText("Check your connection and try again.");
    const before = paths.filter((path) => path === "/incubation-cycles/attention").length;
    await error.getByRole("button", { name: "Try again" }).click();
    await expect.poll(() => paths.filter((path) => path === "/incubation-cycles/attention").length).toBeGreaterThan(before);
    await expect(page.getByText("You're all caught up")).toHaveCount(0);
  });
}
