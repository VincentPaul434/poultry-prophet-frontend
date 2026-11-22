import { expect, test, type Page } from "@playwright/test";

test.use({ serviceWorkers: "block" });

const manager = {
  userId: 7,
  email: "manager@example.test",
  fullName: "Fixture Manager",
  role: "MANAGER",
  farmId: 1,
};

async function mockManagerShell(page: Page) {
  await page.addInitScript((profile) => {
    localStorage.setItem("pp_auth_session", JSON.stringify({ sessionId: "desktop-sidebar", user: profile }));
  }, manager);

  await page.route("**/api/backend/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/backend", "");

    if (path === "/auth/refresh") return route.fulfill({ json: { ...manager, token: "desktop-sidebar-token" } });
    if (path === "/farm") return route.fulfill({ json: { id: 1, name: "Sunrise Farm" } });
    if (path === "/alerts") return route.fulfill({ json: [] });
    if (path === "/alerts/page") {
      return route.fulfill({
        json: { items: [], page: 0, size: 20, totalItems: 0, totalPages: 0, hasPrevious: false, hasNext: false },
      });
    }
    if (path === "/alerts/summary") return route.fulfill({ json: { activeTotal: 3, critical: 0, warning: 3, info: 0 } });
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

test.describe("Desktop sidebar navigation", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "This suite validates the desktop sidebar.");
  });

  test("presents a clear farm context, active route, and readable touch targets", async ({ page }) => {
    await mockManagerShell(page);
    await page.goto("/alerts");

    const sidebar = page.getByTestId("desktop-app-sidebar");
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByTestId("desktop-farm-context").getByText("Sunrise Farm")).toBeVisible();
    await expect(sidebar.getByText("Farm manager", { exact: true })).toBeVisible();

    const navigation = sidebar.getByTestId("desktop-primary-navigation");
    await expect(navigation.getByRole("link")).toHaveCount(6);
    await expect(navigation.getByRole("link", { name: "Finance" })).toHaveCount(0);
    await expect(navigation.getByRole("link", { name: "Farm overview" })).toBeVisible();
    await expect(navigation.getByRole("link", { name: "Alerts" })).toHaveAttribute("aria-current", "page");
    await expect(navigation.getByText("3", { exact: true })).toBeVisible();

    const controlHeights = await navigation.getByRole("link").evaluateAll((links) =>
      links.map((link) => Math.round(link.getBoundingClientRect().height)),
    );
    expect(Math.min(...controlHeights)).toBeGreaterThanOrEqual(44);

    await expect(sidebar.getByRole("button", { name: "Open account menu" })).toBeVisible();
  });
});
