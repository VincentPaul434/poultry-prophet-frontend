import { expect, test, type Page } from "@playwright/test";

test.use({ serviceWorkers: "block" });
const manager = { userId: 7, email: "manager@example.test", fullName: "Fixture Manager", role: "MANAGER", farmId: 1 };
const emptyPage = { items: [], page: 0, size: 10, totalItems: 0, totalPages: 0, hasPrevious: false, hasNext: false };
const product = { id: 9, brandName: "Test vaccine", productType: "VACCINE", stockUnit: "vial", stockOnHand: 10, averageUnitCost: 10, valuationStatus: "VALUED", active: true, allowFractionalQuantity: false, lowStock: false };
const dose = { id: 31, batchId: 35, vaccineName: "Test vaccine", farmProductId: 9, ageDay: 7, dueDate: "2026-11-08", status: "SCHEDULED", displayState: "OVERDUE" };

async function setup(page: Page, origin: string, archived = false, loseProductResponse = false) {
  const calls: { path: string; key?: string; payload: unknown }[] = [];
  const batch = { id: 35, farmId: 1, name: "Test batch", initialPopulation: 200, currentPopulation: 200,
    populationStatus: "VALID", startDate: "2026-11-01", hatchDate: "2026-11-01", farmEntryDate: "2026-11-01",
    stageName: "Brooding", status: archived ? "ARCHIVED" : "ACTIVE", handlerUserIds: [] };
  await page.addInitScript(user => {
    localStorage.setItem("pp_auth_session", JSON.stringify({ sessionId: "ui-critical-fixture", user }));
    localStorage.setItem("pp_language", "en");
  }, manager);
  await page.route("**/*", async route => {
    const request = route.request(); const url = new URL(request.url());
    if (url.origin !== origin) return route.abort("blockedbyclient");
    if (!url.pathname.startsWith("/api/backend/")) return ["GET", "HEAD"].includes(request.method()) ? route.continue() : route.abort("blockedbyclient");
    const path = url.pathname.slice("/api/backend".length);
    if (path === "/auth/refresh") return route.fulfill({ json: { ...manager, token: "fixture" } });
    if (path === "/inventory/products" && request.method() === "POST") {
      const payload = request.postDataJSON();
      calls.push({ path, key: request.headers()["idempotency-key"], payload });
      if (loseProductResponse && calls.filter((call) => call.path === path).length === 1) return route.abort("connectionreset");
      return route.fulfill({ json: { id: 77, ...payload } });
    }
    if (request.method() === "POST" && path === "/financial-transactions/11/corrections") {
      const payload = request.postDataJSON();
      calls.push({ path, key: payload.operationId, payload });
      if (calls.filter((call) => call.path === path).length === 1) return route.abort("connectionreset");
      return route.fulfill({ json: { id: 112, batchId: 35, ...payload } });
    }
    if (request.method() === "POST" && path === "/manager-operations/resolve") {
      const payload = request.postDataJSON();
      calls.push({ path, key: payload.operationId, payload });
      return route.fulfill({ json: { status: "CANCELLED" } });
    }
    if (request.method() === "POST" && (path === "/financial-transactions" || path === "/inventory/products/9/stock-ins")) {
      const payload = request.postDataJSON();
      calls.push({ path, key: request.headers()["idempotency-key"] ?? payload.operationId, payload });
      if (calls.filter((call) => call.path === path).length === 1) return route.abort("connectionreset");
      return route.fulfill({ json: { id: 100, ...payload } });
    }
    if (request.method() !== "GET") return route.abort("blockedbyclient");
    if (path === "/farm") return route.fulfill({ json: { id: 1, name: "Fixture farm" } });
    if (path === "/health") return route.fulfill({ json: { status: "UP" } });
    if (path === "/version") return route.fulfill({ json: { version: "test" } });
    if (path === "/offline/bootstrap") return route.fulfill({ json: { ...manager, batches: [batch], dashboard: [], products: [product], tasks: [], vaccinationPlans: {}, overviews: {}, events: {}, inputs: {} } });
    if (path === "/batches/35/overview") return route.fulfill({ json: { batch, latestIndicator: null, recentRecords: [], activeAlerts: [] } });
    if (path === "/batches/35") return route.fulfill({ json: batch });
    if (path === "/batches/35/retirement-impact") return route.fulfill({ json: { canDelete: false, canArchive: true, deleteBlockers: [], recordCounts: {}, openTaskCount: 0 } });
    if (path.endsWith("/selection-review/preview")) return route.fulfill({ status: 503, json: { message: "Not needed for this fixture" } });
    if (path === "/batches/35/vaccination-plan") return route.fulfill({ json: [dose] });
    if (path === "/inventory/products") return route.fulfill({ json: [product] });
    if (path === "/inventory/pending-review") return route.fulfill({ json: Array.from({ length: 4 }, (_, index) => ({ id: index + 1, brandName: `Pending product ${index + 1}`, quantity: 2, unit: "vial" })) });
    if (path === "/inputs") return route.fulfill({ json: [{ id: 88, productType: "VACCINE", brandName: "Old untracked vaccine", recordedAt: "2026-11-01T00:00:00Z", quantity: 1, unit: "vial", inventoryStatus: "UNTRACKED", farmProductId: null }] });
    if (path === "/financial-transactions/page") {
      const current = Number(url.searchParams.get("page") ?? "0");
      const items = current === 0 ? Array.from({ length: 10 }, (_, index) => ({ id: index + 1, category: `Expense ${index + 1}`, amount: 10, currency: "PHP", transactionDate: "2026-11-01", sourceType: "MANUAL", updatedAt: "2026-11-01T00:00:00Z" })) : [{ id: 11, category: "Older expense", amount: 10, currency: "PHP", transactionDate: "2026-10-01", sourceType: "MANUAL", updatedAt: "2026-11-01T00:00:00Z" }];
      return route.fulfill({ json: { items, page: current, size: 10, totalItems: 11, totalPages: 2, hasPrevious: current > 0, hasNext: current === 0 } });
    }
    if (path === "/alerts/summary") return route.fulfill({ json: { activeTotal: 0, critical: 0, warning: 0, info: 0 } });
    if (path.endsWith("/page") || path.includes("/summary")) return route.fulfill({ json: emptyPage });
    return route.fulfill({ json: [] });
  });
  return calls;
}

