import { expect, test } from "@playwright/test";
test.setTimeout(60_000);
test.use({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });
const user = { userId: 2, email: "manager@example.test", fullName: "Fixture Manager", role: "MANAGER", farmId: 1 };
const batch = { id: 2, farmId: 1, name: "Synthetic schedule batch", currentPopulation: 20, initialPopulation: 20, populationStatus: "VALID", hatchDate: "2026-11-01", startDate: "2026-11-01", stageName: "Brooding", status: "ACTIVE", handlerUserIds: [] };

for (const ready of [true, false]) test(`online mobile schedule creation persists one create-and-assign command without a separate program POST (ready=${ready})`, async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const sent: Array<{operationId: string; entityType: string; payload: Record<string, unknown>}> = [];
  const unexpectedWrites: string[] = [];
  await page.addInitScript(profile => localStorage.setItem("pp_auth_session", JSON.stringify({ sessionId: "schedule-command-fixture", user: profile })), user);
  await page.route("**/*", async route => {
    const request = route.request(); const url = new URL(request.url());
    if (url.origin !== origin) return route.abort("blockedbyclient");
    if (!url.pathname.startsWith("/api/backend/")) return ["GET", "HEAD"].includes(request.method()) ? route.continue() : route.abort("blockedbyclient");
    const path = url.pathname.slice("/api/backend".length);
    if (path === "/auth/refresh") return route.fulfill({ json: { ...user, token: "fixture-token" } });
    if (path === "/sync/v2/operations") {
      const operations = request.postDataJSON().operations;
      sent.push(...operations);
      return route.fulfill({ json: { results: operations.map((item: {operationId: string}) => ({ operationId: item.operationId, status: "RETRYABLE", message: "Synthetic pending command" })) } });
    }
    if (request.method() !== "GET") { unexpectedWrites.push(path); return route.abort("blockedbyclient"); }
    if (path === "/health") return route.fulfill({ json: { status: "UP" } });
    if (path === "/version") return route.fulfill({ json: ready ? { version: "fixture", offlineCapabilities: { protocolVersions: [2], commandReceipts: true, schemaReady: true, receiptEntityTypes: ["SELECTION_SESSION_UPDATE", "VACCINATION_SCHEDULE"] } } : { version: "older-fixture" } });
    if (path === "/farm") return route.fulfill({ json: { id: 1, name: "Fixture Farm" } });
    if (path === "/batches") return route.fulfill({ json: [batch] });
    if (path === "/batches/2") return route.fulfill({ json: batch });
    if (path === "/batches/2/overview") return route.fulfill({ json: { batch, latestIndicator: null, recentRecords: [], activeAlerts: [] } });
    if (path === "/offline/bootstrap") return route.fulfill({ json: { ...user, batches: [batch], dashboard: [], products: [], tasks: [], vaccinationPlans: {}, overviews: {}, events: {}, inputs: {} } });
    if (path === "/alerts/summary") return route.fulfill({ json: { activeTotal: 0, critical: 0, warning: 0, info: 0 } });
    if (path.endsWith("/selection-review/preview")) return route.fulfill({ status: 503, json: { message: "Not needed by schedule fixture" } });
    if (path.endsWith("/summary")) return route.fulfill({ json: {} });
    if (path.endsWith("/page")) return route.fulfill({ json: { items: [], page: 0, size: 20, totalItems: 0, totalPages: 0 } });
    return route.fulfill({ json: [] });
  });
  await page.goto("/batches/2");
  await page.getByRole("button", { name: "Set vaccination schedule", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Set batch vaccination schedule" });
  await dialog.getByLabel("Schedule name").fill("Synthetic one-command schedule");
  const vaccines = dialog.getByLabel("Vaccine name", { exact: true });
  for (let index = 0; index < await vaccines.count(); index++) await vaccines.nth(index).fill(`Fixture vaccine ${index + 1}`);
  await dialog.getByRole("button", { name: /Save and assign/ }).click();
  await expect(dialog).toHaveCount(0);
  if (!ready) {
    const readQueued = () => page.evaluate(async () => {
      const request = indexedDB.open("poultry-prophet-offline-v1");
      const db = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      try {
        const read = db.transaction("outbox").objectStore("outbox").getAll();
        return await new Promise<Array<{ status: string; operationId: string; payload: Record<string, unknown> }>>((resolve, reject) => { read.onsuccess = () => resolve(read.result); read.onerror = () => reject(read.error); });
      } finally { db.close(); }
    });
    await expect.poll(async () => (await readQueued())[0]?.status, { timeout: 15_000 }).toBe("RETRY_WAIT");
    const [saved] = await readQueued();
    expect(saved.payload).toMatchObject({ action: "CREATE_AND_ASSIGN", operationId: saved.operationId });
    expect(sent).toHaveLength(0); expect(unexpectedWrites).toHaveLength(0);
    await page.reload();
    expect((await readQueued())[0].payload).toEqual(saved.payload);
    return;
  }
  await expect.poll(() => sent.length, { timeout: 15_000 }).toBeGreaterThan(0);
  expect(unexpectedWrites).toEqual([]);
  expect(sent[0]).toMatchObject({ entityType: "VACCINATION_SCHEDULE", payload: { action: "CREATE_AND_ASSIGN", replace: false, program: { name: "Synthetic one-command schedule" }, operationId: sent[0].operationId } });
});
