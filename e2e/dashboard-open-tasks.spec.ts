import { expect, test, type Page } from "@playwright/test";

test.use({ serviceWorkers: "block", viewport: { width: 320, height: 721 } });
test.setTimeout(90_000);

async function dashboard(page: Page, origin: string, role: "HANDLER" | "MANAGER", failSummary = false) {
  const user = { userId: 8, farmId: 1, role, email: "fixture@example.test", fullName: "Fixture User" };
  const batch = { id: 7, farmId: 1, name: "Fixture batch", initialPopulation: 30, currentPopulation: 25,
    populationStatus: "VALID", populationWarning: null, startDate: "2026-11-01", hatchDate: "2026-11-01",
    farmEntryDate: "2026-11-01", bloodline: "Fixture", source: null, stageId: 1, stageName: "Brooding",
    stageAuto: true, status: "ACTIVE", handlerUserIds: [8], createdAt: "2026-11-01T00:00:00Z" };
  const items = [{ batch, summary: { healthRelatedDeaths: 0, accidentalDeaths: 0, totalDeaths: 0,
    recordedHealthEvents: 0, activeAlertCount: 0, highestActiveAlertSeverity: null, lastEventDate: null, finance: null } }];
  await page.addInitScript((profile) => {
    localStorage.setItem("pp_auth_session", JSON.stringify({ sessionId: "task-count-fixture", user: profile }));
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
    if (path === "/tasks/summary") return failSummary
      ? route.fulfill({ status: 403, json: { message: "Unavailable" } })
      : route.fulfill({ json: { open: 7, late: 1, today: 1, upcoming: 3, noDueDate: 2, completed: 9, cancelled: 4 } });
    if (path === "/batches/dashboard") return route.fulfill({ json: items });
    if (path === "/farm") return route.fulfill({ json: { id: 1, name: "Fixture farm" } });
    if (["/alerts", "/batches", "/batches/archived", "/incubation-cycles/attention", "/invites/pending"].includes(path)) return route.fulfill({ json: [] });
    if (path === "/alerts/summary") return route.fulfill({ json: { activeTotal: 0, critical: 0, warning: 0, info: 0 } });
    if (path === "/tasks/handler-queue/summary") return route.fulfill({ json: { now: 2, upcoming: 3, completed: 9, vaccinationReminders: 0 } });
    if (path === "/tasks/handler-queue") return route.fulfill({ json: { items: [], page: 0, size: 10, totalItems: 0, totalPages: 0, hasPrevious: false, hasNext: false } });
    if (path === "/offline/bootstrap") return route.fulfill({ json: { userId: 8, farmId: 1, batches: [batch], dashboard: items, products: [], tasks: [], vaccinationPlans: {}, overviews: {}, events: {}, inputs: {} } });
    if (path === "/version") return route.fulfill({ json: { application: "poultry-prophet", version: "test", environment: "test" } });
    if (path === "/health") return route.fulfill({ json: { status: "UP" } });
    return route.fulfill({ status: 404, json: { message: "Unexpected fixture request" } });
  });
  const failedSummary = failSummary ? page.waitForResponse((response) => new URL(response.url()).pathname === "/api/backend/tasks/summary" && response.status() === 403) : null;
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Active batches: 1")).toBeVisible({ timeout: 45_000 });
  if (failedSummary) await failedSummary;
  return page.getByTestId("dashboard-summary").getByText("Open tasks", { exact: true }).locator("..").locator("p").last();
}

for (const role of ["HANDLER", "MANAGER"] as const) {
  test(`${role.toLowerCase()} sees the complete open-task summary on mobile`, async ({ page, baseURL }) => {
    if (!baseURL || new URL(baseURL).hostname !== "localhost") throw new Error("The fixture requires localhost");
    const count = await dashboard(page, new URL(baseURL).origin, role);
    await expect(count).toHaveText("7");
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(count).toHaveText("7");
    await page.getByRole("textbox", { name: "Search batches" }).fill("no matching batch");
    await expect(count).toHaveText("7");
  });
}

test("an unavailable task summary does not appear as zero", async ({ page, baseURL }) => {
  if (!baseURL || new URL(baseURL).hostname !== "localhost") throw new Error("The fixture requires localhost");
  const count = await dashboard(page, new URL(baseURL).origin, "HANDLER", true);
  await expect(count).toHaveText("—");
});
