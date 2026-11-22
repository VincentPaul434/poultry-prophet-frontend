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

test("manager products separates inventory from handler-recorded usage history", async ({ page }) => {
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
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByText("Recovery Plus", { exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "October Hatch" })).toBeVisible();
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
