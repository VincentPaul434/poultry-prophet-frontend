import { expect, test, type Page } from "@playwright/test";

test.use({ serviceWorkers: "block" });

const manager = {
  userId: 7,
  email: "manager@example.test",
  fullName: "Fixture Manager",
  role: "MANAGER",
  farmId: 1,
};

async function mockManagerBackend(page: Page) {
  await page.addInitScript((profile) => {
    localStorage.setItem("pp_auth_session", JSON.stringify({ sessionId: "products-manager", user: profile }));
  }, manager);

  await page.route("**/api/backend/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/backend", "");

    if (path === "/auth/refresh") return route.fulfill({ json: { ...manager, token: "products-manager-token" } });
    if (path === "/farm") return route.fulfill({ json: { id: 1, name: "Sunrise Farm" } });
    if (path === "/alerts") return route.fulfill({ json: [] });
    if (path === "/alerts/page") {
      return route.fulfill({
        json: { items: [], page: 0, size: 20, totalItems: 0, totalPages: 0, hasPrevious: false, hasNext: false },
      });
    }
    if (path === "/alerts/summary") return route.fulfill({ json: { activeTotal: 0, critical: 0, warning: 0, info: 0 } });
    if (path === "/batches") return route.fulfill({ json: [{ id: 1, name: "October Hatch" }] });
    if (path === "/inventory/products" || path === "/inventory/pending-review") return route.fulfill({ json: [] });
    if (path === "/inputs/page") {
      return route.fulfill({
        json: {
          items: [{
            id: 1,
            farmId: 1,
            batchId: 1,
            incubationCycleId: null,
            recordedAt: "2026-11-17T08:00:00Z",
            productType: "MEDICINE",
            brandName: "Recovery Plus",
            productName: null,
            quantity: 2,
            unit: "sachets",
            purpose: "Supportive care",
            notes: null,
            farmProductId: 1,
            calculatedCost: 120,
            inventoryStatus: "DEDUCTED",
          }],
          page: 0,
          size: 20,
          totalItems: 1,
          totalPages: 1,
          hasPrevious: false,
          hasNext: false,
        },
      });
    }
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

test("manager products separates inventory from handler-recorded usage history", async ({ page }, testInfo) => {
  await mockManagerBackend(page);
  await page.goto("/inputs");

  await expect(page.getByRole("heading", { name: "Products", exact: true })).toBeVisible();
  await expect(page.getByText("Manage inventory and review product history.")).toBeVisible();

  const tabs = page.getByTestId("product-tabs");
  await expect(tabs.getByRole("tab")).toHaveCount(2);
  await expect(tabs.getByRole("tab", { name: "Inventory" })).toHaveAttribute("aria-selected", "true");
  await expect(tabs.getByRole("tab", { name: "History (1)" })).toBeVisible();
  await expect(tabs.getByRole("tab", { name: /record usage/i })).toHaveCount(0);
  await expect(page.getByText("Record product used", { exact: true })).toHaveCount(0);

  await tabs.getByRole("tab", { name: "History (1)" }).click();
  const history = page.getByRole("region", { name: "Product history" });
  if (testInfo.project.name.startsWith("mobile-chromium-")) {
    const record = history.getByRole("article").filter({ has: page.getByRole("heading", { name: "Recovery Plus" }) });
    await expect(record).toBeVisible();
    await expect(record.getByText("October Hatch", { exact: true })).toBeVisible();
  } else {
    const table = history.getByRole("table");
    await expect(table).toBeVisible();
    await expect(table.getByText("Recovery Plus", { exact: true })).toBeVisible();
    await expect(table.getByRole("cell", { name: "October Hatch" })).toBeVisible();
  }
});

test("refreshes an expired access token and retries adding a product after a 401", async ({ page }) => {
  await mockManagerBackend(page);
  let refreshes = 0;
  const authorizations: string[] = [];
  let created = 0;
  await page.route("**/api/backend/auth/refresh", (route) => {
    refreshes++;
    return route.fulfill({ json: { ...manager, token: refreshes === 1 ? "expired-access" : "renewed-access" } });
  });
  await page.route("**/api/backend/inventory/products", (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    const authorization = route.request().headers().authorization ?? "";
    authorizations.push(authorization);
    if (authorization !== "Bearer renewed-access") return route.fulfill({ status: 401, json: { message: "Authentication required" } });
    created++;
    return route.fulfill({ status: 201, json: { id: 10, brandName: "Test feed", productType: "MEDICINE", stockUnit: "sachet", stockOnHand: 0, active: true } });
  });
  await page.goto("/inputs");
  await page.getByRole("button", { name: "Add product" }).click();
  const dialog = page.getByRole("dialog", { name: "Add farm product" });
  await dialog.getByLabel("Product / brand").fill("Test feed");
  await dialog.getByRole("button", { name: "Save product" }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => created).toBe(1);
  expect(authorizations).toEqual(["Bearer expired-access", "Bearer renewed-access"]);
  expect(refreshes).toBe(2);
});

test("labels only products with demo stock history on mobile", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile-chromium-"), "Mobile inventory cards.");
  await mockManagerBackend(page);
  await page.route("**/api/backend/inventory/products?*", (route) => route.fulfill({ json: [
    { id: 1, brandName: "Mixed demo feed", productType: "FEED", stockUnit: "pack", stockOnHand: 70, averageUnitCost: 65, inventoryValue: 4550, valuationStatus: "VALUED", active: true, lowStock: false, demoStockHistory: true },
    { id: 2, brandName: "Ordinary feed", productType: "FEED", stockUnit: "pack", stockOnHand: 20, averageUnitCost: 70, inventoryValue: 1400, valuationStatus: "VALUED", active: true, lowStock: false, demoStockHistory: false },
  ] }));
  await page.goto("/inputs");
  const demo = page.locator("article").filter({ hasText: "Mixed demo feed" });
  const ordinary = page.locator("article").filter({ hasText: "Ordinary feed" });
  await expect(demo.getByText("Demo stock in history · verify on hand and cost")).toBeVisible();
  await expect(ordinary.getByText(/Demo stock/)).toHaveCount(0);
});

test("manager sets a low-stock threshold for an existing product", async ({ page }) => {
  await mockManagerBackend(page);
  let sent: unknown;
  await page.route("**/api/backend/inventory/products/2/reorder-level", async route => { sent = route.request().postDataJSON(); return route.fulfill({ json: { id: 2, reorderLevel: 5, lowStock: true } }); });
  await page.route("**/api/backend/inventory/products?*", route => route.fulfill({ json: [
    { id: 2, brandName: "Vaccine A", productType: "VACCINE", stockUnit: "vial", stockOnHand: 5, active: true, lowStock: false, demoStockHistory: false },
  ] }));
  await page.goto("/inputs");
  await page.getByRole("button", { name: "Set low-stock reminder for Vaccine A" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Low-stock reminder" });
  await dialog.getByLabel("Remind at or below").fill("5");
  await dialog.getByRole("button", { name: "Save reminder" }).click();
  await expect.poll(() => sent).toEqual({ reorderLevel: 5 });
});
