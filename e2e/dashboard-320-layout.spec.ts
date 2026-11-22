import { expect, test, type BrowserContext } from "@playwright/test";

test.use({ serviceWorkers: "block", viewport: { width: 320, height: 721 }, screen: { width: 320, height: 721 } });
test.setTimeout(90_000);

async function mockHandlerDashboard(context: BrowserContext, baseURL: string | undefined) {
  if (!baseURL || !["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname)) throw new Error("This isolated fixture requires localhost");
  const origin = new URL(baseURL).origin;
  const profile = { userId: 8, email: "handler@example.test", fullName: "Fixture Handler", role: "HANDLER", farmId: 1 };
  const batch = { id: 7, farmId: 1, name: "October Sweater Hatch from the North Breeding Pen", initialPopulation: 30, currentPopulation: 20, populationStatus: "VALID", populationWarning: null, startDate: "2026-11-01", hatchDate: "2026-11-01", farmEntryDate: "2026-11-01", bloodline: "Sweater", source: "Own hatch", stageId: 1, stageName: "Brooding", stageAuto: true, status: "ACTIVE", handlerUserIds: [8], createdAt: "2026-11-01T08:00:00Z" };
  const dashboard = [{ batch, summary: { healthRelatedDeaths: 0, accidentalDeaths: 0, totalDeaths: 0, recordedHealthEvents: 0, activeAlertCount: 0, highestActiveAlertSeverity: null, lastEventDate: null, finance: null, tasks: { open: 0, overdue: 0 } } }];
  const blocked: string[] = [];
  await context.addInitScript((user) => { localStorage.setItem("pp_auth_session", JSON.stringify({ sessionId: "320-dashboard-fixture", user })); localStorage.setItem("pp_language", "en"); }, profile);
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== origin) { blocked.push("external request"); return route.abort("blockedbyclient"); }
    if (!url.pathname.startsWith("/api/backend/")) return ["GET", "HEAD"].includes(request.method()) ? route.continue() : route.abort("blockedbyclient");
    const path = url.pathname.replace("/api/backend", "");
    if (path === "/auth/refresh" && request.method() === "POST") return route.fulfill({ json: { ...profile, token: "fixture-token" } });
    if (request.method() !== "GET") { blocked.push(`unexpected write ${path}`); return route.abort("blockedbyclient"); }
    if (path === "/farm") return route.fulfill({ json: { id: 1, name: "North Field Farm", location: null, description: null } });
    if (path === "/batches/dashboard") return route.fulfill({ json: dashboard });
    if (path === "/alerts" || path === "/batches" || path === "/batches/archived" || path === "/incubation-cycles/attention" || path === "/invites/pending") return route.fulfill({ json: [] });
    if (path === "/alerts/summary") return route.fulfill({ json: { activeTotal: 0, critical: 0, warning: 0, info: 0 } });
    if (path === "/tasks/handler-queue/summary") return route.fulfill({ json: { now: 0, upcoming: 0, done: 0 } });
    if (path === "/tasks/handler-queue") return route.fulfill({ json: { items: [], page: 0, size: 10, totalItems: 0, totalPages: 0, hasNext: false, hasPrevious: false } });
    if (path === "/offline/bootstrap") return route.fulfill({ json: { userId: 8, farmId: 1, batches: [batch], dashboard, products: [], tasks: [], vaccinationPlans: {}, overviews: {}, events: {}, inputs: {} } });
    if (path === "/version") return route.fulfill({ json: { application: "poultry-prophet", version: "test", environment: "test" } });
    if (path === "/health") return route.fulfill({ json: { status: "UP" } });
    return route.fulfill({ status: 404, json: { message: "Unexpected fixture request" } });
  });
  return { batch, blocked };
}

test("handler dashboard stays readable and usable on a 320px phone", async ({ page, context, baseURL }, testInfo) => {
  const { batch, blocked } = await mockHandlerDashboard(context, baseURL);
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Batches", exact: true })).toBeVisible({ timeout: 45_000 });
  const summary = page.getByTestId("dashboard-summary");
  for (const label of ["Needs attention", "Open tasks"]) {
    const text = summary.getByText(label, { exact: true });
    await expect(text).toBeVisible();
    const dimensions = await text.evaluate((element) => ({ width: element.clientWidth, scrollWidth: element.scrollWidth, textOverflow: getComputedStyle(element).textOverflow }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width + 1);
    expect(dimensions.textOverflow).not.toBe("ellipsis");
  }
  const nav = page.getByRole("navigation", { name: "Mobile navigation" });
  for (const label of ["Home", "Tasks", "Incubation", "Alerts"]) {
    const link = nav.getByRole("link", { name: label, exact: true });
    await expect(link).toBeVisible();
    const dimensions = await link.locator("span").first().evaluate((element) => ({ width: element.clientWidth, scrollWidth: element.scrollWidth }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width + 1);
  }
  await expect(nav.getByRole("button", { name: "Record activity" })).toBeVisible();
  await expect(page.getByRole("button", { name: /new batch/i })).toBeVisible();
  await expect(page.getByText(batch.name, { exact: true })).toBeVisible();
  await page.getByRole("heading", { name: "Batches", exact: true }).scrollIntoViewIfNeeded();
  const mobileScreenshot = await page.screenshot();
  await testInfo.attach("dashboard-320", { body: mobileScreenshot, contentType: "image/png" });
  if (process.env.DASHBOARD_SCREENSHOTS_DIR) await page.screenshot({ path: `${process.env.DASHBOARD_SCREENSHOTS_DIR}/dashboard-handler-320.png` });
  const dimensions = await page.evaluate(() => ({ documentWidth: document.documentElement.scrollWidth, viewportWidth: window.innerWidth }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
  const search = page.getByRole("textbox", { name: "Search batches" });
  await search.fill("not-a-fixture");
  await expect(page.getByText("No batches match your search.")).toBeVisible();
  await search.clear();
  await expect(page.getByText(batch.name, { exact: true })).toBeVisible();
  await expect(page.getByLabel("Filter batches by stage")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  const largerScreenshot = await page.screenshot();
  await testInfo.attach("dashboard-390", { body: largerScreenshot, contentType: "image/png" });
  if (process.env.DASHBOARD_SCREENSHOTS_DIR) await page.screenshot({ path: `${process.env.DASHBOARD_SCREENSHOTS_DIR}/dashboard-handler-390.png` });
  const largerViewport = await page.evaluate(() => ({ documentWidth: document.documentElement.scrollWidth, viewportWidth: window.innerWidth }));
  expect(largerViewport.documentWidth).toBeLessThanOrEqual(largerViewport.viewportWidth + 1);
  expect(blocked).toEqual([]);
});

test.describe("Mobile Tasks navigation", () => {
  test.use({ hasTouch: true });

  for (const viewport of [{ width: 320, height: 721 }, { width: 390, height: 844 }]) {
    test(`handler can tap Home from Tasks at ${viewport.width}px`, async ({ page, context, baseURL }) => {
      await mockHandlerDashboard(context, baseURL);
      await page.setViewportSize(viewport);
      await page.goto("/tasks");
      await expect(page.getByRole("heading", { name: "My tasks", exact: true })).toBeVisible();
      const nav = page.getByRole("navigation", { name: "Mobile navigation" });
      await nav.getByRole("link", { name: "Home", exact: true }).tap({ timeout: 5000 });
      await expect(page).toHaveURL(/\/dashboard$/);
      await expect(page.getByRole("heading", { name: "Batches", exact: true })).toBeVisible();
    });
  }
});
