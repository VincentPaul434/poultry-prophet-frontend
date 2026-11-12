import { expect, test, type Page } from "@playwright/test";

const summary = {
  scope: "FARM",
  batchId: null,
  batchName: null,
  startDate: "2026-10-12",
  endDate: "2026-11-10",
  timeZone: "Asia/Manila",
  generatedAt: "2026-11-11T00:00:00Z",
  population: { activeBatches: 3, initialPopulation: 1840, currentPopulation: 1776, asOfDate: "2026-11-10", available: true },
  events: { healthRelatedDeaths: 8, otherLosses: 4, healthConcerns: 13, interventions: 21, totalEvents: 48, birdsAffected: 32 },
  activity: [
    { periodStart: "2026-10-12", periodEnd: "2026-10-21", label: "Oct 12", unit: "WEEK", healthConcerns: 3, healthRelatedDeaths: 1, otherLosses: 0, interventions: 5, otherEvents: 6 },
    { periodStart: "2026-10-22", periodEnd: "2026-10-31", label: "Oct 22", unit: "WEEK", healthConcerns: 5, healthRelatedDeaths: 4, otherLosses: 2, interventions: 8, otherEvents: 3 },
    { periodStart: "2026-11-01", periodEnd: "2026-11-10", label: "Nov 1", unit: "WEEK", healthConcerns: 5, healthRelatedDeaths: 3, otherLosses: 2, interventions: 8, otherEvents: 1 },
  ],
  finance: { currency: "PHP", income: "82750", saleIncome: "74900", saleTransactionCount: 4, expense: "51320", net: "31430", transactionCount: 19, series: [], categories: [], available: true, limitation: "Farm view includes batch-linked and general farm records." },
  tasks: { total: 16, open: 7, completed: 9, overdue: 2, completionRatePercent: 56.25, available: true },
  incubation: { totalCycles: 4, completedCycles: 3, inProgressCycles: 1, finalizedEggsLoaded: 520, finalizedHatched: 421, finalizedHatchRatePercent: 80.96, averageDurationDays: 21, available: true },
  inputTypes: {},
  limitations: [],
};

async function openFarmOverview(page: Page, overview = summary) {
  await page.addInitScript(() => {
    if (!window.localStorage.getItem("pp_auth_session")) window.localStorage.setItem("pp_auth_session", JSON.stringify({ sessionId: "test-session", user: { userId: 1, email: "manager@example.test", fullName: "Fixture Manager", role: "MANAGER", farmId: 1 } }));
  });
  await page.route("**/api/backend/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/backend", "");
    if (path === "/auth/refresh") return route.fulfill({ json: { token: "farm-overview-e2e-token", userId: 1, email: "manager@example.test", fullName: "Fixture Manager", role: "MANAGER", farmId: 1 } });
    if (path === "/farm") return route.fulfill({ json: { id: 1, name: "North Field Farm", location: "Test", description: null } });
    if (path === "/alerts") return route.fulfill({ json: [] });
    if (path === "/alerts/summary") return route.fulfill({ json: { activeTotal: 0, critical: 0, warning: 0, info: 0 } });
    if (path === "/version") return route.fulfill({ json: { application: "poultry-prophet", version: "e2e", commitSha: "e2e", buildTime: "2026-11-11T00:00:00Z", environment: "test", compatibleFrontendVersion: "0.1.0-validation" } });
    if (path === "/health") return route.fulfill({ json: { status: "UP" } });
    if (path === "/offline/bootstrap") return route.fulfill({ json: { userId: 1, farmId: 1, batches: [], dashboard: [], products: [], tasks: [], vaccinationPlans: {}, overviews: {}, events: {}, inputs: {} } });
    if (path === "/batches") return route.fulfill({ json: [{ id: 1, name: "North flock", status: "ACTIVE" }, { id: 2, name: "South flock", status: "ACTIVE" }] });
    if (path === "/analytics/operations/v2") return route.fulfill({ json: overview });
    if (path === "/analytics/batches/compare") return route.fulfill({ json: { requestedWindowDays: 30, effectiveWindowDays: 30, timeZone: "Asia/Manila", warnings: [], batches: [] } });
    return route.fulfill({ json: {} });
  });
  await page.goto("/operations");
  await expect(page.getByRole("heading", { name: "Farm overview" })).toBeVisible();
}

test("separates farm snapshot, activity, finance, and comparison", async ({ page }) => {
  await openFarmOverview(page);
  await expect(page.getByRole("heading", { name: "At a glance" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recorded activity" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Financial snapshot" })).toHaveCount(0);

  const nav = page.getByRole("navigation", { name: "Farm overview sections" });
  await nav.getByRole("button", { name: "Activity" }).click();
  await expect(page.getByRole("heading", { name: "Recorded activity" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "At a glance" })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Recorded activity" })).toBeVisible();

  await nav.getByRole("button", { name: "Finance" }).click();
  await expect(page.getByRole("heading", { name: "Financial snapshot" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Net cash flow" })).toBeVisible();
  await expect(page.getByRole("link", { name: "View finance" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recorded activity" })).toHaveCount(0);

  await nav.getByRole("button", { name: "Compare" }).click();
  await expect(page.getByRole("heading", { name: "Compare batches" })).toBeVisible();
  await expect(page.getByText("Review window")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "North flock" })).toBeVisible();
});

test("keeps the snapshot within the mobile viewport", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile-chromium-"), "Covered by the mobile projects.");
  await openFarmOverview(page);
  await expect(page.getByRole("heading", { name: "Health and incubation" })).toBeVisible();
  const reviewWindow = page.getByRole("button", { name: /Review window/ });
  await expect(reviewWindow).toHaveAttribute("aria-expanded", "false");
  await reviewWindow.click();
  await expect(reviewWindow).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#review-window-controls select").first()).toBeVisible();
  const widths = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport + 1);
  await page.getByRole("navigation", { name: "Farm overview sections" }).getByRole("button", { name: "Finance" }).click();
  await expect(page.getByRole("heading", { name: "Financial snapshot" })).toBeVisible();
  const financeWidths = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  expect(financeWidths.document).toBeLessThanOrEqual(financeWidths.viewport + 1);
});


test("shows separate currency snapshots", async ({ page }) => {
  const php = { ...summary.finance, income: "1000", expense: "300", net: "700", transactionCount: 2 };
  const usd = { ...summary.finance, currency: "USD", income: "50", expense: "20", net: "30", transactionCount: 2 };
  const mixed = { ...summary, finance: { ...summary.finance, byCurrency: [php, usd] } };
  await openFarmOverview(page, mixed);
  await page.getByRole("navigation", { name: "Farm overview sections" }).getByRole("button", { name: "Finance" }).click();
  await expect(page.getByText("Currencies are shown separately; no conversion is applied.")).toBeVisible();
  await expect(page.getByText("₱700", { exact: true })).toBeVisible();
  await expect(page.getByText("USD 30", { exact: true })).toBeVisible();
});
