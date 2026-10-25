import { test, expect, type Page } from "@playwright/test";

type SeriesMode = "empty" | "single" | "multi";

const analyticsBase = {
  scope: "FARM",
  batchId: null,
  batchName: null,
  startDate: "2026-01-01",
  endDate: "2026-10-31",
  currency: "PHP",
  totals: {
    recordedIncome: "10000",
    saleIncome: "10000",
    otherIncome: "0",
    saleTransactionCount: 1,
    recordedExpense: "29250",
    recordedNetCashFlow: "-19250",
    productsConsumedCost: "0",
    totalRecordedBatchCost: "29250",
    recordedContribution: "-19250",
    productCostComplete: true,
    postedTransactionCount: 11,
    voidedTransactionCount: 0,
  },
  categoryTotals: [
    { category: "VACCINE", amount: "15500" },
    { category: "FEED", amount: "12350" },
    { category: "VITAMIN", amount: "1400" },
  ],
  limitations: {
    farmWideCostsExcluded: false,
    message: "All posted finance records are included.",
  },
};

function seriesFor(mode: SeriesMode) {
  if (mode === "empty") return [];
  if (mode === "single") {
    return [{
      periodStart: "2026-10-01",
      periodEnd: "2026-10-31",
      label: "October 2026",
      income: "10000",
      expense: "29250",
      netChange: "-19250",
      cumulativeNetCashFlow: "-19250",
    }];
  }
  return [
    {
      periodStart: "2026-08-01",
      periodEnd: "2026-08-31",
      label: "August 2026",
      income: "0",
      expense: "10000",
      netChange: "-10000",
      cumulativeNetCashFlow: "-10000",
    },
    {
      periodStart: "2026-09-01",
      periodEnd: "2026-09-30",
      label: "September 2026",
      income: "10000",
      expense: "5000",
      netChange: "5000",
      cumulativeNetCashFlow: "-5000",
    },
    {
      periodStart: "2026-10-01",
      periodEnd: "2026-10-31",
      label: "October 2026",
      income: "0",
      expense: "19250",
      netChange: "-19250",
      cumulativeNetCashFlow: "-24250",
    },
  ];
}

function transaction(id: number) {
  return {
    id,
    farmId: 1,
    batchId: null,
    incubationCycleId: null,
    transactionDate: "2026-10-09",
    type: "EXPENSE",
    category: "FEED",
    amount: "4200",
    currency: "PHP",
    counterparty: null,
    description: null,
    sourceType: "MANUAL",
    sourceEventId: null,
    sourceOperationId: null,
    status: "POSTED",
    enteredBy: 1,
    voidReason: null,
    createdAt: "2026-10-09T08:00:00Z",
  };
}

async function mockFinanceBackend(page: Page, mode: SeriesMode) {
  await page.route("**/api/backend/**", async (route) => {
    const requestUrl = new URL(route.request().url());
    const path = requestUrl.pathname.replace("/api/backend", "");

    if (path === "/farm") {
      return route.fulfill({ json: { id: 1, name: "Fixture Farm", location: "Test", description: null } });
    }
    if (path === "/alerts") {
      return route.fulfill({ json: [] });
    }
    if (path === "/alerts/summary") {
      return route.fulfill({ json: { activeTotal: 0, critical: 0, warning: 0, info: 0 } });
    }
    if (path === "/version") {
      return route.fulfill({ json: { application: "poultry-prophet", version: "e2e", commitSha: "e2e", buildTime: "2026-10-24T00:00:00Z", environment: "test", compatibleFrontendVersion: "0.1.0-validation" } });
    }
    if (path === "/health") {
      return route.fulfill({ json: { status: "UP" } });
    }
    if (path === "/offline/bootstrap") {
      return route.fulfill({ json: { userId: 1, farmId: 1, batches: [], dashboard: [], products: [], tasks: [], vaccinationPlans: {}, overviews: {}, events: {}, inputs: {} } });
    }
    if (path === "/batches") {
      return route.fulfill({ json: [] });
    }
    if (path === "/financial-transactions/page") {
      const items = Array.from({ length: 11 }, (_, index) => transaction(index + 1));
      return route.fulfill({ json: { items: items.slice(0, 10), page: 0, size: 10, totalItems: 11, totalPages: 2, hasPrevious: false, hasNext: true } });
    }
    if (path === "/financial-transactions/analytics") {
      return route.fulfill({ json: { ...analyticsBase, series: seriesFor(mode) } });
    }

    return route.fulfill({ json: {} });
  });
}

