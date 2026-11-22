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

const totals = {
  recordedIncome: "1000", saleIncome: "1000", otherIncome: "0", saleTransactionCount: 1,
  recordedExpense: "300", recordedNetCashFlow: "700", productsConsumedCost: "0",
  totalRecordedBatchCost: "300", recordedContribution: "700", productCostComplete: true,
  postedTransactionCount: 2, voidedTransactionCount: 0,
};
const financeAnalytics = {
  scope: "FARM", batchId: null, batchName: null, startDate: "2026-10-12", endDate: "2026-11-10",
  currency: "PHP", totals, series: [], categoryTotals: [],
  limitations: { farmWideCostsExcluded: false, message: "All posted finance records are included." },
};

async function openFarmOverview(page: Page, analytics = financeAnalytics, url = "/operations") {
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
    if (path === "/batches/dashboard") return route.fulfill({ json: [] });
    if (path === "/batches") return route.fulfill({ json: [{ id: 1, name: "North flock", status: "ACTIVE" }, { id: 2, name: "South flock", status: "ACTIVE" }] });
    if (path === "/analytics/operations/v2") return route.fulfill({ json: summary });
    if (path === "/analytics/batches/compare") return route.fulfill({ json: { requestedWindowDays: 30, effectiveWindowDays: 30, timeZone: "Asia/Manila", warnings: [], batches: [] } });
    if (path === "/financial-transactions/analytics") return route.fulfill({ json: analytics });
    if (path === "/financial-transactions/page") return route.fulfill({ json: { items: [], page: 0, size: 10, totalItems: 0, totalPages: 0, hasPrevious: false, hasNext: false } });
    return route.fulfill({ json: {} });
  });
  await page.goto(url);
  await expect(page.getByRole("heading", { name: "Farm overview" })).toBeVisible();
}

test("separates farm snapshot, activity, finance, and comparison", async ({ page }) => {
  await openFarmOverview(page);
  await expect(page.getByRole("heading", { name: "At a glance" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recorded activity" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Farm finance" })).toHaveCount(0);

  const nav = page.getByRole("navigation", { name: "Farm overview sections" });
  await nav.getByRole("button", { name: "Activity" }).click();
  await expect(page.getByRole("heading", { name: "Recorded activity" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "At a glance" })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Recorded activity" })).toBeVisible();

  await nav.getByRole("button", { name: "Finance" }).click();
  await expect(page.getByRole("heading", { name: "Farm finance" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Net cash flow" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Record transaction" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recorded activity" })).toHaveCount(0);

  await nav.getByRole("button", { name: "Batches" }).click();
  await page.getByText("Compare selected batches").click();
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
  await expect(page.getByRole("heading", { name: "Farm finance" })).toBeVisible();
  const financeWidths = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  expect(financeWidths.document).toBeLessThanOrEqual(financeWidths.viewport + 1);
});

test("explains comparison rates and hides them when population is unverified", async ({ page }) => {
  await openFarmOverview(page);
  const row = { batchId: 1, batchName: "North flock", bloodline: "Sweater", source: null, windowStart: "2026-10-01", windowEnd: "2026-10-30", initialPopulation: 100, populationAtWindowEnd: 90, populationStatus: "VALID", populationWarning: null, firstInvalidEventDate: null, healthRelatedDeaths: 3, healthRelatedLossRatePercent: 3, healthConcerns: 1, interventionRecords: 2, populationChangesByCause: {}, evaluatedAtSelection: null, acceptedAtSelection: null, selectionRatePercent: null, selectionDataStatus: "NO_RECORD", sourceEventCount: 1, sourceProductRecordCount: 2, limitations: [] };
  await page.route("**/api/backend/analytics/batches/compare**", (route) => route.fulfill({ json: { requestedWindowDays: 30, effectiveWindowDays: 30, timeZone: "Asia/Manila", warnings: [], batches: [row, { ...row, batchId: 2, batchName: "South flock", populationStatus: "RECONCILIATION_REQUIRED", populationAtWindowEnd: null, populationWarning: "Review population records", healthRelatedLossRatePercent: 99 }] } }));
  await page.getByRole("navigation", { name: "Farm overview sections" }).getByRole("button", { name: "Batches" }).click();
  await page.getByText("Compare selected batches").click();
  await page.getByRole("button", { name: "North flock" }).click();
  await page.getByRole("button", { name: "South flock" }).click();
  const table = page.getByRole("region", { name: /Batch comparison table/ });
  await expect(table).toContainText("3 / 100 = 3%");
  await expect(table).toContainText("Rate unavailable");
  await expect(table).not.toContainText("99%");
  await expect(table.getByRole("link", { name: /Review records/ })).toHaveAttribute("href", "/batches/2/data-entry?from=batch&view=history");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});


test("shows separate currency reports", async ({ page }) => {
  const php = { currency: "PHP", totals, series: [], categoryTotals: [] };
  const usd = { currency: "USD", totals: { ...totals, recordedIncome: "50", recordedExpense: "20", recordedNetCashFlow: "30" }, series: [], categoryTotals: [] };
  const mixed = { ...financeAnalytics, byCurrency: [php, usd] };
  await openFarmOverview(page, mixed);
  await page.getByRole("navigation", { name: "Farm overview sections" }).getByRole("button", { name: "Finance" }).click();
  await expect(page.getByText("Currencies are reported separately; no conversion is applied.")).toBeVisible();
  await expect(page.getByText("+₱700", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("+USD 30", { exact: true }).first()).toBeVisible();
});

test("opens finance even when no batch is selected in the overview", async ({ page }) => {
  await openFarmOverview(page, financeAnalytics, "/operations?scope=BATCH");
  await expect(page.getByText("Choose a batch to view its summary.")).toBeVisible();
  await page.getByRole("navigation", { name: "Farm overview sections" }).getByRole("button", { name: "Finance" }).click();
  await expect(page.getByRole("heading", { name: "Farm finance" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Record transaction" })).toBeVisible();
  await expect(page.getByText("Choose a batch to view its summary.")).toHaveCount(0);
});
