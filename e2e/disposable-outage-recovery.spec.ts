import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

test.skip(process.env.RUN_DISPOSABLE_RECOVERY !== "true", "Requires the isolated QA API, gate and production-build frontend.");
test.setTimeout(180_000);
const backend = "http://127.0.0.1:18081/api";
const gate = process.env.RECOVERY_QA_GATE ?? "http://127.0.0.1:18083";
const password = "local-test-only-password-123";

async function get(api: APIRequestContext, path: string, token?: string) {
  const response = await api.get(`${backend}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  expect(response.ok(), `${path}: HTTP ${response.status()}`).toBeTruthy();
  return response.json();
}

async function post(api: APIRequestContext, path: string, data: unknown, token?: string) {
  const response = await api.post(`${backend}${path}`, { data, headers: token ? { Authorization: `Bearer ${token}` } : {} });
  expect(response.ok(), `${path}: HTTP ${response.status()}`).toBeTruthy();
  return response.json();
}

async function queue(page: Page) {
  return page.evaluate(async () => {
    const request = indexedDB.open("poultry-prophet-offline-v1");
    const db = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    try {
      const getAll = db.transaction("outbox").objectStore("outbox").getAll();
      return await new Promise<Array<{ operationId: string; entityType: string; payload: Record<string, unknown> }>>((resolve, reject) => { getAll.onsuccess = () => resolve(getAll.result); getAll.onerror = () => reject(getAll.error); });
    } finally { db.close(); }
  });
}

test("a queued measurement survives an unavailable refresh and a lost sync acknowledgement", async ({ page, context, request, baseURL }) => {
  expect(["http://127.0.0.1:3008", "http://127.0.0.1:33309"]).toContain(baseURL);
  expect(["http://127.0.0.1:18083", "http://127.0.0.1:18084"]).toContain(gate);
  const version = await get(request, "/version");
  expect(version.environment).toBe("validation");
  expect(version.offlineCapabilities).toMatchObject({ commandReceipts: true, schemaReady: true });
  expect(version.offlineCapabilities.receiptEntityTypes).toContain("DAILY_RECORD");
  const control = async (mode: string) => { expect((await request.get(`${gate}/__qa/control?mode=${mode}`)).ok()).toBeTruthy(); };
  const state = async () => (await request.get(`${gate}/__qa/status`)).json();
  await control("ready");
  // Prove the tested frontend is routed through this exact local gate before
  // creating any synthetic data or submitting sign-in credentials.
  const gateIdentity = (await state()).gateId;
  expect(gateIdentity).toBeTruthy();
  const proxiedVersion = await request.get(`${baseURL}/api/backend/version`);
  expect(proxiedVersion.headers()["x-disposable-qa-gate"]).toBe(gateIdentity);
  const id = crypto.randomUUID();
  const email = `recovery-handler-${id}@example.test`;
  const manager = await post(request, "/auth/register", { email: `recovery-manager-${id}@example.test`, password, fullName: "Local QA Manager", farmName: "Local Recovery QA" });
  const handler = await post(request, "/handlers", { email, password, fullName: "Local QA Handler" }, manager.token);
  const handlerLogin = await post(request, "/auth/login", { email, password });
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const batch = await post(request, "/batches", { name: `Recovery ${id}`, initialPopulation: 20, bloodline: "Fixture", startDate: today, hatchDate: today, farmEntryDate: today, handlerUserIds: [handler.userId ?? handler.id] }, manager.token);
  try {
    await page.addInitScript(() => localStorage.setItem("pp_language", "en"));
    await page.goto("/login");
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    await page.locator("#password").press("Enter");
    await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
    await page.goto(`/batches/${batch.id}/data-entry?from=batch`);
    await page.getByRole("button", { name: /Measurements/ }).waitFor({ timeout: 30_000 });
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
    await page.getByRole("button", { name: /Measurements/ }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/Temperature °C/).fill("29.5");
    await dialog.getByLabel(/Feed grams/).fill("123");
    await dialog.getByLabel(/Water ml/).fill("456");
    await dialog.getByLabel(/^Note/).fill("Synthetic outage recovery measurement");
    await context.setOffline(true);
    await dialog.getByRole("button", { name: "Save measurement" }).click();
    await expect.poll(async () => (await queue(page)).filter((item) => item.entityType === "DAILY_RECORD").length).toBe(1);
    const operation = (await queue(page)).find((item) => item.entityType === "DAILY_RECORD")!;
    expect(await get(request, `/batches/${batch.id}/records`, manager.token)).toHaveLength(0);

    await control("unavailable");
    const before = await state();
    await context.setOffline(false);
    const refreshResponse = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/backend/auth/refresh", { timeout: 30_000 });
    await page.reload();
    const refresh = await refreshResponse;
    expect(refresh.status()).toBe(503);
    expect(refresh.headers()["x-pp-refresh-not-started"]).toBe("1");
    expect((await state()).counts.refresh).toBe(before.counts.refresh);
    expect((await queue(page)).some((item) => item.operationId === operation.operationId)).toBe(true);
    expect(await get(request, `/batches/${batch.id}/records`, manager.token)).toHaveLength(0);

    await control("drop-sync-once");
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect.poll(async () => (await state()).counts.dropped, { timeout: 90_000 }).toBe(before.counts.dropped + 1);
    try {
      await expect.poll(async () => (await queue(page)).some((item) => item.operationId === operation.operationId), { timeout: 75_000 }).toBe(false);
    } catch (error) {
      const pending = (await queue(page)).find((item) => item.operationId === operation.operationId) as (typeof operation & { status?: string; attemptCount?: number; nextAttemptAt?: string; lastErrorCode?: string }) | undefined;
      console.log("Recovery diagnostic", { status: pending?.status, attempts: pending?.attemptCount, nextAttemptAt: pending?.nextAttemptAt, lastErrorCode: pending?.lastErrorCode, gate: await state() });
      throw error;
    }
    const finalState = await state();
    expect(finalState.counts.sync - before.counts.sync).toBeGreaterThanOrEqual(2);
    const records = await get(request, `/batches/${batch.id}/records`, manager.token);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ temperatureC: 29.5, feedIntakeG: 123, waterIntakeMl: 456, behaviorNotes: "Synthetic outage recovery measurement" });
    const replay = await post(request, "/sync/v2/operations", { deviceId: "local-qa-replay", operations: [{ ...operation, schemaVersion: 1 }] }, handlerLogin.token);
    expect(replay.results[0].status).toBe("ALREADY_APPLIED");
    expect(await get(request, `/batches/${batch.id}/records`, manager.token)).toHaveLength(1);
  } finally {
    await context.setOffline(false);
    await control("ready");
  }
});
