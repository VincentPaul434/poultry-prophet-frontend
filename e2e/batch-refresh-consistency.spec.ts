import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import ts from "typescript";

test.use({ serviceWorkers: "block", viewport: { width: 360, height: 800 } });
test.setTimeout(90_000);

const operationId = "00000000-0000-4000-8000-000000000050";
async function fixture(page: Page, baseURL: string | undefined, role: "MANAGER" | "HANDLER" = "HANDLER") {
  if (!baseURL || !["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname)) throw new Error("Local fixture server required");
  const origin = new URL(baseURL).origin;
  const user = { userId: role === "HANDLER" ? 8 : 9, farmId: 1, role, email: "refresh@example.test", fullName: "Refresh Fixture" };
  const batch = { id: 35, farmId: 1, name: "October Load Hatch", initialPopulation: 200, currentPopulation: 200,
    populationStatus: "VALID", populationWarning: null, startDate: "2026-11-19", hatchDate: "2026-11-19", farmEntryDate: "2026-11-19",
    bloodline: null, source: null, derbyDate: null, stageId: 1, stageName: "Brooding", stageAuto: true, status: "ACTIVE", handlerUserIds: [8], createdAt: "2026-11-19T00:00:00Z" };
  const state = { ready: false, loseAcknowledgement: false, deaths: 0, overviewReads: 0, sent: [] as string[] };
  const accepted = new Set<string>();
  const emptyPage = { items: [], page: 0, size: 10, totalItems: 0, totalPages: 0, hasPrevious: false, hasNext: false };
  await page.addInitScript(profile => {
    localStorage.setItem("pp_auth_session", JSON.stringify({ sessionId: "refresh-fixture", user: profile }));
    localStorage.setItem("pp_language", "en");
  }, user);
  await page.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin) return route.abort("blockedbyclient");
    if (!url.pathname.startsWith("/api/backend/")) return ["GET", "HEAD"].includes(request.method()) ? route.continue() : route.abort("blockedbyclient");
    const path = url.pathname.slice("/api/backend".length);
    if (path === "/auth/refresh" && request.method() === "POST") return route.fulfill({ json: { ...user, token: "fixture-token" } });
    if (path === "/sync/v2/operations" && request.method() === "POST") {
      const operations = request.postDataJSON().operations as Array<{ operationId: string }>;
      for (const operation of operations) {
        state.sent.push(operation.operationId);
        if (!accepted.has(operation.operationId)) { accepted.add(operation.operationId); batch.currentPopulation -= 50; state.deaths += 50; }
      }
      if (state.loseAcknowledgement) { state.loseAcknowledgement = false; return route.abort("connectionreset"); }
      return route.fulfill({ json: { results: operations.map(operation => ({ operationId: operation.operationId, status: "ALREADY_APPLIED", serverId: 50, serverTime: new Date().toISOString() })) } });
    }
    if (request.method() !== "GET") return route.abort("blockedbyclient");
    if (path === "/health") return route.fulfill({ json: { status: "UP" } });
    if (path === "/version") return route.fulfill({ json: { version: "0.1.0-validation", compatibleFrontendVersion: "0.1.0-validation", offlineCapabilities: {
      protocolVersions: [2], commandReceipts: state.ready, schemaReady: state.ready, receiptEntityTypes: state.ready ? ["BATCH_EVENT"] : [],
    } } });
    if (path === "/farm") return route.fulfill({ json: { id: 1, name: "Refresh fixture farm" } });
    if (path === "/offline/bootstrap") return route.fulfill({ json: { ...user, batches: [batch], dashboard: [], products: [], tasks: [], vaccinationPlans: {}, overviews: {}, events: {}, inputs: {} } });
    if (path === "/batches") return route.fulfill({ json: [batch] });
    if (path === "/batches/dashboard") return route.fulfill({ json: [{ batch, summary: { totalDeaths: state.deaths, healthRelatedDeaths: state.deaths,
      accidentalDeaths: 0, otherPopulationChanges: 0, healthIncidentCount: 0, activeAlertCount: 0, highestActiveAlertSeverity: null, lastRecordedEventDate: null, finance: null } }] });
    if (path === "/batches/35/overview") { state.overviewReads++; return route.fulfill({ json: { batch, latestIndicator: null, recentRecords: [], activeAlerts: [] } }); }
    if (path === "/batches/35") return route.fulfill({ json: batch });
    if (path === "/batches/35/selection-review/preview") return route.fulfill({ json: {
      periodStart: batch.hatchDate, periodEnd: "2026-11-25", asOfDate: "2026-11-25",
      // Deliberately old population: a separately cached report cannot overwrite the overview.
      batch: { batchId: 35, currentPopulationDisplay: "200 / 200" },
      population: { initialPopulation: 200, currentPopulation: 200, totalDeaths: state.deaths, reconciliationRequired: false,
        predation: 0, missing: 0, returned: 0, transfersOut: 0, transfersIn: 0, sales: 0, culling: 0, countCorrections: 0 },
      finance: null, sexComposition: null, productUse: [], healthEvents: [], dataAvailability: [],
    } });
    if (path === "/alerts/summary") return route.fulfill({ json: { activeTotal: 0 } });
    if (path === "/tasks/summary") return route.fulfill({ json: { open: 0, late: 0, today: 0, upcoming: 0, noDueDate: 0, completed: 0, cancelled: 0 } });
    if (path === "/tasks/handler-queue/summary") return route.fulfill({ json: { now: 0, upcoming: 0, completed: 0, vaccinationReminders: 0 } });
    if (path.includes("/page") || path === "/tasks/handler-queue" || path === "/farm-inputs") return route.fulfill({ json: emptyPage });
    return route.fulfill({ json: [] });
  });
  return { state, batch, user };
}

