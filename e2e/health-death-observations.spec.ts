import { expect, test, type Page } from "@playwright/test";

test.use({ serviceWorkers: "block" });

type EventPayload = { eventType: string; details: string | null; tags: string | null; affectedCount: number; sexAllocation?: { maleDelta: number; femaleDelta: number; unclassifiedDelta: number } | null };
type SyncOperation = { operationId: string; entityType: string; payload: EventPayload };

const handler = { userId: 2, email: "handler@example.test", fullName: "Fixture Handler", role: "HANDLER", farmId: 1 };
const manager = { userId: 1, email: "manager@example.test", fullName: "Fixture Manager", role: "MANAGER", farmId: 1 };
const batch = { id: 2, farmId: 1, name: "Fixture flock", currentPopulation: 100, initialPopulation: 100, populationStatus: "VALID", populationWarning: null, startDate: "2026-01-01", hatchDate: "2026-01-01", farmEntryDate: "2026-01-01", stageId: 1, stageName: "Brooding", stageAuto: true, status: "ACTIVE", handlerUserIds: [2] };

async function mockBackend(page: Page, withSexComposition = false) {
  const synced: SyncOperation[] = [];
  await page.addInitScript(user => { if (!localStorage.getItem("pp_auth_session")) localStorage.setItem("pp_auth_session", JSON.stringify({ sessionId: "health-death-test", user })); }, handler);
  await page.route("**/api/backend/**", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/api/backend", "");
    if (path === "/auth/refresh") return route.fulfill({ json: { ...handler, token: "fixture-token" } });
    if (path === "/farm") return route.fulfill({ json: { id: 1, name: "Fixture Farm" } });
    if (path === "/alerts/summary") return route.fulfill({ json: { activeTotal: 0, critical: 0, warning: 0, info: 0 } });
    if (path === "/health") return route.fulfill({ json: { status: "UP" } });
    if (path === "/version") return route.fulfill({ json: { application: "poultry-prophet", version: "e2e", commitSha: "e2e", buildTime: "2026-11-19T00:00:00Z", environment: "test", compatibleFrontendVersion: "0.1.0-validation", offlineCapabilities: { protocolVersions: [2], commandReceipts: true, schemaReady: true, receiptEntityTypes: ["BATCH_EVENT"] } } });
    if (path === "/offline/bootstrap") return route.fulfill({ json: { userId: 2, farmId: 1, batches: [batch], dashboard: [], products: [], tasks: [], vaccinationPlans: {}, overviews: {}, events: {}, inputs: {} } });
    if (path === "/sync/v2/operations" && request.method() === "POST") {
      const operations = (request.postDataJSON() as { operations: SyncOperation[] }).operations;
      synced.push(...operations);
      return route.fulfill({ json: { results: operations.map(item => ({ operationId: item.operationId, status: "APPLIED", entityId: 71 })) } });
    }
    if (path === "/batches/2") return route.fulfill({ json: batch });
    if (path === "/batches") return route.fulfill({ json: [batch] });
    if (path === "/batches/2/sex-composition") return route.fulfill({ json: withSexComposition ? { observedOn: "2026-11-18", maleCount: 50, femaleCount: 50, unclassifiedCount: 0, projectionStatus: "VALID" } : null });
    if (["/alerts", "/invites/pending", "/batches/2/events", "/batches/2/records", "/inventory/products"].includes(path)) return route.fulfill({ json: [] });
    return route.fulfill({ json: {} });
  });
  return synced;
}

async function openHealthDeath(page: Page) {
  await page.goto("/batches/2/data-entry");
  await page.getByRole("button", { name: "Bird count change" }).click();
  const dialog = page.getByRole("dialog", { name: "Population change" });
  await dialog.getByRole("button", { name: "Health-related death", exact: true }).click();
  return dialog;
}

async function queuedOperations(page: Page): Promise<SyncOperation[]> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("poultry-prophet-offline-v1");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const rows = await new Promise<SyncOperation[]>((resolve, reject) => {
      const request = db.transaction("outbox").objectStore("outbox").getAll();
      request.onsuccess = () => resolve(request.result as SyncOperation[]);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return rows;
  });
}

