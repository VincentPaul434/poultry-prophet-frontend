import { expect, test, type Page } from "@playwright/test";

test.use({ serviceWorkers: "block" });
test.setTimeout(90_000);

const manager = { userId: 1, email: "manager@example.test", fullName: "Fixture Manager", role: "MANAGER", farmId: 1 };

// Deliberately different orderings: the largest flock does not have the highest
// cost per bird or death rate. Batches 11 and 12 are outside the top-10 cohort.
const dashboard = Array.from({ length: 12 }, (_, index) => {
  const id = index + 1;
  const currentPopulation = 130 - id * 10;
  const initialPopulation = 200;
  const totalDeaths = id === 2 ? 40 : id === 1 ? 10 : id;
  return {
    batch: {
      id, farmId: 1, name: `Flock ${String(id).padStart(2, "0")}`,
      initialPopulation, currentPopulation, populationStatus: "VALID", populationWarning: null,
      startDate: "2026-10-01", hatchDate: "2026-10-01", farmEntryDate: "2026-10-01",
      bloodline: "Sweater", source: "Own hatch", hatchDateConfirmedAt: null,
      hatchDateConfirmedByUserId: null, stageId: 1, stageName: "Brooding", stageAuto: true,
      status: "ACTIVE", handlerUserIds: [], createdAt: "2026-10-01T00:00:00Z",
      archivedAt: null, archivedByUserId: null, archiveReason: null, preArchiveStatus: null,
    },
    summary: {
      healthRelatedDeaths: totalDeaths, accidentalDeaths: 0, totalDeaths, otherPopulationChanges: 0,
      recordedHealthEvents: 0, activeAlertCount: 0, highestActiveAlertSeverity: null,
      lastEventDate: null,
      finance: {
        recordedBatchCost: id === 2 ? currentPopulation * 25 : currentPopulation * 5,
        hasCostRecords: true, productCostComplete: true, unvaluedUsageCount: 0,
        currency: "PHP", asOfDate: "2026-11-19",
      },
    },
  };
});
dashboard[2].summary.finance.hasCostRecords = false;
dashboard[2].summary.finance.recordedBatchCost = 0;
dashboard[3].summary.finance.productCostComplete = false;
dashboard[3].summary.finance.unvaluedUsageCount = 1;
dashboard[4].summary.finance.currency = "USD";

type Dashboard = typeof dashboard;

async function openCharts(page: Page, items: Dashboard = dashboard, inventory: Array<Record<string, unknown>> = []) {
  await page.addInitScript((profile) => {
    localStorage.setItem("pp_auth_session", JSON.stringify({ sessionId: "batch-charts-e2e", user: profile }));
    localStorage.setItem("pp_language", "en");
  }, manager);
  await page.route("**/api/backend/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/backend", "");
    if (path === "/auth/refresh") return route.fulfill({ json: { ...manager, token: "batch-charts-e2e-token" } });
    if (path === "/farm") return route.fulfill({ json: { id: 1, name: "Fixture farm", location: null, description: null } });
    if (path === "/alerts" || path === "/invites/pending") return route.fulfill({ json: [] });
    if (path === "/alerts/summary") return route.fulfill({ json: { activeTotal: 0, critical: 0, warning: 0, info: 0 } });
    if (path === "/version") return route.fulfill({ json: { application: "poultry-prophet", version: "e2e", commitSha: "e2e", buildTime: "2026-11-19T00:00:00Z", environment: "test", compatibleFrontendVersion: "0.1.0-validation" } });
    if (path === "/health") return route.fulfill({ json: { status: "UP" } });
    if (path === "/offline/bootstrap") return route.fulfill({ json: { userId: 1, farmId: 1, role: "MANAGER", batches: items.map((item) => item.batch), dashboard: items, products: [], tasks: [], vaccinationPlans: {}, overviews: {}, events: {}, inputs: {} } });
    if (path === "/batches/dashboard") return route.fulfill({ json: items });
    if (path === "/batches") return route.fulfill({ json: items.map((item) => item.batch) });
    if (path === "/batches/archived") return route.fulfill({ json: [] });
    if (path === "/inventory/products") return route.fulfill({ json: inventory });
    return route.fulfill({ json: {} });
  });
  await page.goto("/operations?section=compare&scope=FARM&start=2026-10-21&end=2026-11-19", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Batch charts" })).toBeVisible({ timeout: 45_000 });
}

