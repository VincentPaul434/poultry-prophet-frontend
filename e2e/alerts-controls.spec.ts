import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });

test("alert filters request the selected status, severity and sort", async ({ page, context, baseURL }) => {
  if (!baseURL) throw new Error("A local test URL is required");
  const user = { userId: 7, email: "manager@example.test", fullName: "Test Manager", role: "MANAGER", farmId: 1 };
  await context.addInitScript((profile) => localStorage.setItem("pp_auth_session", JSON.stringify({ sessionId: "test", user: profile })), user);
  const queries: string[] = [];
  await context.route("**/api/backend/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/api/backend", "");
    if (path === "/auth/refresh") return route.fulfill({ json: { ...user, token: "test-access" } });
    if (path === "/alerts/page") {
      queries.push(url.search);
      return route.fulfill({ json: { items: [], page: 0, size: 20, totalItems: 0, totalPages: 0, hasPrevious: false, hasNext: false } });
    }
    if (path === "/alerts/summary") return route.fulfill({ json: { activeTotal: 0, critical: 0, warning: 0, info: 0 } });
    if (path === "/farm") return route.fulfill({ json: { id: 1, name: "Test farm" } });
    if (path === "/batches" || path === "/alerts") return route.fulfill({ json: [] });
    if (path === "/offline/bootstrap") return route.fulfill({ json: { userId: 7, farmId: 1, batches: [], dashboard: [], products: [], tasks: [], vaccinationPlans: {}, overviews: {}, events: {}, inputs: {} } });
    return route.fulfill({ json: {} });
  });
  await page.goto("/alerts");
  await expect(page.getByRole("heading", { name: "Alerts" })).toBeVisible();
  await page.getByRole("tab", { name: "All", exact: true }).click();
  await page.getByLabel("Alert severity").selectOption("CRITICAL");
  await page.getByLabel("Alert sort").selectOption("newest");
  await expect.poll(() => queries.some((query) => {
    const params = new URLSearchParams(query);
    return params.get("activeOnly") === "false" && params.get("severity") === "CRITICAL" && params.get("sort") === "newest";
  })).toBe(true);
});