test("manager can reach all pending stock reviews", async ({ page, baseURL }) => {
  await setup(page, new URL(baseURL!).origin);
  await page.goto("/inputs");
  await expect(page.getByText("Pending product 1", { exact: false })).toBeVisible();
  await expect(page.getByText("Pending product 4", { exact: false })).toBeVisible();
});

test("manager can see an unresolved inventory adjustment for safe recovery", async ({ page, baseURL }) => {
  await setup(page, new URL(baseURL!).origin);
  await page.goto("/inputs");
  await expect(page.getByRole("heading", { name: "Farm products and stock" })).toBeVisible();
  await page.evaluate(async () => {
    const request = indexedDB.open("poultry-prophet-manager-intents-v1", 1);
    const db = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("intents", "readwrite");
      tx.objectStore("intents").put({ key: JSON.stringify([7, 1, "STOCK_ADJUSTMENT", "9"]), userId: 7, farmId: 1, kind: "STOCK_ADJUSTMENT", targetId: "9", operationId: "00000000-0000-4000-8000-000000000077", payload: { quantityDelta: 2, reason: "Count correction" }, createdAt: "2026-11-25T00:00:00Z" });
      tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error);
    });
    db.close(); window.dispatchEvent(new Event("pp-manager-intents-changed"));
  });
  await expect(page.getByText(/Test vaccine.*Count correction/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry previous request" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Stop previous request" })).toBeVisible();
});

test("inventory distinguishes confirmed stock from a pending vaccine use", async ({ page, baseURL }) => {
  await setup(page, new URL(baseURL!).origin);
  await page.goto("/inputs");
  await expect(page.locator("article").filter({ hasText: "Test vaccine" })).toBeVisible();
  await page.evaluate(async () => {
    const open = indexedDB.open("poultry-prophet-offline-v1");
    const db = await new Promise<IDBDatabase>((resolve, reject) => { open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error); });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("outbox", "readwrite");
      tx.objectStore("outbox").put({ operationId: "00000000-0000-4000-8000-000000000098", schemaVersion: 1, userId: 7, farmId: 1, entityType: "VACCINATION_PLAN", batchId: 35, sequence: 1, status: "PENDING", attemptCount: 0, occurredAt: "2026-11-25T00:00:00Z", queuedAt: "2026-11-25T00:00:00Z", payload: { planId: 31, quantity: 2 } });
      tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error);
    });
    db.close(); window.dispatchEvent(new Event("pp-offline-outbox-changed"));
  });
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.getByText("Last confirmed stock. Some product records on this device may still be waiting to sync or need review.")).toBeVisible();
  await expect(page.locator("article").filter({ hasText: "Test vaccine" })).toContainText("10 vial");
});

