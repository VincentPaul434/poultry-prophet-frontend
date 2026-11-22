import { expect as baseExpect, test, type Page } from "@playwright/test";

const expect = baseExpect.configure({ timeout: 30_000 });

test.use({ serviceWorkers: "block" });
test.setTimeout(90_000);

const manager = { userId: 7, email: "manager@example.test", fullName: "Fixture Manager", role: "MANAGER", farmId: 1 };
const today = "2026-11-19";
type Cycle = {
  id: number; farmId: number; cycleName: string; incubatorCode: string; eggSource: string | null;
  bloodline: string | null; loadedDate: string; eggsLoaded: number; expectedHatchDate: string | null;
  actualHatchDate: string | null; hatchedCount: number | null; unhatchedCount: number | null;
  removedDamagedCount: number | null; status: string; notes: string | null; createdBatchId: number | null;
  createdAt: string; hatchRatePercent: number | null; durationDays: number | null;
};

function cycle(id: number, name: string, expected: string): Cycle {
  return { id, farmId: 1, cycleName: name, incubatorCode: "Incubator A", eggSource: "Own farm", bloodline: "Sweater", loadedDate: "2026-10-29", eggsLoaded: 100, expectedHatchDate: expected, actualHatchDate: null, hatchedCount: null, unhatchedCount: null, removedDamagedCount: null, status: "INCUBATING", notes: null, createdBatchId: null, createdAt: "2026-10-29T08:00:00Z", hatchRatePercent: null, durationDays: null };
}

async function prepare(page: Page, values: Cycle[], role: "MANAGER" | "HANDLER" = "MANAGER") {
  await page.clock.setFixedTime(new Date("2026-11-19T08:00:00Z"));
  await page.addInitScript((profile) => {
    localStorage.setItem("pp_auth_session", JSON.stringify({ sessionId: "hatch-flow-e2e", user: profile }));
    localStorage.setItem("pp_language", "en");
  }, { ...manager, role });
  const cycles = structuredClone(values);
  const calls: Array<{ path: string; body: Record<string, unknown> }> = [];
  await page.route("**/api/backend/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/api/backend", "");
    if (path === "/auth/refresh") return route.fulfill({ json: { ...manager, role, token: "hatch-fixture-token" } });
    if (request.method() === "POST" && /^\/incubation-cycles\/\d+\/(complete|create-batch)$/.test(path)) {
      const id = Number(path.split("/")[2]);
      const found = cycles.find((item) => item.id === id);
      if (!found) return route.fulfill({ status: 404, json: { message: "Cycle not found" } });
      const body = request.postDataJSON() as Record<string, unknown>;
      calls.push({ path, body });
      if (path.endsWith("/complete")) {
        Object.assign(found, body, { status: "COMPLETED", hatchRatePercent: Number(body.hatchedCount), durationDays: 21 });
        return route.fulfill({ json: found });
      }
      found.createdBatchId = 42;
      return route.fulfill({ json: { id: 42, name: `${found.cycleName} Hatch`, farmId: 1 } });
    }
    if (request.method() !== "GET") return route.abort("blockedbyclient");
    if (path === "/farm") return route.fulfill({ json: { id: 1, name: "Fixture farm" } });
    if (path === "/alerts" || path === "/invites/pending" || path === "/batches" || path === "/batches/dashboard" || path === "/batches/archived") return route.fulfill({ json: [] });
    if (path === "/alerts/summary") return route.fulfill({ json: { activeTotal: 0, critical: 0, warning: 0, info: 0 } });
    if (path === "/alerts/page") return route.fulfill({ json: { items: [], page: 0, size: 20, totalItems: 0, totalPages: 0, hasPrevious: false, hasNext: false } });
    if (path === "/incubation-cycles/attention") {
      const items = cycles.flatMap((item) => {
        const kind = item.status === "COMPLETED" && !item.createdBatchId && (item.hatchedCount ?? 0) > 0 ? "BATCH_NEEDED"
          : !["COMPLETED", "CANCELLED"].includes(item.status) && item.expectedHatchDate && item.expectedHatchDate <= today
            ? item.expectedHatchDate === today ? "HATCH_DUE_TODAY" : "HATCH_OVERDUE" : null;
        return kind ? [{ cycleId: item.id, cycleName: item.cycleName, expectedHatchDate: item.expectedHatchDate, actualHatchDate: item.actualHatchDate, hatchedCount: item.hatchedCount, kind, asOfDate: today }] : [];
      });
      return route.fulfill({ json: items });
    }
    if (path === "/incubation-cycles/summary") {
      const active = cycles.filter((item) => !["COMPLETED", "CANCELLED"].includes(item.status));
      return route.fulfill({ json: { active: active.length, completed: cycles.filter((item) => item.status === "COMPLETED").length, cancelled: 0, dueForReview: active.filter((item) => item.expectedHatchDate && item.expectedHatchDate <= today).length, activeEggs: active.reduce((total, item) => total + item.eggsLoaded, 0) } });
    }
    if (path === "/incubation-cycles/page") {
      const view = new URL(request.url()).searchParams.get("view");
      const items = cycles.filter((item) => view === "ALL" || (view === "CLOSED" ? ["COMPLETED", "CANCELLED"].includes(item.status) : !["COMPLETED", "CANCELLED"].includes(item.status)));
      return route.fulfill({ json: { items, page: 0, size: 12, totalItems: items.length, totalPages: items.length ? 1 : 0, hasPrevious: false, hasNext: false } });
    }
    const detail = path.match(/^\/incubation-cycles\/(\d+)$/);
    if (detail) {
      const found = cycles.find((item) => item.id === Number(detail[1]));
      return found ? route.fulfill({ json: found }) : route.fulfill({ status: 404, json: { message: "Cycle not found" } });
    }
    if (path === "/offline/bootstrap") return route.fulfill({ json: { userId: 7, farmId: 1, batches: [], dashboard: [], products: [], tasks: [], vaccinationPlans: {}, overviews: {}, events: {}, inputs: {} } });
    if (path === "/version") return route.fulfill({ json: { application: "poultry-prophet", version: "e2e", commitSha: "e2e", buildTime: "2026-11-19T00:00:00Z", environment: "test", compatibleFrontendVersion: "0.1.0-validation" } });
    if (path === "/health") return route.fulfill({ json: { status: "UP" } });
    return route.fulfill({ json: {} });
  });
  return { calls };
}

