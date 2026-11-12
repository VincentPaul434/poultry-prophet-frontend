import { expect, test, type Page } from "@playwright/test";

const batches = [
  [1, "October load - Sweater Hatch", 150, 150, "Brooding"],
  [2, "hatch-0001", 200, 200, "Brooding"],
  [3, "september load Hatch", 90, 190, "Brooding"],
  [4, "October", 135, 250, "Brooding"],
  [5, "September-WK", 205, 300, "Brooding"],
  [6, "batch-0012", 140, 500, "Brooding"],
  [7, "bisaya", 47, 200, "Brooding"],
  [8, "boston sweater", -1, 100, "Brooding"],
].map(([id, name, currentPopulation, initialPopulation, stageName]) => ({
  id,
  farmId: 1,
  name,
  currentPopulation,
  initialPopulation,
  populationStatus: name === "boston sweater" ? "RECONCILIATION_REQUIRED" : "VALID",
  populationWarning: name === "boston sweater" ? "Population records need review." : null,
  startDate: "2026-10-01",
  hatchDate: "2026-10-01",
  farmEntryDate: "2026-10-01",
  bloodline: String(name).toLowerCase().includes("sweater") ? "Sweater" : null,
  source: null,
  hatchDateConfirmedAt: null,
  hatchDateConfirmedByUserId: null,
  stageId: 1,
  stageName,
  stageAuto: true,
  status: "ACTIVE",
  handlerUserIds: [2],
  createdAt: "2026-10-01T08:00:00Z",
  archivedAt: null,
  archivedByUserId: null,
  archiveReason: null,
  preArchiveStatus: null,
}));

function dashboardItems() {
  return batches.map((batch) => ({
    batch,
    summary: {
      healthRelatedDeaths: 0,
      accidentalDeaths: 0,
      totalDeaths: 0,
      otherPopulationChanges: 0,
      recordedHealthEvents: 0,
      activeAlertCount: 0,
      highestActiveAlertSeverity: null,
      lastEventDate: null,
      mortalityRatePercent: 0,
      finance: null,
      tasks: { open: 0, overdue: 0 },
    },
  }));
}

const sampleEvents = [
  {
    id: 2,
    batchId: 2,
    handlerId: 2,
    handlerName: "Fixture Handler",
    eventDate: "2026-10-09",
    eventType: "TRANSFER_OUT",
    severityLabel: null,
    affectedCount: 20,
    title: "Transfer out",
    details: null,
    tags: null,
    createdAt: "2026-10-09T10:24:00Z",
    maleDelta: null,
    femaleDelta: -20,
    unclassifiedDelta: null,
    syncStatus: null,
  },
  {
    id: 1,
    batchId: 2,
    handlerId: 2,
    handlerName: "Fixture Handler",
    eventDate: "2026-10-08",
    eventType: "HEALTH_CONCERN",
    severityLabel: "Watch",
    affectedCount: 0,
    title: "Lethargy",
    details: "Observed during morning check.",
    tags: null,
    createdAt: "2026-10-08T09:00:00Z",
    syncStatus: "PENDING",
  },
];

