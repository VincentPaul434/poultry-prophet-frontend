import { expect, test, type Page } from "@playwright/test";

test.use({ serviceWorkers: "block" });

const manager = {
  userId: 1,
  email: "manager@example.test",
  fullName: "Fixture Manager",
  role: "MANAGER",
  farmId: 1,
};

const batch = {
  id: 7,
  farmId: 1,
  name: "October load - Sweater Hatch",
  initialPopulation: 30,
  currentPopulation: 20,
  populationStatus: "VALID",
  populationWarning: null,
  startDate: "2026-11-01",
  hatchDate: "2026-11-01",
  farmEntryDate: "2026-11-01",
  bloodline: "Sweater",
  source: "Own hatch",
  hatchDateConfirmedAt: null,
  hatchDateConfirmedByUserId: null,
  stageId: 1,
  stageName: "Brooding",
  stageAuto: true,
  status: "ACTIVE",
  handlerUserIds: [],
  createdAt: "2026-11-01T08:00:00Z",
  archivedAt: null,
  archivedByUserId: null,
  archiveReason: null,
  preArchiveStatus: null,
};

const dashboard = [{
  batch,
  summary: {
    healthRelatedDeaths: 0,
    accidentalDeaths: 0,
    totalDeaths: 0,
    otherPopulationChanges: 0,
    recordedHealthEvents: 0,
    activeAlertCount: 0,
    highestActiveAlertSeverity: null,
    lastEventDate: null,
    finance: {
      recordedBatchCost: 12450,
      hasCostRecords: true,
      productCostComplete: true,
      unvaluedUsageCount: 0,
      currency: "PHP",
      asOfDate: "2026-11-18",
    },
    tasks: { open: 0, overdue: 0 },
  },
}];

async function mockManagerBackend(page: Page) {
  await page.route("**/api/backend/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/backend", "");
    if (path === "/auth/refresh") return route.fulfill({ json: { ...manager, token: "dashboard-cost-e2e-token" } });
    if (path === "/farm") return route.fulfill({ json: { id: 1, name: "Sunrise Farm", location: null, description: null } });
    if (path === "/alerts" || path === "/invites/pending") return route.fulfill({ json: [] });
    if (path === "/alerts/summary") return route.fulfill({ json: { activeTotal: 0, critical: 0, warning: 0, info: 0 } });
    if (path === "/version") return route.fulfill({ json: { application: "poultry-prophet", version: "e2e", commitSha: "e2e", buildTime: "2026-11-18T00:00:00Z", environment: "test", compatibleFrontendVersion: "0.1.0-validation" } });
    if (path === "/health") return route.fulfill({ json: { status: "UP" } });
    if (path === "/offline/bootstrap") return route.fulfill({ json: { userId: 1, farmId: 1, role: "MANAGER", batches: [batch], dashboard, products: [], tasks: [], vaccinationPlans: {}, overviews: {}, events: {}, inputs: {} } });
    if (path === "/batches/dashboard") return route.fulfill({ json: dashboard });
    if (path === "/tasks/summary") return route.fulfill({ json: { open: 3, late: 1, today: 0, upcoming: 2, noDueDate: 0, completed: 0, cancelled: 0 } });
    if (path === "/batches" || path === "/batches/archived") return route.fulfill({ json: [] });
    return route.fulfill({ json: {} });
  });
}

test.describe("Manager batch card metrics", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(!testInfo.project.name.startsWith("mobile-chromium-"), "This suite is reserved for mobile Chromium projects.");
  });

  for (const { language, countLabel, taskLabel, costLabel } of [
    { language: "en", countLabel: "Count", taskLabel: "Tasks", costLabel: "Cost" },
    { language: "taglish", countLabel: "Bilang", taskLabel: "Gawain", costLabel: "Gastos" },
  ]) test(`shows population and tasks without a cost metric in ${language}`, async ({ page, context }) => {
    await page.setViewportSize({ width: 320, height: 721 });
    await context.addInitScript(({ profile, locale }) => {
      localStorage.setItem("pp_auth_session", JSON.stringify({ sessionId: "dashboard-cost-e2e", user: profile }));
      localStorage.setItem("pp_language", locale);
    }, { profile: manager, locale: language });
    await mockManagerBackend(page);

    await page.goto("/dashboard");

    const card = page.locator(".ledger-batch-card").filter({ has: page.getByRole("link", { name: batch.name, exact: true }) });
    await expect(card.getByText(countLabel, { exact: true })).toBeVisible();
    await expect(card.getByText("20/30", { exact: true })).toBeVisible();
    await expect(card.getByText(taskLabel, { exact: true })).toBeVisible();
    await expect(card.getByText("3", { exact: true })).toBeVisible();
    await expect(card.getByText(costLabel, { exact: true })).toHaveCount(0);
    await expect(card.getByText("₱12,450", { exact: true })).toHaveCount(0);
    await expect(card.getByRole("group")).toHaveCount(2);
    const dimensions = await page.evaluate(() => ({ documentWidth: document.documentElement.scrollWidth, viewportWidth: window.innerWidth }));
    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
  });
});
