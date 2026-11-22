import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block", viewport: { width: 320, height: 721 } });
test.setTimeout(90_000);

for (const role of ["MANAGER", "HANDLER"] as const) {
  test(`${role.toLowerCase()} batch cards use cached tasks and pending changes offline`, async ({ page, baseURL }) => {
    if (!baseURL || new URL(baseURL).hostname !== "localhost") throw new Error("The fixture requires localhost");
    const origin = new URL(baseURL).origin;
    const user = { userId: 18, farmId: 1, role, email: "fixture@example.test", fullName: "Fixture User" };
    const batches = [7, 8].map((id) => ({ id, farmId: 1, name: `Fixture batch ${id}`, initialPopulation: 30,
      currentPopulation: 25, populationStatus: "VALID", populationWarning: null, startDate: "2026-11-01",
      hatchDate: "2026-11-01", farmEntryDate: "2026-11-01", bloodline: "Fixture", source: null,
      stageId: 1, stageName: "Brooding", stageAuto: true, status: "ACTIVE", handlerUserIds: [18],
      createdAt: "2026-11-01T00:00:00Z" }));
    const dashboard = batches.map((batch) => ({ batch, summary: { healthRelatedDeaths: 0, accidentalDeaths: 0,
      totalDeaths: 0, recordedHealthEvents: 0, activeAlertCount: 0, highestActiveAlertSeverity: null,
      lastEventDate: null, finance: null } }));
    const task = { farmId: 1, title: "Fixture task", instructions: null, assignedHandlerId: 18,
      assignedManagerId: null, priority: "NORMAL", status: "TODO", overdue: false, visibleFrom: null,
      completionNote: null, completedAt: null, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
      assignmentScope: "BATCH_TEAM", sourceType: null, sourceId: null, completedBy: null };
    const tasks = [
      { ...task, id: 1, batchId: 7, dueAt: "2020-01-01T00:00:00Z" },
      { ...task, id: 2, batchId: 7, dueAt: null },
      { ...task, id: 3, batchId: 8, dueAt: null },
      { ...task, id: 4, batchId: 8, dueAt: null, status: "COMPLETED" },
    ];
    let unavailable = false;
    await page.addInitScript((profile) => {
      localStorage.setItem("pp_auth_session", JSON.stringify({ sessionId: "offline-batch-tasks-fixture", user: profile }));
      localStorage.setItem("pp_language", "en");
    }, user);
    await page.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin !== origin) return route.abort("blockedbyclient");
      if (!url.pathname.startsWith("/api/backend/")) return ["GET", "HEAD"].includes(request.method()) ? route.continue() : route.abort("blockedbyclient");
      const path = url.pathname.slice("/api/backend".length);
      if (path === "/auth/refresh" && request.method() === "POST") return route.fulfill({ json: { ...user, token: "fixture-token" } });
      if (request.method() !== "GET") return route.abort("blockedbyclient");
      if (path === "/tasks/summary") {
        if (unavailable) return route.fulfill({ status: 503, json: { message: "Unavailable" } });
        const batchId = url.searchParams.get("batchId");
        const open = batchId === "7" ? 2 : batchId === "8" ? 1 : 3;
        return route.fulfill({ json: { open, late: batchId === "8" ? 0 : 1, today: 0, upcoming: 0,
          noDueDate: batchId === "8" ? 1 : open - 1, completed: 0, cancelled: 0 } });
      }
      if (path === "/batches/dashboard") return route.fulfill({ json: dashboard });
      if (path === "/farm") return route.fulfill({ json: { id: 1, name: "Fixture farm" } });
      if (["/alerts", "/batches", "/batches/archived", "/incubation-cycles/attention", "/invites/pending"].includes(path)) return route.fulfill({ json: [] });
      if (path === "/alerts/summary") return route.fulfill({ json: { activeTotal: 0, critical: 0, warning: 0, info: 0 } });
      if (path === "/tasks/handler-queue/summary") return route.fulfill({ json: { now: 3, upcoming: 0, completed: 1, vaccinationReminders: 0 } });
      if (path === "/tasks/handler-queue") return route.fulfill({ json: { items: [], page: 0, size: 10, totalItems: 0, totalPages: 0, hasPrevious: false, hasNext: false } });
      if (path === "/offline/bootstrap") return unavailable
        ? route.fulfill({ status: 503, json: { message: "Unavailable" } })
        : route.fulfill({ json: { userId: 18, farmId: 1, role, batches, dashboard, products: [], tasks, vaccinationPlans: {}, overviews: {}, events: {}, inputs: {} } });
      if (path === "/version") return route.fulfill({ json: { application: "poultry-prophet", version: "test", environment: "test" } });
      if (path === "/health") return route.fulfill({ json: { status: "UP" } });
      return route.fulfill({ status: 404, json: { message: "Unexpected fixture request" } });
    });
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    const first = page.locator(".ledger-batch-card").filter({ has: page.getByRole("link", { name: "Fixture batch 7", exact: true }) });
    const second = page.locator(".ledger-batch-card").filter({ has: page.getByRole("link", { name: "Fixture batch 8", exact: true }) });
    await expect(first.getByRole("group", { name: "2 tasks; 1 overdue" })).toBeVisible({ timeout: 15_000 });
    await expect(second.getByRole("group", { name: "1 tasks" })).toBeVisible();
    await expect.poll(() => page.evaluate(async () => await new Promise<boolean>((resolve) => {
      const request = indexedDB.open("poultry-prophet-offline-v1");
      request.onerror = () => resolve(false);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("fieldBootstrapSnapshots")) { db.close(); resolve(false); return; }
        const read = db.transaction("fieldBootstrapSnapshots").objectStore("fieldBootstrapSnapshots").get("18:1");
        read.onsuccess = () => { db.close(); resolve(read.result?.data?.tasks?.length === 4); };
        read.onerror = () => { db.close(); resolve(false); };
      };
    })), { timeout: 30_000 }).toBe(true);
    unavailable = true;
    await page.evaluate(async () => await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("poultry-prophet-offline-v1");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("outbox", "readwrite");
        tx.objectStore("outbox").put({ operationId: "fixture-pending-completion", schemaVersion: 1, entityType: "TASK_STATUS",
          userId: 18, farmId: 1, batchId: 7, payload: { taskId: 2, status: "COMPLETED" },
          occurredAt: "2026-11-19T00:00:00Z", queuedAt: "2026-11-19T00:00:00Z", sequence: 1,
          status: "RETRY_WAIT", attemptCount: 1, nextAttemptAt: "2999-01-01T00:00:00Z" });
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      };
    }));
    const offlineSummary = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/backend/tasks/summary" && response.status() === 503 && new URL(response.url()).searchParams.get("batchId") === "7");
    await page.reload({ waitUntil: "domcontentloaded" });
    await offlineSummary;
    await expect(first.getByRole("group", { name: "1 tasks; 1 overdue" })).toBeVisible({ timeout: 20_000 });
    await expect(second.getByRole("group", { name: "1 tasks" })).toBeVisible();
  });
}