async function mockHandlerBackend(page: Page) {
  await page.route("**/api/backend/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/backend", "");
    if (path === "/auth/refresh") return route.fulfill({ json: { token: "record-picker-e2e-token", userId: 2, email: "handler@example.test", fullName: "Fixture Handler", role: "HANDLER", farmId: 1 } });

    if (path === "/farm") return route.fulfill({ json: { id: 1, name: "Sunrise Farm", location: null, description: null } });
    if (path === "/alerts") return route.fulfill({ json: [] });
    if (path === "/alerts/summary") return route.fulfill({ json: { activeTotal: 0, critical: 0, warning: 0, info: 0 } });
    if (path === "/version") return route.fulfill({ json: { application: "poultry-prophet", version: "e2e", commitSha: "e2e", buildTime: "2026-10-24T00:00:00Z", environment: "test", compatibleFrontendVersion: "0.1.0-validation" } });
    if (path === "/health") return route.fulfill({ json: { status: "UP" } });
    if (path === "/invites/pending") return route.fulfill({ json: [] });
    if (path === "/offline/bootstrap") return route.fulfill({ json: { userId: 2, farmId: 1, batches, dashboard: dashboardItems(), products: [], tasks: [], vaccinationPlans: {}, overviews: {}, events: {}, inputs: {} } });
    if (path === "/batches") return route.fulfill({ json: batches });
    if (path === "/batches/2") return route.fulfill({ json: batches[1] });
    if (path === "/batches/2/events") return route.fulfill({ json: sampleEvents });
    if (path === "/batches/2/records") return route.fulfill({ json: [] });
    if (path === "/inventory/products") return route.fulfill({ json: [] });
    if (path === "/batches/dashboard") return route.fulfill({ json: dashboardItems() });
    if (path === "/tasks/handler-queue/summary") return route.fulfill({ json: { now: 0, upcoming: 0, overdue: 0, completed: 0 } });
    if (path === "/tasks/handler-queue") return route.fulfill({ json: { items: [], page: 0, size: 10, totalItems: 0, totalPages: 0, hasPrevious: false, hasNext: false } });

    return route.fulfill({ json: {} });
  });
}

async function openPicker(page: Page) {
  await page.addInitScript(() => {
    if (!window.localStorage.getItem("pp_auth_session")) window.localStorage.setItem("pp_auth_session", JSON.stringify({ sessionId: "test-session", user: { userId: 2, email: "handler@example.test", fullName: "Fixture Handler", role: "HANDLER", farmId: 1 } }));
  });

  await page.goto("/dashboard");
  await page.getByRole("button", { name: /Record activity/i }).click();
  await expect(page.getByRole("heading", { name: "Record activity" })).toBeVisible();
}