test("distinguishes a hatch due today, an overdue hatch and a future hatch", async ({ page }) => {
  const fixture = await prepare(page, [cycle(10, "Due today", today), cycle(11, "Past due", "2026-11-18"), cycle(12, "Not due", "2026-11-20")]);
  await page.goto("/incubation", { waitUntil: "domcontentloaded" });
  const card = (name: string) => page.getByTestId("incubation-cycle-card").filter({ hasText: name });
  await expect(card("Due today")).toContainText("Hatch due today");
  await expect(card("Past due")).toContainText("Hatch overdue");
  await expect(card("Not due")).not.toContainText(/hatch (due today|overdue)/i);
  expect(fixture.calls).toHaveLength(0);
});

test("records the hatch, creates its batch and links to the batch", async ({ page }) => {
  const fixture = await prepare(page, [cycle(10, "Due today", today)]);
  await page.goto("/incubation", { waitUntil: "domcontentloaded" });
  await page.getByTestId("incubation-cycle-card").filter({ hasText: "Due today" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("heading", { name: "Record hatch result" })).toBeVisible();
  await sheet.getByLabel(/^hatched$/i).fill("85");
  await sheet.getByLabel(/^unhatched$/i).fill("10");
  await sheet.getByLabel(/^removed or damaged$/i).fill("4");
  await expect(sheet.getByRole("button", { name: "Save hatch results" })).toBeDisabled();
  await sheet.getByLabel(/^removed or damaged$/i).fill("5");
  await sheet.getByRole("button", { name: "Save hatch results" }).click();
  await expect(sheet.getByRole("button", { name: "Create batch from hatch" })).toBeVisible();
  expect(fixture.calls).toHaveLength(1);
  expect(fixture.calls[0].path).toBe("/incubation-cycles/10/complete");
  expect(fixture.calls[0].body).toMatchObject({ actualHatchDate: today, hatchedCount: 85, unhatchedCount: 10, removedDamagedCount: 5 });
  await sheet.getByRole("button", { name: "Create batch from hatch" }).click();
  const link = sheet.getByRole("link", { name: "View created batch" });
  await expect(link).toHaveAttribute("href", "/batches/42");
  expect(fixture.calls).toHaveLength(2);
  expect(fixture.calls[1].path).toBe("/incubation-cycles/10/create-batch");
  expect(fixture.calls[1].body).toMatchObject({ farmEntryDate: today });
  await link.click();
  await expect(page).toHaveURL(/\/batches\/42(?:[?#].*)?$/);
});

test("a recorded zero hatch does not offer to create a batch", async ({ page }) => {
  const fixture = await prepare(page, [cycle(10, "Zero hatch", today)]);
  await page.goto("/incubation", { waitUntil: "domcontentloaded" });
  await page.getByTestId("incubation-cycle-card").filter({ hasText: "Zero hatch" }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel(/^hatched$/i).fill("0");
  await sheet.getByLabel(/^unhatched$/i).fill("100");
  await sheet.getByLabel(/^removed or damaged$/i).fill("0");
  await sheet.getByRole("button", { name: "Save hatch results" }).click();
  await expect(sheet.getByText("No batch can be created because no chicks were recorded as hatched.")).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Create batch from hatch" })).toHaveCount(0);
  expect(fixture.calls).toHaveLength(1);
});

test("opens the exact incubation cycle from a direct reminder link", async ({ page }) => {
  await prepare(page, [cycle(10, "Due today", today), cycle(11, "Past due", "2026-11-18")]);
  await page.goto("/incubation?cycleId=11", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Past due" })).toBeVisible();
});

test("alerts lead to the due hatch and clear after results and batch creation", async ({ page }) => {
  const fixture = await prepare(page, [cycle(10, "Due today", today), cycle(11, "Not due", "2026-11-20")]);
  await page.goto("/alerts", { waitUntil: "domcontentloaded" });
  const reminders = page.getByRole("region", { name: "Incubation needs attention" });
  await expect(reminders.getByText("Due today", { exact: true })).toBeVisible();
  await expect(reminders.getByText("Not due", { exact: true })).toHaveCount(0);
  await reminders.getByRole("link", { name: "Review hatch" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("heading", { name: "Due today" })).toBeVisible();
  await sheet.getByLabel(/^hatched$/i).fill("85");
  await sheet.getByLabel(/^unhatched$/i).fill("10");
  await sheet.getByLabel(/^removed or damaged$/i).fill("5");
  await sheet.getByRole("button", { name: "Save hatch results" }).click();
  await expect(sheet.getByRole("button", { name: "Create batch from hatch" })).toBeVisible();
  await page.goto("/alerts", { waitUntil: "domcontentloaded" });
  await expect(reminders.getByRole("link", { name: "Review hatch" })).toHaveCount(0);
  await reminders.getByRole("link", { name: "Create batch" }).click();
  await expect(sheet.getByRole("heading", { name: "Due today" })).toBeVisible();
  await sheet.getByRole("button", { name: "Create batch from hatch" }).click();
  await expect(sheet.getByRole("link", { name: "View created batch" })).toBeVisible();
  await page.goto("/alerts", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Incubation needs attention" })).toHaveCount(0);
  expect(fixture.calls.map((call) => call.path)).toEqual(["/incubation-cycles/10/complete", "/incubation-cycles/10/create-batch"]);
});

test("handlers can view reminders without manager-only actions", async ({ page }) => {
  const fixture = await prepare(page, [cycle(10, "Due today", today)], "HANDLER");
  await page.goto("/alerts", { waitUntil: "domcontentloaded" });
  const reminders = page.getByRole("region", { name: "Incubation needs attention" });
  await reminders.getByRole("link", { name: "View incubation" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("heading", { name: "Due today" })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Save hatch results" })).toHaveCount(0);
  await expect(sheet.getByRole("button", { name: "Create batch from hatch" })).toHaveCount(0);
  expect(fixture.calls).toHaveLength(0);
});
