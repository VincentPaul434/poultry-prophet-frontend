import { expect, test, type Page } from "@playwright/test";

test.use({ serviceWorkers: "block" });

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));

  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
}

test.describe("Mobile responsive smoke tests", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(
      !testInfo.project.name.startsWith("mobile-chromium-"),
      "This suite is reserved for the configured mobile Chromium projects.",
    );
  });

  test("landing page fits the mobile viewport", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: /Malinaw na tala, mula kulungan hanggang report/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("authentication pages fit the mobile viewport", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /Balikan ang iyong farm/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto("/register");
    await expect(page.getByRole("heading", { name: /Simulan ang farm record/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("mobile farm header keeps controls and long identity text from overlapping", async ({ page, context }) => {
    const user = {
      userId: 7,
      email: "manager@example.test",
      fullName: "Fixture Manager",
      role: "MANAGER",
      farmId: 1,
    };
    const farmName = "San Isidro Champion Gamefowl Breeding and Training Farm";

    await context.addInitScript((profile) => {
      localStorage.setItem("pp_auth_session", JSON.stringify({ sessionId: "mobile-header-test", user: profile }));
      localStorage.setItem("pp_language", "taglish");
    }, user);
    await context.route("**/api/backend/**", async (route) => {
      const path = new URL(route.request().url()).pathname.replace("/api/backend", "");
      if (path === "/auth/refresh") return route.fulfill({ json: { ...user, token: "mobile-header-test-token" } });
      if (path === "/farm") return route.fulfill({ json: { id: 1, name: farmName } });
      if (path === "/alerts/page") {
        return route.fulfill({
          json: { items: [], page: 0, size: 20, totalItems: 0, totalPages: 0, hasPrevious: false, hasNext: false },
        });
      }
      if (path === "/alerts/summary") {
        return route.fulfill({ json: { activeTotal: 0, critical: 0, warning: 0, info: 0 } });
      }
      if (path === "/offline/bootstrap") {
        return route.fulfill({
          json: {
            userId: 7,
            farmId: 1,
            batches: [],
            dashboard: [],
            products: [],
            tasks: [],
            vaccinationPlans: {},
            overviews: {},
            events: {},
            inputs: {},
          },
        });
      }
      if (path === "/version") {
        return route.fulfill({
          json: {
            application: "poultry-prophet",
            version: "e2e",
            commitSha: "e2e",
            buildTime: "2026-11-17T00:00:00Z",
            environment: "test",
            compatibleFrontendVersion: "0.1.0-validation",
          },
        });
      }
      if (path === "/health") return route.fulfill({ json: { status: "UP" } });
      if (path === "/batches" || path === "/alerts") return route.fulfill({ json: [] });
      return route.fulfill({ json: {} });
    });

    await page.goto("/alerts");
    await expect(page.getByRole("heading", { name: "Babala" })).toBeVisible();

    const header = page.getByTestId("mobile-app-header");
    await expect(header.getByText(farmName)).toBeVisible();
    await expect(header.getByText("Tagapamahala")).toBeVisible();
    const navigation = page.getByRole("navigation", { name: "Mga pahina sa telepono" });
    await expect(navigation.getByRole("link")).toHaveCount(3);
    await expect(navigation.getByRole("link", { name: "Pananalapi" })).toHaveCount(0);
    await expect(navigation.getByRole("link", { name: "Buod ng manukan" })).toBeVisible();
    await expect(navigation.getByRole("button", { name: "Buksan ang iba pang pahina" })).toBeVisible();

    const columns = await header.evaluate((element) => {
      const [left, center, right] = Array.from(element.children).map((child) => child.getBoundingClientRect());
      return {
        leftRight: left.right,
        centerLeft: center.left,
        centerRight: center.right,
        rightLeft: right.left,
      };
    });

    expect(columns.leftRight).toBeLessThanOrEqual(columns.centerLeft + 0.5);
    expect(columns.centerRight).toBeLessThanOrEqual(columns.rightLeft + 0.5);
    await expectNoHorizontalOverflow(page);
  });

  test("handler header puts connection status beside the profile and the system mark on the left", async ({ page, context }) => {
    const user = {
      userId: 8,
      email: "handler@example.test",
      fullName: "Fixture Handler",
      role: "HANDLER",
      farmId: 1,
    };
    const farmName = "San Isidro Champion Gamefowl Breeding and Training Farm";

    await context.addInitScript((profile) => {
      localStorage.setItem("pp_auth_session", JSON.stringify({ sessionId: "handler-header-test", user: profile }));
      localStorage.setItem("pp_language", "taglish");
    }, user);
    await context.route("**/api/backend/**", async (route) => {
      const path = new URL(route.request().url()).pathname.replace("/api/backend", "");
      if (path === "/auth/refresh") return route.fulfill({ json: { ...user, token: "handler-header-test-token" } });
      if (path === "/farm") return route.fulfill({ json: { id: 1, name: farmName } });
      if (path === "/alerts/page") {
        return route.fulfill({
          json: { items: [], page: 0, size: 20, totalItems: 0, totalPages: 0, hasPrevious: false, hasNext: false },
        });
      }
      if (path === "/alerts/summary") return route.fulfill({ json: { activeTotal: 0, critical: 0, warning: 0, info: 0 } });
      if (path === "/offline/bootstrap") {
        return route.fulfill({
          json: {
            userId: 8,
            farmId: 1,
            batches: [],
            dashboard: [],
            products: [],
            tasks: [],
            vaccinationPlans: {},
            overviews: {},
            events: {},
            inputs: {},
          },
        });
      }
      if (path === "/version") {
        return route.fulfill({
          json: {
            application: "poultry-prophet",
            version: "e2e",
            commitSha: "e2e",
            buildTime: "2026-11-17T00:00:00Z",
            environment: "test",
            compatibleFrontendVersion: "0.1.0-validation",
          },
        });
      }
      if (path === "/health") return route.fulfill({ json: { status: "UP" } });
      if (path === "/batches" || path === "/alerts") return route.fulfill({ json: [] });
      return route.fulfill({ json: {} });
    });

    await page.goto("/alerts");
    await expect(page.getByRole("heading", { name: "Babala" })).toBeVisible();

    const header = page.getByTestId("mobile-app-header");
    const logo = header.getByTestId("mobile-app-logo");
    const identity = header.getByTestId("mobile-farm-identity");
    const status = header.getByRole("status");
    const profile = header.getByRole("button", { name: "Buksan ang mga pagpipilian sa sarili" });
    await expect(logo).toBeVisible();
    await expect(status).toBeVisible();
    await expect(profile).toBeVisible();

    const columns = await Promise.all([logo, identity, status, profile].map((locator) => locator.evaluate((element) => {
      const { left, right } = element.getBoundingClientRect();
      return { left, right };
    })));
    expect(columns[0].right).toBeLessThanOrEqual(columns[1].left + 0.5);
    expect(columns[1].right).toBeLessThanOrEqual(columns[2].left + 0.5);
    expect(columns[2].right).toBeLessThanOrEqual(columns[3].left + 0.5);
    await expectNoHorizontalOverflow(page);
  });
});
