import { expect, test, type Page } from "@playwright/test";

test.use({ serviceWorkers: "block" });

const manager = {
  userId: 7,
  email: "manager@example.test",
  fullName: "Fixture Manager",
  role: "MANAGER",
  farmId: 1,
};

const activeCycles = [
  {
    id: 10,
    farmId: 1,
    cycleName: "October load — Sweater Hatch",
    incubatorCode: "Incubator A",
    eggSource: "Farm breeding",
    bloodline: "Sweater",
    loadedDate: "2026-10-27",
    eggsLoaded: 200,
    expectedHatchDate: "2026-11-30",
    actualHatchDate: null,
    hatchedCount: null,
    unhatchedCount: null,
    removedDamagedCount: null,
    status: "INCUBATING",
    notes: null,
    createdBatchId: null,
    createdAt: "2026-10-27T08:00:00Z",
    hatchRatePercent: null,
    durationDays: null,
  },
  {
    id: 11,
    farmId: 1,
    cycleName: "November load — Roundhead",
    incubatorCode: "Incubator B",
    eggSource: "Farm breeding",
    bloodline: "Roundhead",
    loadedDate: "2026-10-30",
    eggsLoaded: 250,
    expectedHatchDate: "2026-12-03",
    actualHatchDate: null,
    hatchedCount: null,
    unhatchedCount: null,
    removedDamagedCount: null,
    status: "INCUBATING",
    notes: null,
    createdBatchId: null,
    createdAt: "2026-10-30T08:00:00Z",
    hatchRatePercent: null,
    durationDays: null,
  },
];

async function mockManagerBackend(page: Page) {
  await page.addInitScript((profile) => {
    localStorage.setItem("pp_auth_session", JSON.stringify({ sessionId: "incubation-layout", user: profile }));
    localStorage.setItem("pp_language", "taglish");
  }, manager);

  await page.route("**/api/backend/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/backend", "");

    if (path === "/auth/refresh") return route.fulfill({ json: { ...manager, token: "incubation-layout-token" } });
    if (path === "/farm") return route.fulfill({ json: { id: 1, name: "Sunrise Farm" } });
    if (path === "/alerts") return route.fulfill({ json: [] });
    if (path === "/alerts/page") {
      return route.fulfill({
        json: { items: [], page: 0, size: 20, totalItems: 0, totalPages: 0, hasPrevious: false, hasNext: false },
      });
    }
    if (path === "/alerts/summary") return route.fulfill({ json: { activeTotal: 0, critical: 0, warning: 0, info: 0 } });
    if (path === "/incubation-cycles/summary") return route.fulfill({ json: { active: 2, completed: 2, cancelled: 0, dueForReview: 0, activeEggs: 450 } });
    if (path === "/incubation-cycles/page") {
      return route.fulfill({
        json: { items: activeCycles, page: 0, size: 12, totalItems: 2, totalPages: 1, hasPrevious: false, hasNext: false },
      });
    }
    if (path === "/batches/dashboard" || path === "/batches" || path === "/batches/archived" || path === "/invites/pending") return route.fulfill({ json: [] });
    if (path === "/offline/bootstrap") {
      return route.fulfill({
        json: { userId: 7, farmId: 1, batches: [], dashboard: [], products: [], tasks: [], vaccinationPlans: {}, overviews: {}, events: {}, inputs: {} },
      });
    }
    if (path === "/version") {
      return route.fulfill({
        json: { application: "poultry-prophet", version: "e2e", commitSha: "e2e", buildTime: "2026-11-17T00:00:00Z", environment: "test", compatibleFrontendVersion: "0.1.0-validation" },
      });
    }
    if (path === "/health") return route.fulfill({ json: { status: "UP" } });

    return route.fulfill({ json: {} });
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));

  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
}

test.describe("Incubation dashboard on mobile", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(!testInfo.project.name.startsWith("mobile-chromium-"), "This suite is reserved for the configured mobile Chromium projects.");
  });

  test("keeps the farm identity centered and active cycle cards fully visible", async ({ page }) => {
    await mockManagerBackend(page);
    await page.goto("/incubation");

    await expect(page.getByTestId("incubation-page")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Incubation" })).toBeVisible();
    const cards = page.getByTestId("incubation-cycle-card");
    await expect(cards).toHaveCount(2);

    const cardMetrics = await cards.evaluateAll((nodes) => nodes.map((node) => {
      const element = node as HTMLElement;
      const rect = element.getBoundingClientRect();
      return { height: rect.height, clientHeight: element.clientHeight, scrollHeight: element.scrollHeight };
    }));
    for (const card of cardMetrics) {
      expect(card.height).toBeGreaterThan(150);
      expect(card.scrollHeight).toBeLessThanOrEqual(card.clientHeight + 1);
    }

    const cardPositions = await cards.evaluateAll((nodes) => nodes.map((node) => {
      const { top, bottom } = node.getBoundingClientRect();
      return { top, bottom };
    }));
    expect(cardPositions[1].top).toBeGreaterThanOrEqual(cardPositions[0].bottom);

    const identityCenter = await page.getByTestId("mobile-farm-identity").evaluate((element) => {
      const { left, width } = element.getBoundingClientRect();
      return left + width / 2;
    });
    expect(Math.abs(identityCenter - (await page.evaluate(() => window.innerWidth / 2)))).toBeLessThanOrEqual(1);
    await expectNoHorizontalOverflow(page);
  });

  test("keeps low-stock information in inventory instead of the batch dashboard summary", async ({ page }) => {
    await mockManagerBackend(page);
    await page.goto("/dashboard");

    const summary = page.getByTestId("dashboard-summary");
    await expect(summary).toBeVisible();
    await expect(summary.getByText("Low stock", { exact: true })).toHaveCount(0);
    await expect(page.getByTestId("dashboard-sticky-header")).not.toContainText("Sunrise Farm");
    await expectNoHorizontalOverflow(page);
  });
});