test.describe("Record batch picker", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(!testInfo.project.name.startsWith("mobile-chromium-"), "This suite is reserved for mobile Chromium projects.");
  });

  test("keeps offline recording scoped after refresh rejection until the same handler signs in", async ({ page }) => {
    await mockHandlerBackend(page);
    let syncCalls = 0;
    await page.route("**/api/backend/sync/v2/operations", async route => {
      syncCalls++;
      const body = route.request().postDataJSON() as { operations: { operationId: string }[] };
      await route.fulfill({ json: { results: body.operations.map(item => ({ operationId: item.operationId, status: "APPLIED" })) } });
    });
    await openPicker(page);
    await page.getByRole("button", { name: /hatch-0001/ }).click();
    await expect(page.getByRole("heading", { name: "Record an event" })).toBeVisible();
    await page.route("**/api/backend/auth/refresh", route => route.fulfill({ status: 400, json: { message: "Refresh token expired" } }));
    await page.reload();
    await expect(page.getByRole("heading", { name: "Record an event" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("pp_auth_session") ?? "null")?.authRequired)).toBe(true);
    await page.getByRole("button", { name: "Health concern" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Mild" }).click();
    await dialog.getByRole("group", { name: "Signs noticed" }).getByRole("button").first().click();
    await dialog.getByRole("button", { name: "Save sickness report" }).click();
    await expect(dialog).toBeHidden();
    const queued = async () => page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("poultry-prophet-offline-v1");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const rows = await new Promise<{ userId: number; farmId: number; status: string }[]>((resolve, reject) => {
        const request = db.transaction("outbox").objectStore("outbox").getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      db.close();
      return rows;
    });
    await expect.poll(async () => (await queued()).length).toBe(1);
    expect((await queued())[0]).toMatchObject({ userId: 2, farmId: 1, status: "PENDING" });
    expect(syncCalls).toBe(0);
    // A previous sync attempt can also leave the head explicitly auth-blocked.
    await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("poultry-prophet-offline-v1");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("outbox", "readwrite");
        const store = tx.objectStore("outbox");
        const request = store.getAll();
        request.onsuccess = () => store.put({ ...request.result[0], status: "AUTH_REQUIRED" });
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error);
      });
      db.close();
    });
    const original = { userId: 2, farmId: 1, email: "handler@example.test", fullName: "Fixture Handler", role: "HANDLER", token: "original-access" };
    const different = { ...original, userId: 3, farmId: 2, email: "other@example.test", token: "other-access" };
    let active = different;
    await page.route("**/api/backend/auth/login", route => {
      active = (route.request().postDataJSON() as { email: string }).email === original.email ? original : different;
      return route.fulfill({ json: active });
    });
    await page.route("**/api/backend/auth/refresh", route => route.fulfill({ json: active }));
    await page.getByRole("button", { name: /sign in to send|mag-sign in para maipadala/i }).first().click();
    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel(/^(email|email address)$/i).fill(different.email);
    await page.getByLabel(/^password$/i).fill("password-for-test");
    await page.getByRole("button", { name: /^(mag-sign in|sign in|log in|login)$/i }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    expect(syncCalls).toBe(0);
    expect((await queued())[0]).toMatchObject({ userId: 2, farmId: 1, status: "AUTH_REQUIRED" });
    await page.goto("/login", { waitUntil: "networkidle" });
    await page.getByLabel(/^(email|email address)$/i).fill(original.email);
    await page.getByLabel(/^password$/i).fill("password-for-test");
    await page.getByRole("button", { name: /^(mag-sign in|sign in|log in|login)$/i }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect.poll(() => syncCalls).toBe(1);
    await expect.poll(async () => (await queued()).length).toBe(0);
  });

  test("shows the themed picker and filters active batches", async ({ page }) => {
    await mockHandlerBackend(page);
    await openPicker(page);

    await expect(page.getByText("8 active")).toBeVisible();
    await expect(page.getByPlaceholder("Search batches")).toBeVisible();
    await expect(page.getByRole("button", { name: /October load - Sweater Hatch/ })).toBeVisible();
    await expect(page.getByText("100 initial")).toBeVisible();
    await expect(page.getByText("Count needs review")).toBeVisible();

    await page.getByPlaceholder("Search batches").fill("sweater");
    await expect(page.getByRole("button", { name: /October load - Sweater Hatch/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /boston sweater/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /hatch-0001/ })).toHaveCount(0);

    await page.getByPlaceholder("Search batches").fill("not-a-real-batch");
    await expect(page.getByText("No matching batches")).toBeVisible();
  });

  test("keeps the picker within the mobile viewport and navigates to recording", async ({ page }) => {
    await mockHandlerBackend(page);
    await openPicker(page);

    const recordDimensions = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }));
    expect(recordDimensions.documentWidth).toBeLessThanOrEqual(recordDimensions.viewportWidth + 1);

    await page.getByRole("button", { name: /hatch-0001/ }).click();
    await expect(page).toHaveURL(/\/batches\/2\/data-entry\?from=dashboard#record-event/);
    await expect(page.getByRole("heading", { name: "Record activity" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Record an event" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Bird count change" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Health concern" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Feed or medicine used" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Behavior observed" })).toBeVisible();
    await expect(page.getByText("Activity history")).toBeVisible();
    await expect(page.getByText("20 birds")).toBeVisible();
    await expect(page.getByText("Pending sync")).toBeVisible();
    await expect(page.getByText("Record activity")).toHaveCount(1);

    const dimensions = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }));
    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1);

    await page.getByRole("button", { name: "How records work" }).click();
    await expect(page.getByText(/Choose the event that best describes what happened/)).toBeVisible();
    await page.getByRole("button", { name: "Bird count change" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("dialog").getByRole("heading", { name: "Population change" })).toBeVisible();
  });

  test("names recording fields and supports keyboard operation", async ({ page }) => {
    await mockHandlerBackend(page);
    await page.route("**/api/backend/inventory/products**", (route) => route.fulfill({ json: [{ id: 1, brandName: "Fixture medicine", productType: "MEDICINE", stockOnHand: 10, stockUnit: "bottles", active: true }] }));
    await page.route("**/api/backend/batches/2/sex-composition", (route) => route.fulfill({ json: { maleCount: 100, femaleCount: 100, unclassifiedCount: 0, projectionStatus: "VALID" } }));
    await openPicker(page);
    await page.getByRole("button", { name: /hatch-0001/ }).click();

    const trigger = page.getByRole("button", { name: "Bird count change" });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("How many?")).toBeVisible();
    await dialog.getByText("How many?", { exact: true }).click();
    await expect(dialog.getByLabel("How many?")).toBeFocused();
    await expect(dialog.getByRole("group", { name: "What happened?" })).toBeVisible();
    await dialog.getByRole("button", { name: "Ibang date" }).focus();
    await page.keyboard.press("Enter");
    await expect(dialog.getByLabel("Different date")).toBeVisible();
    await dialog.getByRole("button", { name: "Sale", exact: true }).focus();
    await page.keyboard.press("Space");
    await expect(dialog.getByRole("group", { name: "What happened?" }).getByRole("button", { name: /Sale/ })).toHaveAttribute("aria-pressed", "true");
    await expect(dialog.getByLabel(/Sale purpose/)).toBeVisible();
    await expect(dialog.getByLabel(/Total amount received/)).toBeVisible();
    await expect(dialog.getByLabel(/Buyer/)).toBeVisible();
    await expect(dialog.getByLabel(/Reference/)).toBeVisible();
    await expect(dialog.getByLabel(/Notes/)).toBeVisible();
    await dialog.getByRole("button", { name: "Mixed", exact: true }).click();
    await expect(dialog.getByRole("group", { name: "Which birds were affected?" })).toBeVisible();
    await expect(dialog.getByLabel("Male allocation", { exact: true })).toBeVisible();
    await expect(dialog.getByLabel("Female allocation")).toBeVisible();
    await expect(dialog.getByLabel("Unclassified allocation")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();

    await page.getByRole("button", { name: "Health concern" }).click();
    await expect(dialog.getByLabel("Affected birds")).toBeVisible();
    await expect(dialog.getByLabel(/Notes/)).toBeVisible();
    await expect(dialog.getByRole("group", { name: "Concern level" })).toBeVisible();
    await expect(dialog.getByRole("group", { name: "Signs noticed" })).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Feed or medicine used" }).click();
    await expect(dialog.getByLabel("Product from farm stock")).toBeVisible();
    await expect(dialog.getByLabel("Product / brand")).toBeVisible();
    await expect(dialog.getByLabel(/Units used/)).toBeVisible();
    await expect(dialog.getByRole("group", { name: "Product type" })).toBeVisible();
    await expect(dialog.getByRole("group", { name: "Applied to" })).toBeVisible();
    await dialog.getByRole("button", { name: "Some", exact: true }).click();
    await expect(dialog.getByLabel("Number of birds treated")).toBeVisible();
    await dialog.getByText("More details", { exact: false }).focus();
    await page.keyboard.press("Enter");
    await expect(dialog.getByLabel("Dose guidance or application note")).toBeVisible();
    await expect(dialog.getByLabel("Product notes")).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Behavior observed" }).click();
    await expect(dialog.getByLabel(/Notes/)).toBeVisible();
    await expect(dialog.getByRole("group", { name: "Attention level" })).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: /Measurements/ }).click();
    for (const name of [/Temperature °C/, /Feed grams/, /Water ml/, /^Note/]) {
      await expect(dialog.getByLabel(name)).toBeVisible();
    }
  });
});