test("warns that demo stock can affect cost rankings without labelling every batch", async ({ page }) => {
  await openCharts(page, dashboard, [{ id: 1, active: true, demoStockHistory: true }]);
  await expect(page.getByText(/Demo stock is in farm history; cost rankings may be affected/)).toBeVisible();
  await expect(page.getByRole("region", { name: "Recorded cost per current bird" }).getByRole("link", { name: "Flock 02" })).toBeVisible();
});

test("ranks the ten largest flocks independently by headcount, cost and deaths", async ({ page }, testInfo) => {
  await openCharts(page);
  const birds = page.getByRole("region", { name: "Current birds" });
  const costs = page.getByRole("region", { name: "Recorded cost per current bird" });
  const deaths = page.getByRole("region", { name: "Recorded death rate" });
  for (const chart of [birds, costs, deaths]) {
    await expect(chart.locator("li")).toHaveCount(10);
    await expect(chart.getByRole("link", { name: "Flock 10", exact: true })).toBeVisible();
    await expect(chart.getByRole("link", { name: "Flock 11", exact: true })).toHaveCount(0);
  }
  await expect(birds.locator("li").first()).toContainText("Flock 01");
  await expect(birds.locator("li").first()).toContainText("120 birds");
  await expect(costs.locator("li").first()).toContainText("Flock 02");
  await expect(costs.locator("li").first()).toContainText("₱25");
  await expect(costs.locator("li").first()).toContainText("110 birds");
  await expect(deaths.locator("li").first()).toContainText("Flock 02");
  await expect(deaths.locator("li").first()).toContainText("20%");
  await expect(deaths.locator("li").first()).toContainText("40 / 200 starting birds");
  await expect(costs.locator("li").filter({ hasText: "Flock 03" })).toContainText("No recorded cost");
  await expect(costs.locator("li").filter({ hasText: "Flock 04" })).toContainText("Cost incomplete");
  await expect(costs.locator("li").filter({ hasText: "Flock 05" })).toContainText("Currency: USD");
  await expect(deaths).toContainText("Transfers can affect this comparison");
  await expect(page.getByText(/independent of the Snapshot review dates/i)).toBeVisible();
  await expect(birds.getByRole("link", { name: "Flock 01" })).toHaveAttribute("href", "/batches/1/selection");
  await page.screenshot({ path: testInfo.outputPath("charts.png"), fullPage: true });
});

test("does not calculate costs without current birds and excludes invalid population", async ({ page }) => {
  const zero = structuredClone(dashboard[0]);
  zero.batch.name = "Empty flock";
  zero.batch.currentPopulation = 0;
  zero.batch.initialPopulation = 0;
  const invalid = structuredClone(dashboard[1]);
  invalid.batch.name = "Needs review";
  invalid.batch.populationStatus = "RECONCILIATION_REQUIRED";
  await openCharts(page, [zero, invalid]);
  const costs = page.getByRole("region", { name: "Recorded cost per current bird" });
  const deaths = page.getByRole("region", { name: "Recorded death rate" });
  await expect(costs.getByText("No current birds")).toBeVisible();
  await expect(deaths.getByText("Starting count unavailable")).toBeVisible();
  await expect(page.getByText(/population records that need review/i)).toBeVisible();
  await expect(page.getByRole("link", { name: "Needs review" })).toHaveCount(0);
});

test("keeps charts within the phone viewport", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile-chromium-"), "Covered by mobile projects.");
  await openCharts(page);
  await expect(page.getByRole("region", { name: "Recorded death rate" })).toBeVisible();
  const size = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  expect(size.document).toBeLessThanOrEqual(size.viewport + 1);
  await page.screenshot({ path: testInfo.outputPath("charts.png"), fullPage: true });
});
