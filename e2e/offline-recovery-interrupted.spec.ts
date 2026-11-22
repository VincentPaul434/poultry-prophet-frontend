import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });
test.setTimeout(125_000);

test("an interrupted offline sync is retried after its lease expires and keeps the record", async ({ page, context, baseURL }) => {
  if (!baseURL || new URL(baseURL).hostname !== "localhost") throw new Error("This isolated test requires localhost");
  const origin = new URL(baseURL).origin;
  const profile = { userId: 7, farmId: 1, role: "MANAGER", email: "manager@example.test", fullName: "Fixture Manager" };
  const alert = { id: 81, batchId: 42, sourceEventId: null, indicatorId: null, indicatorType: "HEALTH_DEATH", batchName: "Fixture flock", handlerName: null, deathCount: 1, cause: null, occurrenceDate: "2026-11-19", severity: "WARNING", message: "Fixture batch needs health review", acknowledged: false, acknowledgedByUserId: null, acknowledgedAt: null, acknowledgmentNote: null, createdAt: "2026-11-19T00:00:00Z" };
  const reminder = { cycleId: 12, cycleName: "Fixture hatch", expectedHatchDate: "2026-11-19", actualHatchDate: null, hatchedCount: null, kind: "HATCH_DUE_TODAY", asOfDate: "2026-11-19" };
  let syncRequests = 0;
  let releaseFirst!: () => void;
  let signalFirst!: () => void;
  const firstRequest = new Promise<void>(resolve => { signalFirst = resolve; });
  const holdFirst = new Promise<void>(resolve => { releaseFirst = resolve; });
  const sent: string[] = [];
  const blocked: string[] = [];
  await context.addInitScript((user) => {
    if (!localStorage.getItem("pp_auth_session")) localStorage.setItem("pp_auth_session", JSON.stringify({ sessionId: "fixture-expired", user, authRequired: true }));
    localStorage.setItem("pp_language", "en");
  }, profile);
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== origin) { blocked.push("external request"); return route.abort("blockedbyclient"); }
    if (!url.pathname.startsWith("/api/backend/")) {
      if (!["GET", "HEAD"].includes(request.method())) { blocked.push("unexpected local write"); return route.abort("blockedbyclient"); }
      return route.continue();
    }
    const path = url.pathname.slice("/api/backend".length);
    sent.push(`${request.method()} ${path}`);
    if (path === "/auth/login" && request.method() === "POST") {
      expect(request.postDataJSON()).toEqual({ email: profile.email, password: "fixture-password" });
      return route.fulfill({ json: { ...profile, token: "fixture-access" } });
    }
    if (path === "/auth/refresh" && request.method() === "POST") return route.fulfill({ json: { ...profile, token: "fixture-access" } });
    if (path === "/sync/v2/operations" && request.method() === "POST") {
      const operations = request.postDataJSON().operations;
      expect(operations.map((item: { operationId: string }) => item.operationId)).toEqual(["11111111-1111-4111-8111-111111111111"]);
      syncRequests++;
      if (syncRequests === 1) { signalFirst(); await holdFirst; }
      return route.fulfill({ status: 503, json: { message: "Fixture service unavailable" } }).catch(() => undefined);
    }
    if (request.method() !== "GET") { blocked.push(`unexpected API write ${path}`); return route.abort("blockedbyclient"); }
    if (path === "/alerts/page") return route.fulfill({ json: { items: [alert], page: 0, size: 20, totalItems: 1, totalPages: 1, hasPrevious: false, hasNext: false } });
    if (path === "/alerts/summary") return route.fulfill({ json: { activeTotal: 1, critical: 0, warning: 1, info: 0 } });
    if (path === "/alerts") return route.fulfill({ json: [alert] });
    if (path === "/incubation-cycles/attention") return route.fulfill({ json: [reminder] });
    if (path === "/batches") return route.fulfill({ json: [{ id: 42, name: "Fixture flock", status: "ACTIVE" }] });
    if (path === "/batches/dashboard" || path === "/batches/archived" || path === "/invites/pending") return route.fulfill({ json: [] });
    if (path === "/farm") return route.fulfill({ json: { id: 1, name: "Fixture farm", location: null, description: null } });
    if (path === "/version") return route.fulfill({ json: { application: "poultry-prophet", version: "test", environment: "test", offlineCapabilities: { protocolVersions: [2], commandReceipts: true, schemaReady: true, receiptEntityTypes: ["BATCH_EVENT"] } } });
    if (path === "/health") return route.fulfill({ json: { status: "UP" } });
    if (path === "/offline/bootstrap") return route.fulfill({ json: { userId: 7, farmId: 1, batches: [], dashboard: [], products: [], tasks: [], vaccinationPlans: {}, overviews: {}, events: {}, inputs: {} } });
    return route.fulfill({ status: 404, json: { message: "Unexpected fixture request" } });
  });
  await page.goto("/alerts", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Sign in to view alerts" })).toBeVisible({ timeout: 45_000 });
  const saved = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const req = indexedDB.open("poultry-prophet-offline-v1"); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
    const record = { operationId: "22222222-2222-4222-8222-222222222222", schemaVersion: 1, entityType: "BATCH_EVENT", userId: 7, farmId: 1, batchId: 42, status: "CONFLICT", attemptCount: 1, sequence: 1, occurredAt: "2026-11-19T00:00:00Z", queuedAt: "2026-11-19T00:00:00Z", payload: { note: "Keep offline data" } };
    const pending = { ...record, operationId: "11111111-1111-4111-8111-111111111111", batchId: 43, status: "PENDING", attemptCount: 0, sequence: 2, payload: { note: "Keep pending data" } };
    await new Promise<void>((resolve, reject) => { const tx = db.transaction("outbox", "readwrite"); tx.objectStore("outbox").put(record); tx.objectStore("outbox").put(pending); tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error); });
    db.close(); return { record, pending };
  });
  await page.getByRole("link", { name: "Sign in again", exact: true }).click();
  await expect(page).toHaveURL(/\/login(?:[?#].*)?$/);
  // The dev server can show the server-rendered form before React is ready.
  // Verify an interactive control responds before submitting credentials.
  const passwordInput = page.getByLabel(/^password$/i);
  await expect(async () => {
    if (await passwordInput.getAttribute("type") === "password") await page.getByRole("button", { name: "Show password" }).click();
    await expect(passwordInput).toHaveAttribute("type", "text", { timeout: 1_000 });
  }).toPass({ timeout: 45_000 });
  await page.getByLabel(/^(email|email address)$/i).fill(profile.email);
  await passwordInput.fill("fixture-password");
  await page.getByRole("button", { name: /^(mag-sign in|sign in|log in|login)$/i }).click();
  await expect(page).toHaveURL(/\/dashboard(?:[?#].*)?$/);
  await firstRequest;
  await page.goto("/alerts", { waitUntil: "domcontentloaded" });
  releaseFirst();
  await expect(page.getByText("Fixture batch needs health review")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText("Fixture hatch", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Review hatch" })).toHaveAttribute("href", "/incubation?cycleId=12");
  await expect(page.getByRole("link", { name: "View batch" })).toHaveAttribute("href", "/batches/42");
  const after = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const req = indexedDB.open("poultry-prophet-offline-v1"); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
    const read = (id: string) => new Promise<unknown>((resolve, reject) => { const req = db.transaction("outbox").objectStore("outbox").get(id); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
    const record = await read("22222222-2222-4222-8222-222222222222");
    const pending = await read("11111111-1111-4111-8111-111111111111");
    db.close(); return { record, pending };
  });
  expect(after.record).toEqual(saved.record);
  expect(after.pending).toMatchObject({ operationId: saved.pending.operationId, userId: 7, farmId: 1, batchId: 43, payload: saved.pending.payload });
  await expect.poll(() => sent.includes("POST /sync/v2/operations"), { timeout: 15_000 }).toBe(true);
  const pendingStatus = () => page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const req = indexedDB.open("poultry-prophet-offline-v1"); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
    const record = await new Promise<{ status: string }>((resolve, reject) => { const req = db.transaction("outbox").objectStore("outbox").get("11111111-1111-4111-8111-111111111111"); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
    db.close(); return record?.status;
  });
  // A browser may finish the first failed request after navigation; wait for
  // the subsequent retry before checking its retained state.
  await expect.poll(() => syncRequests, { timeout: 80_000 }).toBeGreaterThanOrEqual(2);
  await expect.poll(pendingStatus, { timeout: 80_000 }).toBe("RETRY_WAIT");
  const pendingAfterFailure = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const req = indexedDB.open("poultry-prophet-offline-v1"); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
    const record = await new Promise<unknown>((resolve, reject) => { const req = db.transaction("outbox").objectStore("outbox").get("11111111-1111-4111-8111-111111111111"); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
    db.close(); return record;
  });
  expect(pendingAfterFailure).toMatchObject({ operationId: saved.pending.operationId, userId: 7, farmId: 1, batchId: 43, status: "RETRY_WAIT", payload: saved.pending.payload });
  expect(syncRequests).toBeGreaterThanOrEqual(2);
  expect(sent).toContain("POST /auth/login");
  expect(sent).toContain("GET /alerts/page");
  expect(sent).toContain("GET /incubation-cycles/attention");
  expect(blocked).toEqual([]);
});
