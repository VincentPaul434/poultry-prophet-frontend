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
    if (path === "/auth/refresh") return route.fulfill({ json: { token: "finance-layout-e2e-token", userId: 1, email: "manager@example.test", fullName: "Fixture Manager", role: "MANAGER", farmId: 1 } });

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
    if (!window.localStorage.getItem("pp_auth_session")) window.localStorage.setItem("pp_auth_session", JSON.stringify({ sessionId: "test-session", user: { userId: 1, email: "manager@example.test", fullName: "Fixture Manager", role: "MANAGER", farmId: 1 } }));
  });

  await page.goto(view ? `/finance?view=${view}` : "/finance");
  await expect(page).toHaveURL(/\/operations\?.*section=finance/);
  await expect(page.getByRole("heading", { name: /Farm finance|Finance ng farm/ })).toBeVisible();
}

test.describe("Finance layout", () => {
  test("labels simulated transactions in filtered cash totals and in the ledger", async ({ page }) => {
    await mockFinanceBackend(page, "single");
    await page.route("**/api/backend/financial-transactions/analytics?*", (route) => route.fulfill({ json: {
      ...analyticsBase,
      series: seriesFor("single"),
      byCurrency: [{ currency: "PHP", totals: analyticsBase.totals, series: seriesFor("single"), categoryTotals: analyticsBase.categoryTotals, demoTransactionCount: 1, demoExpenseAmount: "3250", demoIncomeAmount: "0" }],
    } }));
    await page.route("**/api/backend/financial-transactions/page?*", (route) => route.fulfill({ json: {
      items: [{ ...transaction(1), category: "Demo feed", description: "DEMO / TEST DATA; simulated purchase." }, { ...transaction(2), category: "Ordinary feed" }],
      page: 0, size: 10, totalItems: 2, totalPages: 1, hasPrevious: false, hasNext: false,
    } }));
    await openFinance(page, "report");
    await expect(page.getByText("Demo records included.")).toBeVisible();
    await expect(page.getByText(/Net cash flow includes these amounts/)).toContainText("₱3,250");
    await page.getByRole("button", { name: /Transactions/ }).click();
    const list = page.getByTestId("finance-transaction-list");
    await expect(list.getByText("Demo", { exact: true })).toHaveCount(1);
    await expect(list.getByText("Ordinary feed")).toBeVisible();
  });

  test("keeps the report reachable without horizontal overflow on mobile", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith("mobile-chromium-"), "This case is covered by the dedicated mobile Chromium projects.");
    await mockFinanceBackend(page, "single");
    await openFinance(page, "report");

    await page.getByText("View period details").scrollIntoViewIfNeeded();
    await expect(page.getByText("View period details")).toBeVisible();

    const dimensions = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }));
    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
    await expect(page.locator('[role="img"] rect')).toHaveCount(2);

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

  test("switches between the report and a readable transaction ledger", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockFinanceBackend(page, "multi");
    await openFinance(page);

    await expect(page.getByRole("button", { name: /Filters/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Cash movement" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recorded statement" })).toBeVisible();
    await expect(page.getByTestId("finance-transaction-panel")).toHaveCount(0);
    await expect(page.locator('[role="img"] rect')).toHaveCount(6);
    await page.getByText("View period values").click();
    await expect(page.getByRole("table")).toBeVisible();
    await page.getByRole("button", { name: /Transactions/ }).click();
    const panelBounds = await page.getByTestId("finance-transaction-panel").boundingBox();
    expect(panelBounds).not.toBeNull();
    expect(panelBounds!.width).toBeGreaterThanOrEqual(384);
    const listBounds = await page.getByTestId("finance-transaction-list").boundingBox();
    expect(listBounds).not.toBeNull();
    expect(listBounds!.height).toBeGreaterThanOrEqual(320);
    await expect(page.getByTestId("finance-transaction-panel").getByRole("button", { name: /Next/ })).toBeVisible();

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

  test("keeps transaction entry available in farm overview without a selected batch", async ({ page }) => {
    await mockFinanceBackend(page, "single");
    await openFinance(page);
    await page.goto("/operations?section=finance&scope=BATCH&start=2026-10-01&end=2026-10-31");
    await page.route("**/api/backend/financial-transactions", async (route) => {
      await route.fulfill({ json: { id: 99, ...route.request().postDataJSON() } });
    });
    await page.getByRole("button", { name: /Record transaction/i }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator("#finance-scope").selectOption("farm");
    await dialog.locator("#finance-category").selectOption("Feed");
    await dialog.locator("#finance-amount").fill("125");
    const submitted = page.waitForRequest((request) => request.url().endsWith("/financial-transactions") && request.method() === "POST");
    await dialog.getByRole("button", { name: /Save transaction/i }).click();
    expect((await submitted).postDataJSON()).toMatchObject({ batchId: null, category: "Feed", amount: 125, type: "EXPENSE" });
    await expect(dialog).not.toBeVisible();
    await expect(page).toHaveURL(/section=finance/);
  });

  test("preserves finance filters in old bookmarked links", async ({ page }) => {
    await mockFinanceBackend(page, "single");
    await openFinance(page);
    await page.goto("/finance?view=transactions&period=custom&start=2026-01-01&end=2026-01-31&location=batch%3A7");
    await expect(page.getByTestId("finance-transaction-panel")).toBeVisible();
    const params = new URL(page.url()).searchParams;
    expect(params.get("section")).toBe("finance");
    expect(params.get("financeStart")).toBe("2026-01-01");
    expect(params.get("financeEnd")).toBe("2026-01-31");
    expect(params.get("location")).toBe("batch:7");
  });
});