async function openFinance(page: Page, view?: "report" | "transactions") {
  await page.addInitScript(() => {
    window.localStorage.setItem("pp_auth_token", "finance-layout-e2e-token");
    window.localStorage.setItem("pp_auth_user", JSON.stringify({
      userId: 1,
      email: "manager@example.test",
      fullName: "Fixture Manager",
      role: "MANAGER",
      farmId: 1,
    }));
  });

  await page.goto(view ? `/finance?view=${view}` : "/finance");
  await expect(page.getByRole("heading", { name: /Farm finance|Finance ng farm/ })).toBeVisible();
}

test.describe("Finance layout", () => {
  test("keeps the analytics card reachable without horizontal overflow on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockFinanceBackend(page, "single");
    await openFinance(page, "report");

    await page.getByText("View period details").scrollIntoViewIfNeeded();
    await expect(page.getByText("View period details")).toBeVisible();

    const dimensions = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }));
    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
    await expect(page.locator('[role="img"] circle')).toBeVisible();

    await page.getByRole("button", { name: /Filters/ }).click();
    await expect(page.getByRole("heading", { name: /Finance filters|Mga finance filter/ })).toBeVisible();
    await expect(page.getByLabel("Location")).toBeVisible();
    const openDimensions = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }));
    expect(openDimensions.documentWidth).toBeLessThanOrEqual(openDimensions.viewportWidth + 1);
    await page.getByRole("button", { name: /Cancel/ }).click();
  });

  test("keeps the shared filters visible and the desktop transaction panel readable", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockFinanceBackend(page, "multi");
    await openFinance(page);

    await expect(page.getByRole("button", { name: /Filters/ })).toBeVisible();
    const panelBounds = await page.getByTestId("finance-transaction-panel").boundingBox();
    expect(panelBounds).not.toBeNull();
    expect(panelBounds!.width).toBeGreaterThanOrEqual(384);
    const listBounds = await page.getByTestId("finance-transaction-list").boundingBox();
    expect(listBounds).not.toBeNull();
    expect(listBounds!.height).toBeGreaterThanOrEqual(384);
    await expect(page.getByRole("button", { name: /Next/ })).toBeVisible();
    await expect(page.locator('[role="img"] polyline')).toBeVisible();

    const beforeCancel = page.url();
    await page.getByRole("button", { name: /Filters/ }).click();
    await expect(page.getByRole("heading", { name: /Finance filters|Mga finance filter/ })).toBeVisible();
    await page.getByLabel("Transaction type").selectOption("EXPENSE");
    await page.getByRole("button", { name: /Cancel/ }).click();
    expect(page.url()).toBe(beforeCancel);

    await page.getByRole("button", { name: /Filters/ }).click();
    await page.getByLabel("Transaction type").selectOption("EXPENSE");
    await page.getByLabel("Source").selectOption("MANUAL");
    await page.getByRole("button", { name: /Apply filters/ }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get("type")).toBe("EXPENSE");
    await expect.poll(() => new URL(page.url()).searchParams.get("source")).toBe("MANUAL");
    await expect(page.getByRole("button", { name: /Filters/ })).toContainText("2");
  });

  test("shows an explanatory empty state when there is no chart series", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 600 });
    await mockFinanceBackend(page, "empty");
    await openFinance(page, "report");

    await expect(page.getByText("Add a posted income or expense to see the trend.")).toBeVisible();
    await expect(page.locator('[role="img"]')).toHaveCount(0);
  });
});