test("manager can open an older expense for correction", async ({ page, baseURL }) => {
  await setup(page, new URL(baseURL!).origin);
  await page.goto("/batches/35");
  const section = page.getByRole("region", { name: "Batch expenses" });
  await expect(section.getByText("Expense 1 · 2026-11-01", { exact: true })).toBeVisible();
  await section.getByRole("button", { name: "Next" }).click();
  await expect(section.getByText("Older expense", { exact: false })).toBeVisible();
  await section.getByRole("button", { name: "Edit expense Older expense" }).click();
  await expect(page.getByRole("dialog", { name: "Edit batch expense" })).toBeVisible();
});

test("a lost correction response remains recoverable after reload", async ({ page, baseURL }) => {
  const calls = await setup(page, new URL(baseURL!).origin);
  await page.goto("/batches/35");
  const section = page.getByRole("region", { name: "Batch expenses" });
  await section.getByRole("button", { name: "Next" }).click();
  await section.getByRole("button", { name: "Edit expense Older expense" }).click();
  const dialog = page.getByRole("dialog", { name: "Edit batch expense" });
  await dialog.getByLabel("Amount (PHP)").fill("120");
  await dialog.getByLabel("Reason for correction").fill("Wrong amount");
  await dialog.getByRole("button", { name: "Save correction" }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await page.reload();
  await expect(section.getByText(/previous request.*unknown/i)).toBeVisible();
  await section.getByRole("button", { name: "Retry previous request" }).click();
  await expect.poll(() => calls.filter(call => call.path.endsWith("/11/corrections")).length).toBe(2);
  const attempts = calls.filter(call => call.path.endsWith("/11/corrections"));
  expect(attempts[0].key).toBeTruthy();
  expect(attempts[1]).toEqual(attempts[0]);
});

test("archived batch exposes vaccine history without record actions", async ({ page, baseURL }) => {
  await setup(page, new URL(baseURL!).origin, true);
  await page.goto("/batches/35");
  await expect(page.getByText("Review older untracked vaccine records")).toBeVisible();
  await expect(page.getByRole("button", { name: "Record Test vaccine" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Change schedule" })).toHaveCount(0);
});

test("vaccination requires explicitly entered quantity", async ({ page, baseURL }) => {
  await setup(page, new URL(baseURL!).origin);
  await page.goto("/batches/35");
  await page.getByRole("button", { name: "Record Test vaccine" }).click();
  const dialog = page.getByRole("dialog", { name: "Record Test vaccine" });
  const quantity = dialog.getByLabel("Units used (vial)");
  await expect(quantity).toHaveValue("");
  expect(await quantity.evaluate((element: HTMLInputElement) => element.checkValidity())).toBe(false);
});

test("vaccination reports local storage failure and preserves the form", async ({ page, baseURL }) => {
  await setup(page, new URL(baseURL!).origin);
  await page.goto("/batches/35");
  await page.getByRole("button", { name: "Record Test vaccine" }).click();
  const dialog = page.getByRole("dialog", { name: "Record Test vaccine" });
  await dialog.getByLabel("Units used (vial)").fill("1");
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore["put"]>) {
      const request = original.apply(this, args);
      if (this.name === "outbox") request.addEventListener("success", () => this.transaction.abort());
      return request;
    };
  });
  await dialog.getByRole("button", { name: "Record vaccination" }).click();
  await expect(dialog.getByRole("alert")).toContainText(/offline storage transaction was aborted/i);
  await expect(dialog.getByLabel("Units used (vial)")).toHaveValue("1");
});

test("a lost expense response is recoverable after reload without a new operation", async ({ page, baseURL }) => {
  const calls = await setup(page, new URL(baseURL!).origin);
  await page.goto("/batches/35");
  await page.getByRole("button", { name: "Add expense", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add batch expense" });
  await dialog.getByLabel("Category").fill("Transport");
  await dialog.getByLabel("Amount (PHP)").fill("100");
  await dialog.getByRole("button", { name: "Save expense" }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await page.reload();
  await expect(page.getByText(/previous request.*unknown/i)).toBeVisible();
  await page.getByRole("button", { name: "Retry previous request" }).click();
  await expect.poll(() => calls.filter(call => call.path === "/financial-transactions").length).toBe(2);
  const attempted = calls.filter(call => call.path === "/financial-transactions");
  expect(attempted[0].key).toBeTruthy();
  expect(attempted[1]).toEqual(attempted[0]);
});

test("manager can safely stop an uncertain expense after server fencing", async ({ page, baseURL }) => {
  const calls = await setup(page, new URL(baseURL!).origin);
  await page.goto("/batches/35");
  await page.getByRole("button", { name: "Add expense", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add batch expense" });
  await dialog.getByLabel("Category").fill("Transport");
  await dialog.getByLabel("Amount (PHP)").fill("100");
  await dialog.getByRole("button", { name: "Save expense" }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Stop previous request" }).click();
  const confirm = page.getByRole("dialog", { name: "Stop this request?" });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Confirm stop" }).click();
  await expect(confirm).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add expense", exact: true })).toBeEnabled();
  const first = calls.find(call => call.path === "/financial-transactions")!;
  const resolution = calls.find(call => call.path === "/manager-operations/resolve")!;
  expect(resolution.key).toBe(first.key);
  expect(resolution.payload).toMatchObject({kind:"FINANCE_CREATE",targetId:"35",operationId:first.key,payload:first.payload});
});

test("a lost stock addition is recoverable after reload without a new operation", async ({ page, baseURL }) => {
  const calls = await setup(page, new URL(baseURL!).origin);
  await page.goto("/inputs");
  await page.getByRole("button", { name: "Add stock" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Add stock" });
  await dialog.getByLabel("Quantity purchased").fill("5");
  await dialog.getByLabel("Price per vial").fill("10");
  await dialog.getByRole("button", { name: "Record purchase" }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await page.reload();
  await expect(page.getByText(/previous request.*unknown/i)).toBeVisible();
  await page.getByRole("button", { name: "Retry previous request" }).click();
  await expect.poll(() => calls.filter(call => call.path === "/inventory/products/9/stock-ins").length).toBe(2);
  const attempted = calls.filter(call => call.path === "/inventory/products/9/stock-ins");
  expect(attempted[0].key).toBeTruthy();
  expect(attempted[1]).toEqual(attempted[0]);
});

test("manager can create a whole-unit product and cannot start with fractional stock", async ({ page, baseURL }) => {
  const calls = await setup(page, new URL(baseURL!).origin);
  await page.goto("/inputs");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add farm product" });
  await dialog.getByLabel("Product / brand").fill("Whole vials");
  await dialog.getByLabel("Inventory unit").fill("vial");
  await dialog.getByLabel("Quantity precision").selectOption("whole");
  const opening = dialog.getByLabel("Starting stock (optional)", { exact: true });
  await opening.fill("1.5");
  expect(await opening.evaluate((element: HTMLInputElement) => element.checkValidity())).toBe(false);
  await opening.fill("2");
  await dialog.getByLabel(/Opening price per/).fill("10");
  await dialog.getByRole("button", { name: "Save product" }).click();
  await expect.poll(() => calls.filter(call => call.path === "/inventory/products").length).toBe(1);
  expect(calls.find(call => call.path === "/inventory/products")?.payload).toMatchObject({ brandName: "Whole vials", allowFractionalQuantity: false, openingQuantity: 2 });
});

test("a lost product creation response can be safely retried after reload", async ({ page, baseURL }) => {
  const calls = await setup(page, new URL(baseURL!).origin, false, true);
  await page.goto("/inputs");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add farm product" });
  await dialog.getByLabel("Product / brand").fill("Retry product");
  await dialog.getByLabel("Starting stock (optional)", { exact: true }).fill("2");
  await dialog.getByLabel(/Opening price per/).fill("10");
  await dialog.getByRole("button", { name: "Save product" }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await page.reload();
  await expect(page.getByText(/previous request.*unknown/i)).toBeVisible();
  await page.getByRole("button", { name: "Retry previous request" }).click();
  await expect.poll(() => calls.filter(call => call.path === "/inventory/products").length).toBe(2);
  const attempted = calls.filter(call => call.path === "/inventory/products");
  expect(attempted[0].key).toBeTruthy();
  expect(attempted[1]).toEqual(attempted[0]);
});
