import { expect, test, type Page } from "@playwright/test";

test.use({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });
test.setTimeout(60_000);
const user = { userId: 2, email: "handler@example.test", fullName: "Fixture Handler", role: "HANDLER", farmId: 1 };
const batch = { id: 2, farmId: 1, name: "Synthetic capture batch", currentPopulation: 20, initialPopulation: 20, populationStatus: "VALID", hatchDate: "2026-11-01", startDate: "2026-11-01", stageName: "Brooding", status: "ACTIVE", handlerUserIds: [2] };
const product = { id: 9, brandName: "Fixture feed", productType: "FEED", stockUnit: "kg", stockOnHand: 100, active: true, demoStockHistory: false };
const empty = { items: [], page: 0, size: 20, totalItems: 0, totalPages: 0, hasPrevious: false, hasNext: false };

async function outbox(page: Page) {
  return page.evaluate(async () => {
    const request = indexedDB.open("poultry-prophet-offline-v1");
    const db = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    try {
      const get = db.transaction("outbox").objectStore("outbox").getAll();
      return await new Promise<Array<{ operationId: string; payload: Record<string, unknown>; occurredAt: string; status: string }>>((resolve, reject) => { get.onsuccess = () => resolve(get.result); get.onerror = () => reject(get.error); });
    } finally { db.close(); }
  });
}

async function setup(page: Page, origin: string, state: { reachable: boolean; attempts: Array<Record<string, unknown>>; persistedAtSend: boolean[]; directWrites: number }) {
  await page.addInitScript(profile => {
    if (!localStorage.getItem("pp_auth_session")) localStorage.setItem("pp_auth_session", JSON.stringify({ sessionId: "durable-product-fixture", user: profile }));
    localStorage.setItem("pp_language", "en");
  }, user);
  // No writes may reach the real backend, including unexpected endpoints.
  await page.route("**/*", async route => {
    const request = route.request(); const url = new URL(request.url());
    if (url.origin !== origin) return route.abort("blockedbyclient");
    if (!url.pathname.startsWith("/api/backend/")) return ["GET", "HEAD"].includes(request.method()) ? route.continue() : route.abort("blockedbyclient");
    const path = url.pathname.slice("/api/backend".length);
    if (path === "/auth/refresh") return route.fulfill({ json: { ...user, token: "fixture-token" } });
    if (path === "/sync/v2/operations" && request.method() === "POST") {
      const operations = request.postDataJSON().operations as Array<Record<string, unknown>>;
      state.attempts.push(...operations);
      const records = await outbox(page);
      state.persistedAtSend.push(operations.every(item => records.some(record => record.operationId === item.operationId && record.status === "SYNCING")));
      if (state.attempts.length === 1) return route.abort("connectionreset");
      return route.fulfill({ json: { results: operations.map(item => ({ operationId: item.operationId, status: "ALREADY_APPLIED", serverId: 100, serverTime: "2026-11-22T00:00:00Z" })) } });
    }
    if (request.method() !== "GET") { state.directWrites++; return route.abort("blockedbyclient"); }
    if (path === "/health") return route.fulfill({ status: state.reachable ? 200 : 503, json: { status: state.reachable ? "UP" : "DOWN" } });
    if (path === "/farm") return route.fulfill({ json: { id: 1, name: "Fixture farm" } });
    if (path === "/version") return route.fulfill({ json: { version: "test", offlineCapabilities: { protocolVersions: [2], commandReceipts: true, schemaReady: true, receiptEntityTypes: ["FARM_INPUT"] } } });
    if (path === "/inventory/products") return route.fulfill({ json: [product] });
    if (path === "/batches") return route.fulfill({ json: [batch] });
    if (path === "/batches/2") return route.fulfill({ json: batch });
    if (path === "/batches/2/overview") return route.fulfill({ json: { batch, latestIndicator: null, recentRecords: [], activeAlerts: [] } });
    if (path === "/offline/bootstrap") return route.fulfill({ json: { ...user, batches: [batch], dashboard: [], products: [product], tasks: [], vaccinationPlans: {}, overviews: {}, events: {}, inputs: {} } });
    if (path === "/alerts/summary") return route.fulfill({ json: { activeTotal: 0, critical: 0, warning: 0, info: 0 } });
    if (path.endsWith("/summary")) return route.fulfill({ json: { now: 0, upcoming: 0, overdue: 0, completed: 0 } });
    if (path.endsWith("/page") || path === "/tasks/handler-queue") return route.fulfill({ json: empty });
    if (path.endsWith("/selection-review/preview")) return route.fulfill({ status: 503, json: { message: "Not required in fixture" } });
    return route.fulfill({ json: [] });
  });
  await page.goto("/batches/2/data-entry?from=batch");
  await page.getByRole("button", { name: "Feed or medicine used" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Product from farm stock").selectOption("9");
  await dialog.getByLabel(/Units used/).fill("1");
}

test("mobile product capture survives unavailable API, reload and lost acknowledgement with the same intent", async ({ page, baseURL }) => {
  const state = { reachable: false, attempts: [] as Array<Record<string, unknown>>, persistedAtSend: [] as boolean[], directWrites: 0 };
  await setup(page, new URL(baseURL!).origin, state);
  await page.getByRole("button", { name: "Save product record" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect.poll(async () => (await outbox(page)).length).toBe(1);
  const [saved] = await outbox(page);
  expect(saved.payload).toMatchObject({ batchId: 2, farmProductId: 9, quantity: 1, brandName: "Fixture feed" });
  expect(saved.payload.recordedAt).toBe(saved.occurredAt);
  expect(state.directWrites).toBe(0);
  await page.reload();
  expect((await outbox(page))[0]).toEqual(saved);
  state.reachable = true;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(() => state.attempts.length, { timeout: 40_000 }).toBeGreaterThanOrEqual(2);
  expect(state.attempts[0]).toEqual(state.attempts[1]);
  expect(state.attempts[0]).toMatchObject({ operationId: saved.operationId, payload: saved.payload, occurredAt: saved.occurredAt });
  expect(state.persistedAtSend).toEqual([true, true]);
  await expect.poll(async () => (await outbox(page)).length).toBe(0);
  expect(state.directWrites).toBe(0);
});

test("mobile product form stays open and unsaved when its local commit aborts", async ({ page, baseURL }) => {
  const state = { reachable: true, attempts: [] as Array<Record<string, unknown>>, persistedAtSend: [] as boolean[], directWrites: 0 };
  await setup(page, new URL(baseURL!).origin, state);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore["put"]>) {
      const request = original.apply(this, args);
      if (this.name === "outbox") request.addEventListener("success", () => this.transaction.abort());
      return request;
    };
  });
  await page.getByRole("button", { name: "Save product record" }).click();
  await expect(page.getByRole("dialog").getByText(/Offline storage transaction was aborted/)).toBeVisible();
  expect(await outbox(page)).toHaveLength(0);
  expect(state.attempts).toHaveLength(0);
  expect(state.directWrites).toBe(0);
});
