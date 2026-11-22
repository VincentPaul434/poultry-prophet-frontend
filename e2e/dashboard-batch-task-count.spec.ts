import { expect, test, type Page } from "@playwright/test";

test.use({ serviceWorkers: "block", viewport: { width: 320, height: 721 } });
test.setTimeout(90_000);

async function openDashboard(page: Page, origin: string, role: "HANDLER" | "MANAGER") {
  const user = { userId: 8, farmId: 1, role, email: "fixture@example.test", fullName: "Fixture User" };
  const batches = [7, 8, 9, 10].map((id) => ({ id, farmId: 1, name: `Fixture batch ${id}`,
    initialPopulation: 30, currentPopulation: 25, populationStatus: "VALID", populationWarning: null,
    startDate: "2026-11-01", hatchDate: "2026-11-01", farmEntryDate: "2026-11-01", bloodline: "Fixture",
    source: null, stageId: 1, stageName: "Brooding", stageAuto: true, status: "ACTIVE", handlerUserIds: [8],
    createdAt: "2026-11-01T00:00:00Z" }));
  const dashboard = batches.map((batch) => ({ batch, summary: { healthRelatedDeaths: 0, accidentalDeaths: 0,
    totalDeaths: 0, recordedHealthEvents: 0, activeAlertCount: 0, highestActiveAlertSeverity: null,
    lastEventDate: null, finance: null } }));
  const counts: Record<string, { open: number; late: number }> = role === "HANDLER"
    ? { "7": { open: 3, late: 1 }, "8": { open: 0, late: 0 }, "9": { open: 2, late: 0 } }
    : { "7": { open: 5, late: 2 }, "8": { open: 0, late: 0 }, "9": { open: 4, late: 0 } };
  await page.addInitScript((profile) => {
    localStorage.setItem("pp_auth_session", JSON.stringify({ sessionId: "batch-task-count-fixture", user: profile }));
    localStorage.setItem("pp_language", "en");
  }, user);
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== origin) return route.abort("blockedbyclient");
    if (!url.pathname.startsWith("/api/backend/")) return ["GET", "HEAD"].includes(request.method()) ? route.continue() : route.abort("blockedbyclient");
    const path = url.pathname.slice("/api/backend".length);
    if (path === "/auth/refresh" && request.method() === "POST") return route.fulfill({ json: { ...user, token: "fixture-token" } });
    if (request.method() !== "GET") return route.abort("blockedbyclient");
    if (path === "/tasks/summary") {
      const batchId = url.searchParams.get("batchId");
      if (batchId === "10") return route.fulfill({ status: 403, json: { message: "Unavailable" } });
      const summary = batchId ? counts[batchId] : { open: 20, late: 3 };
      if (!summary) return route.fulfill({ status: 404 });
      return route.fulfill({ json: { ...summary, today: 0, upcoming: summary.open - summary.late, noDueDate: 0, completed: 9, cancelled: 2 } });
    }
    if (path === "/batches/dashboard") return route.fulfill({ json: dashboard });
    if (path === "/farm") return route.fulfill({ json: { id: 1, name: "Fixture farm" } });
    if (["/alerts", "/batches", "/batches/archived", "/incubation-cycles/attention", "/invites/pending"].includes(path)) return route.fulfill({ json: [] });
    if (path === "/alerts/summary") return route.fulfill({ json: { activeTotal: 0, critical: 0, warning: 0, info: 0 } });
    if (path === "/tasks/handler-queue/summary") return route.fulfill({ json: { now: 0, upcoming: 0, completed: 0, vaccinationReminders: 0 } });
    if (path === "/tasks/handler-queue") return route.fulfill({ json: { items: [], page: 0, size: 10, totalItems: 0, totalPages: 0, hasPrevious: false, hasNext: false } });
    if (path === "/offline/bootstrap") return route.fulfill({ json: { userId: 8, farmId: 1, role, batches, dashboard, products: [], tasks: [], vaccinationPlans: {}, overviews: {}, events: {}, inputs: {} } });
    if (path === "/version") return route.fulfill({ json: { application: "poultry-prophet", version: "test", environment: "test" } });
    if (path === "/health") return route.fulfill({ json: { status: "UP" } });
    return route.fulfill({ status: 404, json: { message: "Unexpected fixture request" } });
  });
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Active batches: 4")).toBeVisible({ timeout: 45_000 });
  const metric = (id: number) => page.locator(".ledger-batch-card").filter({ has: page.getByRole("link", { name: `Fixture batch ${id}`, exact: true }) }).getByText("Tasks", { exact: true }).locator("..");
  return { metric, counts };
}

for (const role of ["HANDLER", "MANAGER"] as const) {
  test(`${role.toLowerCase()} sees distinct batch task counts, including zero and overdue`, async ({ page, baseURL }) => {
    if (!baseURL || new URL(baseURL).hostname !== "localhost") throw new Error("The fixture requires localhost");
    const { metric, counts } = await openDashboard(page, new URL(baseURL).origin, role);
    await expect(page.getByRole("heading", { name: "No active alerts or count issues" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "All good" })).toHaveCount(0);
    for (const id of [7, 8, 9]) {
      await expect(metric(id).locator("span").first()).toHaveText(String(counts[String(id)].open));
    }
    await expect(metric(7)).toHaveAttribute("aria-label", `${counts["7"].open} tasks; ${counts["7"].late} overdue`);
    await expect(metric(7).getByText(`${counts["7"].late} overdue`, { exact: true })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(metric(9).locator("span").first()).toHaveText(String(counts["9"].open));
    await page.getByRole("textbox", { name: "Search batches" }).fill("Fixture batch 9");
    await expect(metric(9).locator("span").first()).toHaveText(String(counts["9"].open));
  });

  test(`${role.toLowerCase()} sees an unavailable batch count instead of a false zero`, async ({ page, baseURL }) => {
    if (!baseURL || new URL(baseURL).hostname !== "localhost") throw new Error("The fixture requires localhost");
    const failed = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname === "/api/backend/tasks/summary" && url.searchParams.get("batchId") === "10" && response.status() === 403;
    });
    const { metric } = await openDashboard(page, new URL(baseURL).origin, role);
    await failed;
    await expect(metric(10).locator("span").first()).toHaveText("—");
  });
}