async function queueDeath(page: Page, user: { userId: number; farmId: number }) {
  await page.evaluate(async ({ user, operationId }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open("poultry-prophet-offline-v1"); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("outbox", "readwrite");
      tx.objectStore("outbox").put({ operationId, schemaVersion: 1, entityType: "BATCH_EVENT", userId: user.userId, farmId: user.farmId, batchId: 35,
        sequence: 1, status: "PENDING", attemptCount: 0, occurredAt: "2026-11-24T16:35:00Z", queuedAt: "2026-11-24T16:35:00Z",
        payload: { operationId, eventType: "HEALTH_DEATH", affectedCount: 50, eventDate: "2026-11-25", title: "Health-related death", details: "Signs noticed: Sip on" } });
      tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error);
    });
    db.close(); window.dispatchEvent(new Event("pp-offline-outbox-changed"));
  }, { user, operationId });
}

test("one-minute polling and Refresh update the detail without reloading or resetting a form", async ({ page, baseURL }) => {
  const { state, batch } = await fixture(page, baseURL);
  state.ready = true;
  await page.clock.install();
  await page.goto("/batches/35");
  await expect(page.getByText("200 / 200", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit derby date", exact: true }).click();
  const derbyDate = page.getByRole("dialog").getByLabel("Derby date", { exact: false });
  await derbyDate.fill("2026-12-25");
  batch.currentPopulation = 150; state.deaths = 50;
  const previous = state.overviewReads;
  await page.clock.fastForward(60_100);
  await expect(page.getByText("150 / 200", { exact: true })).toBeVisible();
  expect(state.overviewReads).toBe(previous + 1);
  await expect(derbyDate).toHaveValue("2026-12-25");
  await page.keyboard.press("Escape");
  batch.currentPopulation = 140; state.deaths = 60;
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.getByText("140 / 200", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

for (const role of ["HANDLER", "MANAGER"] as const) test(`${role}: pending deaths stay visible and a lost acknowledgement cannot deduct twice`, async ({ page, context, baseURL }) => {
  const { state, user } = await fixture(page, baseURL, role);
  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: "October Load Hatch", exact: true })).toBeVisible();
  await queueDeath(page, user);
  await expect(page.getByText("50 deaths awaiting sync", { exact: true })).toBeVisible();
  await expect(page.getByText("Server syncing is unavailable.", { exact: true })).toBeVisible();
  expect(state.sent).toEqual([]);
  await page.getByRole("link", { name: "October Load Hatch", exact: true }).click();
  await expect(page.getByText("200 / 200", { exact: true })).toBeVisible();
  await expect(page.getByText("Waiting to sync", { exact: true })).toBeVisible();
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect(page.getByRole("button", { name: "Refresh", exact: true })).toBeDisabled();
  await expect(page.getByText("200 / 200", { exact: true })).toBeVisible();
  state.ready = true; state.loseAcknowledgement = true;
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(() => state.sent.length, { timeout: 40_000 }).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.getByText("150 / 200", { exact: true })).toBeVisible();
  await expect.poll(() => state.sent.length, { timeout: 40_000 }).toBe(2);
  expect(state.sent).toEqual([operationId, operationId]);
  await expect(page.getByText("50 deaths awaiting sync", { exact: true })).toHaveCount(0);
  await expect(page.getByText("150 / 200", { exact: true })).toBeVisible();
  const summary = page.getByRole("heading", { name: "Batch summary", exact: true }).locator("..");
  await expect(summary).toContainText("Total deaths50");
  await expect(page.getByText("Server syncing is unavailable.", { exact: true })).toHaveCount(0);
  if (role === "HANDLER") {
    await summary.scrollIntoViewIfNeeded();
    await page.screenshot({ path: "../refresh-handler-mobile.png", fullPage: true });
  }
});

test("offline report snapshots retain their period and cannot cross user, farm, role or deleted batch boundaries", async ({ page }) => {
  await page.route("http://offline.test/**", route => route.fulfill({ contentType: "text/html", body: "<html></html>" }));
  const source = ts.transpileModule(readFileSync("lib/offline-db.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  await page.goto("http://offline.test/");
  await page.addScriptTag({ content: `window.offlineDb={};(function(exports){${source}})(window.offlineDb);` });
  const result = await page.evaluate(async () => {
    const db = (window as unknown as { offlineDb: Record<string, (...args: unknown[]) => Promise<unknown>> }).offlineDb;
    const period = { periodStart: "2026-11-19", periodEnd: "2026-11-25" };
    await db.saveSelectionReviewSnapshot(8, 1, 35, { population: 150 }, period, "MANAGER");
    const own = await db.getSelectionReviewSnapshot(8, 1, 35, period, "MANAGER");
    const misses = await Promise.all([
      db.getSelectionReviewSnapshot(9, 1, 35, period, "MANAGER"), db.getSelectionReviewSnapshot(8, 2, 35, period, "MANAGER"),
      db.getSelectionReviewSnapshot(8, 1, 35, period, "HANDLER"), db.getSelectionReviewSnapshot(8, 1, 35, undefined, "MANAGER"),
    ]);
    await db.removeDeletedBatchSnapshots(8, 1, 35);
    return { own, misses, deleted: await db.getSelectionReviewSnapshot(8, 1, 35, period, "MANAGER") };
  });
  expect(result).toEqual({ own: { population: 150 }, misses: [null, null, null, null], deleted: null });
});
