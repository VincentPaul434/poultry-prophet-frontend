import { expect, test, type Page } from "@playwright/test";

const batches = [
  [1, "October load - Sweater Hatch", 150, 150, "Brooding"],
  [2, "hatch-0001", 200, 200, "Brooding"],
  [3, "september load Hatch", 90, 190, "Brooding"],
  [4, "October", 135, 250, "Brooding"],
  [5, "September-WK", 205, 300, "Brooding"],
  [6, "batch-0012", 140, 500, "Brooding"],
  [7, "bisaya", 47, 200, "Brooding"],
  [8, "boston sweater", -1, 100, "Brooding"],
].map(([id, name, currentPopulation, initialPopulation, stageName]) => ({
  id,
  farmId: 1,
  name,
  currentPopulation,
  initialPopulation,
  populationStatus: name === "boston sweater" ? "RECONCILIATION_REQUIRED" : "VALID",
  populationWarning: name === "boston sweater" ? "Population records need review." : null,
  startDate: "2026-10-01",
  hatchDate: "2026-10-01",
  farmEntryDate: "2026-10-01",
  bloodline: String(name).toLowerCase().includes("sweater") ? "Sweater" : null,
  source: null,
  hatchDateConfirmedAt: null,
  hatchDateConfirmedByUserId: null,
  stageId: 1,
  stageName,
  stageAuto: true,
  status: "ACTIVE",
  handlerUserIds: [2],
  createdAt: "2026-10-01T08:00:00Z",
  archivedAt: null,
  archivedByUserId: null,
  archiveReason: null,
  preArchiveStatus: null,
}));

function dashboardItems() {
  return batches.map((batch) => ({
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
      mortalityRatePercent: 0,
      finance: null,
      tasks: { open: 0, overdue: 0 },
    },
  }));
}

const sampleEvents = [
  {
    id: 2,
    batchId: 2,
    handlerId: 2,
    handlerName: "Fixture Handler",
    eventDate: "2026-10-09",
    eventType: "TRANSFER_OUT",
    severityLabel: null,
    affectedCount: 20,
    title: "Transfer out",
    details: null,
    tags: null,
    createdAt: "2026-10-09T10:24:00Z",
    maleDelta: null,
    femaleDelta: -20,
    unclassifiedDelta: null,
    syncStatus: null,
  },
  {
    id: 1,
    batchId: 2,
    handlerId: 2,
    handlerName: "Fixture Handler",
    eventDate: "2026-10-08",
    eventType: "HEALTH_CONCERN",
    severityLabel: "Watch",
    affectedCount: 0,
    title: "Lethargy",
    details: "Observed during morning check.",
    tags: null,
    createdAt: "2026-10-08T09:00:00Z",
    syncStatus: "PENDING",
  },
];

async function mockHandlerBackend(page: Page) {
  await page.route("**/api/backend/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/backend", "");

    if (path === "/farm") return route.fulfill({ json: { id: 1, name: "Sunrise Farm", location: null, description: null } });
    if (path === "/alerts") return route.fulfill({ json: [] });
    if (path === "/alerts/summary") return route.fulfill({ json: { activeTotal: 0, critical: 0, warning: 0, info: 0 } });
    if (path === "/version") return route.fulfill({ json: { application: "poultry-prophet", version: "e2e", commitSha: "e2e", buildTime: "2026-10-24T00:00:00Z", environment: "test", compatibleFrontendVersion: "0.1.0-validation" } });
    if (path === "/health") return route.fulfill({ json: { status: "UP" } });
    if (path === "/invites/pending") return route.fulfill({ json: [] });
    if (path === "/offline/bootstrap") return route.fulfill({ json: { userId: 2, farmId: 1, batches, dashboard: dashboardItems(), products: [], tasks: [], vaccinationPlans: {}, overviews: {}, events: {}, inputs: {} } });
    if (path === "/batches") return route.fulfill({ json: batches });
    if (path === "/batches/2") return route.fulfill({ json: batches[1] });
    if (path === "/batches/2/events") return route.fulfill({ json: sampleEvents });
    if (path === "/batches/2/records") return route.fulfill({ json: [] });
    if (path === "/batches/dashboard") return route.fulfill({ json: dashboardItems() });
    if (path === "/tasks/handler-queue/summary") return route.fulfill({ json: { now: 0, upcoming: 0, overdue: 0, completed: 0 } });
    if (path === "/tasks/handler-queue") return route.fulfill({ json: { items: [], page: 0, size: 10, totalItems: 0, totalPages: 0, hasPrevious: false, hasNext: false } });

    return route.fulfill({ json: {} });
  });
}

async function openPicker(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("pp_auth_token", "record-picker-e2e-token");
    window.localStorage.setItem("pp_auth_user", JSON.stringify({
      userId: 2,
      email: "handler@example.test",
      fullName: "Fixture Handler",
      role: "HANDLER",
      farmId: 1,
    }));
  });

  await page.goto("/dashboard");
  await page.getByRole("button", { name: /Record activity/i }).click();
  await expect(page.getByRole("heading", { name: "Record activity" })).toBeVisible();
}

test.describe("Record batch picker", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(!testInfo.project.name.startsWith("mobile-chromium-"), "This suite is reserved for mobile Chromium projects.");
  });

  test("shows the themed picker and filters active batches", async ({ page }) => {
    await mockHandlerBackend(page);
    await openPicker(page);

    await expect(page.getByText("8 active")).toBeVisible();
    await expect(page.getByPlaceholder("Search batches")).toBeVisible();
    await expect(page.getByRole("button", { name: /October load - Sweater Hatch/ })).toBeVisible();
    await expect(page.getByText("100 initial")).toBeVisible();
    await expect(page.getByText("Count needs review")).toBeVisible();

    await page.getByPlaceholder("Search batches").fill("sweater");
    await expect(page.getByRole("button", { name: /October load - Sweater Hatch/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /boston sweater/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /hatch-0001/ })).toHaveCount(0);

    await page.getByPlaceholder("Search batches").fill("not-a-real-batch");
    await expect(page.getByText("No matching batches")).toBeVisible();
  });

  test("keeps the picker within the mobile viewport and navigates to recording", async ({ page }) => {
    await mockHandlerBackend(page);
    await openPicker(page);

    const recordDimensions = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }));
    expect(recordDimensions.documentWidth).toBeLessThanOrEqual(recordDimensions.viewportWidth + 1);

    await page.getByRole("button", { name: /hatch-0001/ }).click();
    await expect(page).toHaveURL(/\/batches\/2\/data-entry\?from=dashboard#record-event/);
    await expect(page.getByRole("heading", { name: "Record activity" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Record an event" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Bird count change" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Health concern" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Feed or medicine used" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Behavior observed" })).toBeVisible();
    await expect(page.getByText("Activity history")).toBeVisible();
    await expect(page.getByText("20 birds")).toBeVisible();
    await expect(page.getByText("Pending sync")).toBeVisible();
    await expect(page.getByText("Record activity")).toHaveCount(1);

    const dimensions = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }));
    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1);

    await page.getByRole("button", { name: "How records work" }).click();
    await expect(page.getByText(/Choose the event that best describes what happened/)).toBeVisible();
    await page.getByRole("button", { name: "Bird count change" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("dialog").getByRole("heading", { name: "Population change" })).toBeVisible();
  });
});
