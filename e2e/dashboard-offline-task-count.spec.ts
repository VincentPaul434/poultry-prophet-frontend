import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block", viewport: { width: 320, height: 721 } });
test.setTimeout(90_000);

test("manager offline task count includes tasks scheduled to become visible later", async ({ page, baseURL }) => {
  if (!baseURL || new URL(baseURL).hostname !== "localhost") throw new Error("The isolated fixture requires localhost");
  const origin = new URL(baseURL).origin;
  const user = { userId: 18, farmId: 1, role: "MANAGER", email: "fixture@example.test", fullName: "Fixture Manager" };
  const batch = { id: 7, farmId: 1, name: "Fixture batch", initialPopulation: 30, currentPopulation: 25,
    populationStatus: "VALID", populationWarning: null, startDate: "2026-11-01", hatchDate: "2026-11-01",
    farmEntryDate: "2026-11-01", bloodline: "Fixture", source: null, stageId: 1, stageName: "Brooding",
    stageAuto: true, status: "ACTIVE", handlerUserIds: [], createdAt: "2026-11-01T00:00:00Z" };
  const dashboard = [{ batch, summary: { healthRelatedDeaths: 0, accidentalDeaths: 0, totalDeaths: 0,
    recordedHealthEvents: 0, activeAlertCount: 0, highestActiveAlertSeverity: null, lastEventDate: null, finance: null } }];
  const task = { farmId: 1, batchId: 7, title: "Fixture task", instructions: null, assignedHandlerId: null,
    assignedManagerId: 18, dueAt: null, priority: "NORMAL", status: "TODO", overdue: false,
    completionNote: null, completedAt: null, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
    assignmentScope: "BATCH_TEAM", sourceType: null, sourceId: null, completedBy: null };
  const tasks = [{ ...task, id: 1, visibleFrom: null }, { ...task, id: 2, visibleFrom: "2999-01-01T00:00:00Z" }];
  let summaryUnavailable = false;
  await page.addInitScript((profile) => {
    localStorage.setItem("pp_auth_session", JSON.stringify({ sessionId: "offline-task-count-fixture", user: profile }));
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
    if (path === "/tasks/summary") return summaryUnavailable
      ? route.fulfill({ status: 503, json: { message: "Unavailable" } })
      : route.fulfill({ json: { open: 2, late: 0, today: 0, upcoming: 0, noDueDate: 2, completed: 0, cancelled: 0 } });
    if (path === "/batches/dashboard") return route.fulfill({ json: dashboard });
    if (path === "/farm") return route.fulfill({ json: { id: 1, name: "Fixture farm" } });
    if (["/alerts", "/batches", "/batches/archived", "/incubation-cycles/attention", "/invites/pending"].includes(path)) return route.fulfill({ json: [] });
    if (path === "/alerts/summary") return route.fulfill({ json: { activeTotal: 0, critical: 0, warning: 0, info: 0 } });
    if (path === "/offline/bootstrap") return route.fulfill({ json: { userId: 18, farmId: 1, role: "MANAGER", batches: [batch], dashboard, products: [], tasks, vaccinationPlans: {}, overviews: {}, events: {}, inputs: {} } });
    if (path === "/version") return route.fulfill({ json: { application: "poultry-prophet", version: "test", environment: "test" } });
    if (path === "/health") return route.fulfill({ json: { status: "UP" } });
    return route.fulfill({ status: 404, json: { message: "Unexpected fixture request" } });
  });
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  const count = page.getByTestId("dashboard-summary").getByText("Open tasks", { exact: true }).locator("..").locator("p").last();
  await expect(count).toHaveText("2", { timeout: 45_000 });
  await expect.poll(() => page.evaluate(async () => {
    return await new Promise<boolean>((resolve) => {
      const request = indexedDB.open("poultry-prophet-offline-v1");
      request.onerror = () => resolve(false);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("fieldBootstrapSnapshots")) { db.close(); resolve(false); return; }
        const read = db.transaction("fieldBootstrapSnapshots").objectStore("fieldBootstrapSnapshots").get("18:1");
        read.onsuccess = () => { db.close(); resolve(read.result?.data?.tasks?.length === 2); };
        read.onerror = () => { db.close(); resolve(false); };
      };
    });
  }), { timeout: 30_000 }).toBe(true);
  summaryUnavailable = true;
  const failedSummary = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/backend/tasks/summary" && response.status() === 503);
  await page.reload({ waitUntil: "domcontentloaded" });
  await failedSummary;
  await expect(count).toHaveText("2", { timeout: 15_000 });
});