test("requires a real observation choice and rejects blank signs", async ({ page }) => {
  const synced = await mockBackend(page);
  const dialog = await openHealthDeath(page);
  await dialog.getByRole("button", { name: "Save population event" }).click();
  await expect(dialog.getByRole("alert")).toContainText(/choose|observ/i);
  expect(synced).toHaveLength(0);
  await dialog.getByRole("radio", { name: "Signs noticed", exact: true }).check();
  const signs = dialog.getByLabel("Describe the signs");
  await signs.fill("   ");
  await dialog.getByRole("button", { name: "Save population event" }).click();
  await expect(dialog.getByRole("alert")).toContainText(/describe|sign/i);
  expect(synced).toHaveLength(0);
  await signs.fill("  Difficulty breathing before death  ");
  await dialog.getByLabel(/^Additional notes/).fill("  Observed during morning check  ");
  await dialog.getByRole("button", { name: "Save population event" }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => synced.length).toBe(1);
  expect(synced[0].payload).toMatchObject({ eventType: "HEALTH_DEATH", deathObservation: "SIGNS", deathSigns: "Difficulty breathing before death", details: "Signs noticed: Difficulty breathing before death\nObserved during morning check" });
});

for (const [choice, expected, observation] of [["No signs noticed", "No signs noticed.", "NO_SIGNS"], ["Not observed / unknown", "Signs not observed / unknown.", "UNKNOWN"]] as const) {
  test(`records '${choice}' without inventing a diagnosis`, async ({ page }) => {
    const synced = await mockBackend(page);
    const dialog = await openHealthDeath(page);
    await dialog.getByRole("radio", { name: choice, exact: true }).check();
    await dialog.getByRole("button", { name: "Save population event" }).click();
    await expect(dialog).toBeHidden();
    await expect.poll(() => synced.length).toBe(1);
    expect(synced[0].payload).toMatchObject({ eventType: "HEALTH_DEATH", deathObservation: observation, deathSigns: null, details: expected });
  });
}

