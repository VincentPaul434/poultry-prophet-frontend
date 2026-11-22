import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block", viewport: { width: 320, height: 721 } });
test.setTimeout(60_000);

for (const [choice, observation, expectedDetails] of [
  ["Signs noticed", "SIGNS", "Signs noticed: Weak and coughing\nOriginal note"],
  ["No signs noticed", "NO_SIGNS", "No signs noticed.\nOriginal note"],
  ["Not observed / unknown", "UNKNOWN", "Signs not observed / unknown.\nOriginal note"],
] as const) test(`repairs a rejected legacy death with ${choice} and resends it`, async ({ page, context, baseURL }) => {
  if (!baseURL || new URL(baseURL).hostname !== "localhost") throw new Error("Requires localhost");
  const origin = new URL(baseURL).origin;
  const user = { userId: 8, farmId: 1, role: "HANDLER", email: "fixture@example.test", fullName: "Fixture Handler" };
  const sent: Array<{ operationId: string; payload: Record<string, unknown> }> = [];
  let simulatedOffline = false;
  await page.addInitScript((profile) => {
    localStorage.setItem("pp_auth_session", JSON.stringify({ sessionId: "death-recovery-fixture", user: profile }));
    localStorage.setItem("pp_language", "en");
  }, user);
  await page.route("**/*", async (route) => {
    const request = route.request(); const url = new URL(request.url());
    if (url.origin !== origin) return route.abort("blockedbyclient");
    if (!url.pathname.startsWith("/api/backend/")) return ["GET", "HEAD"].includes(request.method()) ? route.continue() : route.abort("blockedbyclient");
    const path = url.pathname.slice("/api/backend".length);
    if (simulatedOffline) return route.abort("internetdisconnected");
    if (path === "/auth/refresh" && request.method() === "POST") return route.fulfill({ json: { ...user, token: "fixture-token" } });
    if (path === "/sync/v2/operations" && request.method() === "POST") {
      const operations = request.postDataJSON().operations as typeof sent;
      sent.push(...operations);
      return route.fulfill({ json: { results: operations.map((item) => ({ operationId: item.operationId, status: "APPLIED", serverId: 91 })) } });
    }
    if (request.method() !== "GET") return route.abort("blockedbyclient");
    if (path === "/farm") return route.fulfill({ json: { id: 1, name: "Fixture farm" } });
    if (path === "/health") return route.fulfill({ json: { status: "UP" } });
    if (path === "/version") return route.fulfill({ json: { version: "test", offlineCapabilities: { protocolVersions: [2], commandReceipts: true, schemaReady: true, receiptEntityTypes: ["BATCH_EVENT"] } } });
    if (path === "/offline/bootstrap") return route.fulfill({ json: { userId: 8, farmId: 1, batches: [], dashboard: [], products: [], tasks: [], vaccinationPlans: {}, overviews: {}, events: {}, inputs: {} } });
    if (path === "/alerts/summary") return route.fulfill({ json: { activeTotal: 0, critical: 0, warning: 0, info: 0 } });
    if (path === "/tasks/summary") return route.fulfill({ json: { open: 0, late: 0, today: 0, upcoming: 0, noDueDate: 0, completed: 0, cancelled: 0 } });
    if (path === "/tasks/handler-queue/summary") return route.fulfill({ json: { now: 0, upcoming: 0, completed: 0, vaccinationReminders: 0 } });
    if (path === "/tasks/handler-queue") return route.fulfill({ json: { items: [], page: 0, size: 10, totalItems: 0, totalPages: 0, hasPrevious: false, hasNext: false } });
    return route.fulfill({ json: [] });
  });
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Batches" })).toBeVisible();
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open("poultry-prophet-offline-v1"); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    await new Promise<void>((resolve, reject) => { const tx = db.transaction("outbox", "readwrite"); tx.objectStore("outbox").put({ operationId: "d13f40a2-7ca6-4f72-a987-7db8a13014e2", schemaVersion: 1, entityType: "BATCH_EVENT", userId: 8, farmId: 1, batchId: 42, occurredAt: "2026-01-01T00:00:00Z", queuedAt: "2026-01-01T00:00:00Z", sequence: 1, status: "REJECTED", attemptCount: 1, lastErrorMessage: "Describe the signs noticed", payload: { eventType: "HEALTH_DEATH", title: "Health-related death", operationId: "d13f40a2-7ca6-4f72-a987-7db8a13014e2", affectedCount: 2, eventDate: "2026-01-01", details: "Signs noticed: \nOriginal note" } }); tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error); });
    db.close(); window.dispatchEvent(new Event("pp-offline-outbox-changed"));
  });
  if (observation === "UNKNOWN") {
    simulatedOffline = true;
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  }
  await page.getByRole("button", { name: /1 needs help/i }).click();
  const dialog = page.getByRole("dialog", { name: "Records needing attention" });
  await dialog.getByRole("button", { name: "Add observation" }).click();
  await dialog.getByRole("radio", { name: choice, exact: true }).check();
  if (observation === "SIGNS") {
    await dialog.getByRole("button", { name: "Save and send" }).click();
    await expect(dialog.getByRole("alert")).toContainText("Describe the signs");
    expect(sent).toHaveLength(0);
    const status = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open("poultry-prophet-offline-v1"); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
      return await new Promise<string>((resolve, reject) => { const r = db.transaction("outbox").objectStore("outbox").get("d13f40a2-7ca6-4f72-a987-7db8a13014e2"); r.onsuccess = () => resolve(r.result.status); r.onerror = () => reject(r.error); });
    });
    expect(status).toBe("REJECTED");
    await dialog.getByLabel("Describe the signs").fill("Weak and coughing");
  } else await expect(dialog.getByLabel("Describe the signs")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Save and send" }).click();
  if (observation === "UNKNOWN") {
    await expect.poll(() => page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open("poultry-prophet-offline-v1"); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
      return await new Promise<string>((resolve, reject) => { const r = db.transaction("outbox").objectStore("outbox").get("d13f40a2-7ca6-4f72-a987-7db8a13014e2"); r.onsuccess = () => resolve(r.result?.status); r.onerror = () => reject(r.error); });
    })).toBe("PENDING");
    expect(sent).toHaveLength(0);
    simulatedOffline = false;
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
  }
  await expect.poll(() => sent.length, { timeout: 40_000 }).toBe(1);
  expect(sent[0]).toMatchObject({ operationId: "d13f40a2-7ca6-4f72-a987-7db8a13014e2", payload: { eventType: "HEALTH_DEATH", affectedCount: 2, eventDate: "2026-01-01", deathObservation: observation, deathSigns: observation === "SIGNS" ? "Weak and coughing" : null, details: expectedDetails } });
  await expect.poll(() => page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open("poultry-prophet-offline-v1"); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    return await new Promise<boolean>((resolve, reject) => { const r = db.transaction("outbox").objectStore("outbox").get("d13f40a2-7ca6-4f72-a987-7db8a13014e2"); r.onsuccess = () => resolve(r.result == null); r.onerror = () => reject(r.error); });
  })).toBe(true);
});
