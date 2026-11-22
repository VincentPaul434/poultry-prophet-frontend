import { expect, test, type Page } from "@playwright/test";

test.use({ serviceWorkers: "block", viewport: { width: 320, height: 721 } });
test.setTimeout(90_000);

async function openDashboard(page: Page, origin: string) {
  const profile = { userId: 8, farmId: 1, role: "HANDLER", email: "handler@example.test", fullName: "Fixture Handler" };
  const items = Array.from({ length: 7 }, (_, index) => {
    const batch = {
      id: index + 1, farmId: 1, name: `Fixture batch ${index + 1}`, initialPopulation: 30,
      currentPopulation: 25, populationStatus: "VALID", populationWarning: null,
      startDate: "2026-11-01", hatchDate: "2026-11-01", farmEntryDate: "2026-11-01",
      bloodline: "Fixture", source: null, stageId: 1, stageName: "Brooding", stageAuto: true,
      status: "ACTIVE", handlerUserIds: [8], createdAt: "2026-11-01T00:00:00Z",
    };
    return { batch, summary: {
      healthRelatedDeaths: 0, accidentalDeaths: 0, totalDeaths: 0, recordedHealthEvents: 0,
      activeAlertCount: index === 6 ? 1 : 0, highestActiveAlertSeverity: index === 6 ? "WARNING" : null,
      lastEventDate: null, finance: null, tasks: { open: 0, overdue: 0 },
    } };
  });
  await page.addInitScript((user) => {
    localStorage.setItem("pp_auth_session", JSON.stringify({ sessionId: "attention-count-fixture", user }));
    localStorage.setItem("pp_language", "en");
  }, profile);
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== origin) return route.abort("blockedbyclient");
    if (!url.pathname.startsWith("/api/backend/")) return ["GET", "HEAD"].includes(request.method()) ? route.continue() : route.abort("blockedbyclient");
    const path = url.pathname.slice("/api/backend".length);
    if (path === "/auth/refresh" && request.method() === "POST") return route.fulfill({ json: { ...profile, token: "fixture-token" } });
    if (request.method() !== "GET") return route.abort("blockedbyclient");
    if (path === "/batches/dashboard") return route.fulfill({ json: items });
    if (path === "/farm") return route.fulfill({ json: { id: 1, name: "Fixture farm", location: null, description: null } });
    if (path === "/alerts" || path === "/batches" || path === "/batches/archived" || path === "/incubation-cycles/attention" || path === "/invites/pending") return route.fulfill({ json: [] });
    if (path === "/alerts/summary") return route.fulfill({ json: { activeTotal: 1, critical: 0, warning: 1, info: 0 } });
    if (path === "/tasks/handler-queue/summary") return route.fulfill({ json: { now: 0, upcoming: 0, done: 0 } });
    if (path === "/tasks/handler-queue") return route.fulfill({ json: { items: [], page: 0, size: 10, totalItems: 0, totalPages: 0, hasPrevious: false, hasNext: false } });
    if (path === "/offline/bootstrap") return route.fulfill({ json: { userId: 8, farmId: 1, batches: items.map(({ batch }) => batch), dashboard: items, products: [], tasks: [], vaccinationPlans: {}, overviews: {}, events: {}, inputs: {} } });
    if (path === "/version") return route.fulfill({ json: { application: "poultry-prophet", version: "test", environment: "test" } });
    if (path === "/health") return route.fulfill({ json: { status: "UP" } });
    return route.fulfill({ status: 404, json: { message: "Unexpected fixture request" } });
  });
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Active batches: 7")).toBeVisible({ timeout: 45_000 });
  return page.getByTestId("dashboard-summary").getByText("Needs attention", { exact: true }).locator("..").locator("p").last();
}

test("attention summary includes a batch beyond the initial six cards", async ({ page, baseURL }) => {
  if (!baseURL || new URL(baseURL).hostname !== "localhost") throw new Error("The fixture requires localhost");
  const count = await openDashboard(page, new URL(baseURL).origin);
  await expect(page.getByText("Fixture batch 7", { exact: true })).toHaveCount(0);
  await expect(count).toHaveText("1");
});

test("searching the cards does not change the farm-wide attention summary", async ({ page, baseURL }) => {
  if (!baseURL || new URL(baseURL).hostname !== "localhost") throw new Error("The fixture requires localhost");
  const count = await openDashboard(page, new URL(baseURL).origin);
  await page.getByRole("textbox", { name: "Search batches" }).fill("Fixture batch 1");
  await expect(page.getByText("Fixture batch 1", { exact: true })).toBeVisible();
  await expect(count).toHaveText("1");
});