test("preserves observations with sex allocation and keeps non-health events independent", async ({ page }) => {
  const synced = await mockBackend(page, true);
  const dialog = await openHealthDeath(page);
  await dialog.getByRole("radio", { name: "Signs noticed", exact: true }).check();
  await dialog.getByLabel("Describe the signs").fill("Not eating");
  await dialog.getByRole("button", { name: "Accidental death", exact: true }).click();
  await expect(dialog.getByRole("radio", { name: "Signs noticed", exact: true })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Male", exact: true }).click();
  await dialog.getByRole("button", { name: "Save population event" }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => synced.length).toBe(1);
  expect(synced[0].payload).toMatchObject({ eventType: "ACCIDENTAL_DEATH", details: null });
  await page.getByRole("button", { name: "Bird count change" }).click();
  await dialog.getByRole("button", { name: "Health-related death", exact: true }).click();
  await dialog.getByRole("radio", { name: "Signs noticed", exact: true }).check();
  await dialog.getByLabel("Describe the signs").fill("Not eating");
  await dialog.getByRole("button", { name: "Male", exact: true }).click();
  await dialog.getByRole("button", { name: "Save population event" }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => synced.length).toBe(2);
  expect(synced[1].payload).toMatchObject({ eventType: "HEALTH_DEATH", deathObservation: "SIGNS", deathSigns: "Not eating", details: "Signs noticed: Not eating", sexAllocation: { maleDelta: -1, femaleDelta: 0, unclassifiedDelta: 0 } });
});

test("retains the observation in the offline queue and sends it after reconnecting", async ({ page }) => {
  const synced = await mockBackend(page);
  const dialog = await openHealthDeath(page);
  await page.context().setOffline(true);
  await dialog.getByRole("radio", { name: "Signs noticed", exact: true }).check();
  await dialog.getByLabel("Describe the signs").fill("Ruffled feathers and weakness");
  await dialog.getByRole("button", { name: "Save population event" }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(async () => (await queuedOperations(page)).length).toBe(1);
  expect((await queuedOperations(page))[0].payload).toMatchObject({ eventType: "HEALTH_DEATH", deathObservation: "SIGNS", deathSigns: "Ruffled feathers and weakness", details: "Signs noticed: Ruffled feathers and weakness" });
  await page.context().setOffline(false);
  await expect.poll(() => synced.length, { timeout: 30000 }).toBe(1);
  expect(synced[0].payload.details).toBe("Signs noticed: Ruffled feathers and weakness");
});

test("shows the handler's recorded signs in the manager's death summary", async ({ page }) => {
  const synced = await mockBackend(page);
  const dialog = await openHealthDeath(page);
  await dialog.getByRole("radio", { name: "Signs noticed", exact: true }).check();
  await dialog.getByLabel("Describe the signs").fill("Breathing difficulty and stopped eating");
  await dialog.getByRole("button", { name: "Save population event" }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => synced.length).toBe(1);
  const details = synced[0].payload.details;
  expect(details).toBe("Signs noticed: Breathing difficulty and stopped eating");
  const event = { id: 71, batchId: 2, handlerId: 2, handlerName: "Fixture Handler", eventDate: "2026-11-19", eventType: "HEALTH_DEATH", title: "Health-related death", affectedCount: 1, details, tags: null, populationDelta: -1, createdAt: "2026-11-19T08:00:00Z" };
  const payload = {
    reportTitle: "Batch review report", disclaimer: "Recorded history for human review.", payloadVersion: "1", periodStart: "2026-01-01", periodEnd: "2026-11-19", asOfDate: "2026-11-19",
    batch: { batchId: 2, batchName: batch.name, bloodline: null, source: null, initialPopulation: 100, currentPopulation: 99, currentPopulationDisplay: "99 / 100", ageDays: 323, stageName: "Brooding", startDate: "2026-01-01", lastRecordedEventDate: "2026-11-19" },
    population: { initialPopulation: 100, currentPopulation: 99, calculatedPopulationFromEvents: 99, reconciliationRequired: false, reconciliationMessage: null, healthRelatedDeaths: 1, healthRelatedLossPercentage: 1, totalDeaths: 1, accidentalDeaths: 0, predation: 0, missing: 0, returned: 0, transfersOut: 0, transfersIn: 0, sales: 0, culling: 0, countCorrections: 0, legacyMortalityRecords: 0, sourceEventCount: 1, categoryCounts: {} },
    healthEvents: [{ sourceEventId: 71, eventDate: event.eventDate, eventType: event.eventType, title: event.title, severity: null, affectedCount: 1, details, tags: null, recordedBy: 2 }],
    productUse: [], incubation: null, finance: null, dataAvailability: [], selectionSummary: null, sexComposition: null, reviewInstructions: { status: "NOT_REVIEWED", managerNotes: null, nextReviewDate: null, reviewedBy: null, reviewedAt: null },
  };
  await page.evaluate(user => localStorage.setItem("pp_auth_session", JSON.stringify({ sessionId: "manager-review-test", user })), manager);
  await page.route("**/api/backend/auth/refresh", route => route.fulfill({ json: { ...manager, token: "manager-fixture-token" } }));
  await page.route("**/api/backend/batches/2/selection-review/preview", route => route.fulfill({ json: payload }));
  await page.route("**/api/backend/batches/2/selection-reviews", route => route.fulfill({ json: [] }));
  await page.route("**/api/backend/batches/2/vaccination-plan", route => route.fulfill({ json: [] }));
  await page.route("**/api/backend/batches/2/events/page?**", route => {
    const type = new URL(route.request().url()).searchParams.get("type");
    return route.fulfill({ json: { items: type === "HEALTH_DEATH" ? [event] : [], page: 0, size: 100, totalItems: type === "HEALTH_DEATH" ? 1 : 0, totalPages: type === "HEALTH_DEATH" ? 1 : 0, hasPrevious: false, hasNext: false } });
  });
  await page.goto("/batches/2/selection");
  await page.getByLabel("Report summary").getByRole("button", { name: /recorded deaths/i }).click();
  const summary = page.getByRole("dialog", { name: "Recorded deaths" });
  await expect(summary).toContainText("Breathing difficulty and stopped eating");
  await expect(summary).toContainText("not a diagnosis");
});
