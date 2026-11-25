import { expect, test, type Page } from "@playwright/test";

test.use({ serviceWorkers: "block" });

type Profile = {
  userId: number;
  email: string;
  fullName: string;
  role: "MANAGER" | "HANDLER";
  farmId: number;
};

const batch = {
  id: 2,
  farmId: 1,
  name: "October load - Sweater Hatch",
  currentPopulation: 150,
  initialPopulation: 150,
  populationStatus: "VALID",
  populationWarning: null,
  startDate: "2026-01-01",
  hatchDate: "2026-01-01",
  farmEntryDate: "2026-01-01",
  bloodline: "Sweater",
  source: null,
  hatchDateConfirmedAt: null,
  hatchDateConfirmedByUserId: null,
  stageId: 1,
  stageName: "Brooding",
  stageAuto: true,
  status: "ACTIVE",
  handlerUserIds: [2],
  createdAt: "2026-01-01T08:00:00Z",
  archivedAt: null,
  archivedByUserId: null,
  archiveReason: null,
  preArchiveStatus: null,
};

function reportPayload() {
  return {
    reportTitle: "Batch review report",
    disclaimer: "Recorded history for human review.",
    payloadVersion: "1",
    periodStart: "2026-01-01",
    periodEnd: "2026-01-15",
    asOfDate: "2026-01-15",
    batch: {
      batchId: 2,
      batchName: batch.name,
      bloodline: batch.bloodline,
      source: null,
      initialPopulation: 150,
      currentPopulation: 150,
      currentPopulationDisplay: "150 / 150",
      ageDays: 14,
      stageName: "Brooding",
      startDate: "2026-01-01",
      lastRecordedEventDate: null,
    },
    population: {
      initialPopulation: 150,
      currentPopulation: 150,
      calculatedPopulationFromEvents: 150,
      reconciliationRequired: false,
      reconciliationMessage: null,
      healthRelatedDeaths: 0,
      healthRelatedLossPercentage: 0,
      totalDeaths: 0,
      accidentalDeaths: 0,
      predation: 0,
      missing: 0,
      returned: 0,
      transfersOut: 0,
      transfersIn: 0,
      sales: 0,
      culling: 0,
      countCorrections: 0,
      legacyMortalityRecords: 0,
      sourceEventCount: 0,
      categoryCounts: {},
    },
    healthEvents: [],
    productUse: [],
    incubation: null,
    finance: {
      startDate: "2026-01-01",
      endDate: "2026-01-15",
      currencyTotals: [{
        currency: "PHP",
        recordedIncome: 0,
        saleIncome: 0,
        otherIncome: 0,
        saleTransactionCount: 0,
        recordedExpense: 12450,
        recordedNetCashFlow: -12450,
        productsConsumedCost: 0,
        totalRecordedBatchCost: 12450,
        recordedContribution: -12450,
        postedTransactionCount: 1,
        recordsMayBeIncomplete: true,
      }],
      recordedIncome: 0,
      saleIncome: 0,
      otherIncome: 0,
      saleTransactionCount: 0,
      recordedExpense: 12450,
      recordedNetCashFlow: -12450,
      productsConsumedCost: 0,
      totalRecordedBatchCost: 12450,
      recordedContribution: -12450,
      postedTransactionCount: 1,
      recordsMayBeIncomplete: true,
      limitation: "Some product usage costs are unavailable.",
    },
    dataAvailability: [],
    selectionSummary: null,
    sexComposition: null,
    reviewInstructions: { status: "FOR_IN_PERSON_ASSESSMENT", managerNotes: null, nextReviewDate: null, reviewedBy: "Fixture Manager", reviewedAt: "2026-01-15T09:00:00Z" },
  };
}

function finalizedReview() {
  return {
    id: 44,
    farmId: 1,
    batchId: 2,
    batchName: batch.name,
    periodStart: "2026-01-01",
    periodEnd: "2026-01-15",
    asOfDate: "2026-01-15",
    status: "FINALIZED",
    reviewStatus: "FOR_IN_PERSON_ASSESSMENT",
    managerNotes: null,
    nextReviewDate: null,
    versionNumber: 3,
    purpose: "SELECTION_REVIEW",
    snapshotNote: null,
    payloadVersion: "1",
    payload: reportPayload(),
    generatedBy: 1,
    generatedAt: "2026-01-15T09:00:00Z",
    sourceCutoffAt: "2026-01-15T09:00:00Z",
    newerDataAvailable: false,
    reviewedBy: 1,
    reviewedAt: "2026-01-15T09:00:00Z",
  };
}

type ReviewFixtureOptions = {
  initialSessions?: Record<string, unknown>[];
  payload?: ReturnType<typeof reportPayload>;
  snapshotPayload?: ReturnType<typeof reportPayload>;
  plan?: Record<string, unknown>[];
  planFails?: boolean;
  exposeFinanceToHandler?: boolean;
  deathEvents?: Record<string, Record<string, unknown>[]>;
  deathEventsFail?: boolean;
  noReviews?: boolean;
  failReviewCreateOnce?: boolean;
  failReviewFinalizeOnce?: boolean;
  reviewCreateDelayMs?: number;
};

function vaccine(id: number, status: "COMPLETED" | "SKIPPED" | "CANCELLED" | "SCHEDULED") {
  return { id, batchId: 2, programId: 1, vaccineName: `Dose ${id}`, farmProductId: null, hatchDate: "2026-01-01", ageDay: id * 7, stageName: "Brooding", dueDate: `2026-01-${String(id * 7).padStart(2, "0")}`, remindOn: "2026-01-01", status, displayState: status, taskId: null, completedInputLogId: null, completedBy: null, completedAt: status === "COMPLETED" ? "2026-01-07T08:00:00Z" : null, completionOperationId: null, skippedReason: null };
}

async function mockReviewBackend(page: Page, profile: Profile, options: ReviewFixtureOptions = {}) {
  let selectionSessionRequests = 0;
  let finalizedRequests = 0;
  let finalizedBody: Record<string, unknown> | null = null;
  let deathEventRequests = 0;
  const deathEventQueries: URLSearchParams[] = [];
  let createdBody: Record<string, unknown> | null = null;
  let sessions: Record<string, unknown>[] = options.initialSessions ?? [];
  const payload = options.payload ?? reportPayload();
  const visiblePayload = profile.role === "HANDLER" && !options.exposeFinanceToHandler ? { ...payload, finance: null } : payload;
  const snapshotPayload = options.snapshotPayload ?? payload;
  const visibleSnapshot = profile.role === "HANDLER" && !options.exposeFinanceToHandler ? { ...snapshotPayload, finance: null } : snapshotPayload;
  const review = { ...finalizedReview(), payload: visibleSnapshot };
  let reviews: Array<Omit<typeof review, "reviewedBy" | "reviewedAt"> & { reviewedBy: number | null; reviewedAt: string | null }> = options.noReviews ? [] : [review];
  let reviewCreateRequests = 0;
  let reviewFinalizeRequests = 0;
  let batchMutationRequests = 0;
  const reviewActions: string[] = [];

  const storeSelectionDraft = (body: Record<string, unknown>) => {
        createdBody = body;
        const now = "2026-11-18T09:00:00Z";
        const draft = {
          id: 91,
          farmId: 1,
          batchId: 2,
          selectionDate: createdBody.selectionDate,
          reviewerId: profile.userId,
          evaluatedCount: createdBody.evaluatedCount,
          acceptedCount: createdBody.acceptedCount,
          continueObservationCount: createdBody.continueObservationCount,
          notAcceptedCount: createdBody.notAcceptedCount,
          otherCount: createdBody.otherCount,
          selectionRatePercent: 100,
          selectionRateNumerator: createdBody.acceptedCount,
          selectionRateDenominator: createdBody.evaluatedCount,
          status: "DRAFT",
          criterionCodes: createdBody.criterionCodes,
          criteriaNotes: createdBody.criteriaNotes ?? null,
          sessionNotes: createdBody.sessionNotes ?? null,
          operationId: createdBody.operationId,
          supersedesSessionId: null,
          createdAt: now,
          updatedAt: now,
          finalizedAt: null,
          selectionReviewId: createdBody.selectionReviewId,
          sourceDataAcknowledged: createdBody.sourceDataAcknowledged ?? false,
          version: 0,
        };
        sessions = [draft];
        return draft;
  };
  const selectionAcks = new Map<string, {serverId: number; serverTime: string}>();

  await page.addInitScript((user) => {
    localStorage.setItem("pp_auth_session", JSON.stringify({ sessionId: "selection-review-e2e", user }));
  }, profile);

  await page.route("**/api/backend/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/api/backend", "");

    if (path === "/auth/refresh") return route.fulfill({ json: { ...profile, token: "selection-review-e2e-token" } });
    if (path === "/farm") return route.fulfill({ json: { id: 1, name: "Sunrise Farm", location: null, description: null } });
    if (path === "/alerts" || path === "/invites/pending") return route.fulfill({ json: [] });
    if (path === "/alerts/summary") return route.fulfill({ json: { activeTotal: 0, critical: 0, warning: 0, info: 0 } });
    if (path === "/version") return route.fulfill({ json: { application: "poultry-prophet", version: "e2e", commitSha: "e2e", buildTime: "2026-01-15T00:00:00Z", environment: "test", compatibleFrontendVersion: "0.1.0-validation", offlineCapabilities: { protocolVersions: [2], commandReceipts: true, schemaReady: true, receiptEntityTypes: ["SELECTION_SESSION", "SELECTION_SESSION_UPDATE", "VACCINATION_SCHEDULE"] } } });
    if (path === "/health") return route.fulfill({ json: { status: "UP" } });
    if (path === "/offline/bootstrap") return route.fulfill({ json: { userId: profile.userId, farmId: 1, role: profile.role, batches: [batch], dashboard: [], products: [], tasks: [], vaccinationPlans: {}, overviews: {}, events: {}, inputs: {} } });
    if (path === "/batches") return route.fulfill({ json: [batch] });
    if (path === "/batches/2") {
      if (request.method() !== "GET") batchMutationRequests += 1;
      return route.fulfill({ json: batch });
    }
    if (path === "/batches/2/selection-review/preview") return route.fulfill({ json: visiblePayload });
    if (path === "/batches/2/selection-reviews" && request.method() === "GET") return route.fulfill({ json: reviews });
    if (path === "/batches/2/selection-reviews" && request.method() === "POST") {
      reviewCreateRequests += 1;
      reviewActions.push("create");
      if (options.reviewCreateDelayMs) await new Promise((resolve) => setTimeout(resolve, options.reviewCreateDelayMs));
      if (options.failReviewCreateOnce && reviewCreateRequests === 1) return route.fulfill({ status: 503, json: { message: "Snapshot could not be saved" } });
      const body = request.postDataJSON() as Record<string, unknown>;
      const draft = { ...review, id: 45, status: "DRAFT", reviewStatus: "NOT_REVIEWED", versionNumber: 4, purpose: String(body.purpose ?? "SELECTION_REVIEW"), reviewedBy: null, reviewedAt: null };
      reviews = [...reviews, draft];
      return route.fulfill({ json: draft });
    }
    if (path === "/batches/2/selection-reviews/45/finalize" && request.method() === "POST") {
      reviewFinalizeRequests += 1;
      reviewActions.push("finalize");
      if (options.failReviewFinalizeOnce && reviewFinalizeRequests === 1) return route.fulfill({ status: 503, json: { message: "Review could not be completed" } });
      const body = request.postDataJSON() as { reviewStatus: string };
      const finalized = { ...reviews.find((item) => item.id === 45)!, status: "FINALIZED", reviewStatus: body.reviewStatus, reviewedBy: profile.userId, reviewedAt: "2026-11-18T09:01:00Z" };
      reviews = reviews.map((item) => item.id === 45 ? finalized : item);
      return route.fulfill({ json: finalized });
    }
    if (path === "/batches/2/vaccination-plan") return options.planFails ? route.fulfill({ status: 403, json: { message: "Not available" } }) : route.fulfill({ json: options.plan ?? [] });
    if (path === "/batches/2/sex-composition") return route.fulfill({ json: null });
    if (path === "/batches/2/events/page") {
      deathEventRequests += 1;
      if (options.deathEventsFail) return route.fulfill({ status: 503, json: { message: "Temporarily unavailable" } });
      const params = new URL(request.url()).searchParams;
      deathEventQueries.push(params);
      const all = options.deathEvents?.[params.get("type") ?? ""] ?? [];
      const pageNumber = Number(params.get("page") ?? 0);
      const size = Number(params.get("size") ?? 20);
      const items = all.slice(pageNumber * size, (pageNumber + 1) * size);
      return route.fulfill({ json: { items, page: pageNumber, size, totalItems: all.length, totalPages: Math.ceil(all.length / size), hasPrevious: pageNumber > 0, hasNext: (pageNumber + 1) * size < all.length } });
    }

    if (path === "/sync/v2/operations" && request.method() === "POST") {
      const results = request.postDataJSON().operations.map((operation: {operationId: string; entityType: string; payload: Record<string, unknown>}) => {
        if (operation.entityType !== "SELECTION_SESSION") return { operationId: operation.operationId, status: "RETRYABLE" };
        const previous = selectionAcks.get(operation.operationId);
        if (previous) return { operationId: operation.operationId, status: "ALREADY_APPLIED", ...previous };
        const draft = storeSelectionDraft(operation.payload);
        const ack = { serverId: draft.id, serverTime: "2026-11-18T09:00:00Z" };
        selectionAcks.set(operation.operationId, ack);
        return { operationId: operation.operationId, status: "APPLIED", ...ack };
      });
      return route.fulfill({ json: { results } });
    }
    if (path === "/batches/2/selection-sessions") {
      selectionSessionRequests += 1;
      if (request.method() === "GET") return route.fulfill({ json: sessions });
      if (request.method() === "POST") {
        const draft = storeSelectionDraft(request.postDataJSON() as Record<string, unknown>);
        return route.fulfill({ json: draft });
      }
    }

    if (path === "/batches/2/selection-sessions/91/finalize" && request.method() === "POST") {
      finalizedRequests += 1;
      finalizedBody = request.postData() ? request.postDataJSON() as Record<string, unknown> : null;
      const finalized = { ...sessions[0], status: "FINALIZED", finalizedAt: "2026-11-18T09:01:00Z" };
      sessions = [finalized];
      return route.fulfill({ json: finalized });
    }

    return route.fulfill({ json: [] });
  });

  return {
    selectionSessionRequests: () => selectionSessionRequests,
    deathEventRequests: () => deathEventRequests,
    deathEventQueries: () => deathEventQueries,
    finalizedRequests: () => finalizedRequests,
    finalizedBody: () => finalizedBody,
    createdBody: () => createdBody,
    reviewCreateRequests: () => reviewCreateRequests,
    reviewFinalizeRequests: () => reviewFinalizeRequests,
    reviewActions: () => reviewActions,
    reviews: () => reviews,
    batchMutationRequests: () => batchMutationRequests,
  };
}

async function finalizeDeliveredSelection(page: Page) {
  await expect.poll(() => page.evaluate(async () => {
    const open = indexedDB.open("poultry-prophet-offline-v1");
    const db = await new Promise<IDBDatabase>((resolve, reject) => { open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error); });
    try {
      const read = db.transaction("outbox").objectStore("outbox").getAll();
      return await new Promise<number>((resolve, reject) => { read.onsuccess = () => resolve(read.result.filter((row: {entityType: string}) => row.entityType === "SELECTION_SESSION").length); read.onerror = () => reject(read.error); });
    } finally { db.close(); }
  }), {timeout: 15_000}).toBe(0);
  await page.reload();
  await page.getByRole("button", { name: "Resume tally" }).click();
  await page.getByRole("dialog", { name: "Selection tally" }).getByRole("button", { name: "Finalize outcome", exact: true }).click();
}

async function confirmCompleteReview(page: Page) {
  await page.getByRole("tab", { name: "Review & versions" }).click();
  await page.locator("#complete-review").click();
  await page.getByRole("dialog", { name: "Complete review?" }).getByRole("button", { name: "Complete review", exact: true }).click();
}

test.describe("Selection review decision flow", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(!testInfo.project.name.startsWith("mobile-chromium-"), "This suite verifies the mobile report flow.");
  });

  test("checks demo-stock impact at the saved report cutoff and again for live records", async ({ page }) => {
    await mockReviewBackend(page, { userId: 1, email: "manager@example.test", fullName: "Fixture Manager", role: "MANAGER", farmId: 1 });
    const requests: URLSearchParams[] = [];
    await page.route("**/api/backend/inventory/demo-cost-impact?*", async (route) => {
      const params = new URL(route.request().url()).searchParams;
      requests.push(params);
      return route.fulfill({ json: { mayIncludeDemoStock: !params.has("cutoff") } });
    });
    await page.goto("/batches/2/selection");
    await expect.poll(() => requests.some((params) => params.get("cutoff") === "2026-01-15T09:00:00Z")).toBe(true);
    expect(requests.every((params) => params.get("batchId") === "2")).toBe(true);
    await expect(page.getByText("Demo stock may affect this cost.")).toHaveCount(0);
    await page.getByRole("button", { name: "Review latest records" }).click();
    await expect(page.getByText("Demo stock may affect this cost.")).toBeVisible();
    expect(requests.some((params) => !params.has("cutoff"))).toBe(true);
  });

  test("reports uncertainty when demo-stock impact cannot be checked", async ({ page }) => {
    await mockReviewBackend(page, { userId: 1, email: "manager@example.test", fullName: "Fixture Manager", role: "MANAGER", farmId: 1 });
    await page.route("**/api/backend/inventory/demo-cost-impact?*", (route) => route.fulfill({ status: 503, json: { message: "Unavailable" } }));
    await page.goto("/batches/2/selection");
    await expect(page.getByText(/Demo stock impact could not be checked/)).toBeVisible();
  });

  test("opens the mobile report and tally without button semantics warnings", async ({ page }) => {
    const warnings: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" && message.text().includes("expected a native <button>")) warnings.push(message.text());
    });
    await mockReviewBackend(page, { userId: 1, email: "manager@example.test", fullName: "Fixture Manager", role: "MANAGER", farmId: 1 });
    await page.route("**/api/backend/batches/2/overview", (route) => route.fulfill({ json: { batch, latestIndicator: null, recentRecords: [], activeAlerts: [] } }));
    await page.goto("/batches/2");
    await page.getByRole("link", { name: /review report for/i }).click();
    await page.getByRole("button", { name: "Record tally" }).click();
    const dialog = page.getByRole("dialog", { name: "Selection tally" });
    await expect(dialog.getByRole("button", { name: "Finalize outcome" })).toBeVisible();
    expect(warnings).toEqual([]);
  });

  test("uses complete batch history without date-range controls", async ({ page }) => {
    await mockReviewBackend(page, { userId: 1, email: "manager@example.test", fullName: "Fixture Manager", role: "MANAGER", farmId: 1 }, { noReviews: true });

    await page.goto("/batches/2/selection");

    await expect(page.getByText("Full recorded batch history from hatch to today.")).toBeVisible();
    await expect(page.getByLabel("Report start")).toHaveCount(0);
    await expect(page.getByLabel("Report as of")).toHaveCount(0);
  });

  test("keeps evidence, review decisions, and saved versions in accessible sections", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 721 });
    await mockReviewBackend(page, { userId: 1, email: "manager@example.test", fullName: "Fixture Manager", role: "MANAGER", farmId: 1 }, { noReviews: true });
    await page.goto("/batches/2/selection");
    const sections = page.getByRole("tablist", { name: "Batch review sections" });
    await expect(sections.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByLabel("Report summary")).toBeVisible();
    await page.getByRole("button", { name: "Review decision", exact: true }).click();
    await expect(sections.getByRole("tab", { name: "Review & versions" })).toHaveAttribute("aria-selected", "true");
    await expect(sections.getByRole("tab", { name: "Review & versions" })).toBeFocused();
    await page.getByLabel("Notes", { exact: true }).fill("Check again after observation.");
    await sections.getByRole("tab", { name: "Health & vaccination" }).click();
    await expect(page.getByRole("heading", { name: "Vaccination record" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Health history/ })).toBeVisible();
    await sections.getByRole("tab", { name: "Costs & products" }).click();
    await expect(page.getByRole("heading", { name: "Batch expenses" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Products used/ })).toBeVisible();
    await expect(page.getByText("No product records", { exact: true })).toBeVisible();
    await sections.getByRole("tab", { name: "Review & versions" }).click();
    await expect(page.getByRole("textbox", { name: "Notes", exact: true })).toHaveValue("Check again after observation.");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test("keeps report sections readable on a narrow screen", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 721 });
    await mockReviewBackend(page, { userId: 1, email: "manager@example.test", fullName: "Fixture Manager", role: "MANAGER", farmId: 1 });
    await page.goto("/batches/2/selection?reviewId=44");

    await expect(page.getByRole("heading", { name: "Batch review" })).toBeVisible();
    await expect(page.getByText("Jump to section", { exact: true })).toHaveCount(0);
    await expect(page.getByLabel("Report summary")).toBeVisible();
    await page.getByRole("tab", { name: "Health & vaccination" }).click();
    await expect(page.locator("#report-vaccination")).toBeVisible();
    await expect(page.locator("#report-health")).toBeVisible();
    await page.getByRole("tab", { name: "Costs & products" }).click();
    await expect(page.locator("#report-expenses")).toBeVisible();
    await expect(page.locator("#report-mortality")).toHaveCount(0);
    await expect(page.getByText("Previous selection outcome", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Sex composition", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Supporting details", { exact: true })).toHaveCount(0);
    await expect(page.getByText("MANAGER REVIEWED", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test("does not show batch expenses to handlers", async ({ page }) => {
    await mockReviewBackend(page, { userId: 2, email: "handler@example.test", fullName: "Fixture Handler", role: "HANDLER", farmId: 1 }, { exposeFinanceToHandler: true });
    await page.goto("/batches/2/selection?reviewId=44");
    await expect(page.locator("#report-expenses")).toHaveCount(0);
    await expect(page.getByText("₱12,450", { exact: false })).toHaveCount(0);
  });

  test("keeps the manager-only selection endpoint out of the handler evidence view", async ({ page }) => {
    const api = await mockReviewBackend(page, { userId: 2, email: "handler@example.test", fullName: "Fixture Handler", role: "HANDLER", farmId: 1 });

    await page.goto("/batches/2/selection?reviewId=44");
    await expect(page.getByRole("heading", { name: "Batch review" })).toBeVisible();
    const summary = page.getByLabel("Report summary");
    await expect(summary).toContainText("Batch cost");
    await expect(summary).toContainText("Manager only");
    await expect(summary).not.toContainText("₱12,450");
    await expect(page.getByRole("heading", { name: "Batch expenses" })).toHaveCount(0);
    await expect(summary).not.toContainText("Previous outcome");
    await expect(page.getByText("Previous selection outcome", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Supporting details", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Selection tally" })).toHaveCount(0);
    await page.waitForTimeout(250);

    expect(api.selectionSessionRequests()).toBe(0);
  });

  test("distinguishes skipped and cancelled doses from completed doses", async ({ page }) => {
    await mockReviewBackend(page, { userId: 1, email: "manager@example.test", fullName: "Fixture Manager", role: "MANAGER", farmId: 1 }, { plan: [vaccine(1, "COMPLETED"), vaccine(2, "SKIPPED"), vaccine(3, "CANCELLED")] });
    await page.goto("/batches/2/selection");
    await expect(page.getByLabel("Report summary")).toContainText("1 / 3");
    await page.getByRole("tab", { name: "Health & vaccination" }).click();
    await page.getByRole("button", { name: /Vaccination list/ }).click();
    await expect(page.getByText("Dose 2", { exact: true })).toBeVisible();
    await expect(page.getByText("Skipped", { exact: true })).toBeVisible();
    await expect(page.getByText("Dose 3", { exact: true })).toBeVisible();
    await expect(page.getByText("Cancelled", { exact: true })).toBeVisible();
    await expect(page.getByText("Complete", { exact: true })).toHaveCount(0);
  });

  test("shows scheduled vaccine statuses in a modal without expanding the report", async ({ page }) => {
    const plan = [
      { ...vaccine(1, "SCHEDULED"), displayState: "OVERDUE" },
      { ...vaccine(2, "SCHEDULED"), displayState: "DUE_TODAY" },
      { ...vaccine(3, "SCHEDULED"), displayState: "UPCOMING" },
      vaccine(4, "COMPLETED"),
    ];
    await mockReviewBackend(page, { userId: 1, email: "manager@example.test", fullName: "Fixture Manager", role: "MANAGER", farmId: 1 }, { plan });
    await page.goto("/batches/2/selection");
    await page.getByRole("tab", { name: "Health & vaccination" }).click();
    const report = page.locator("#report-vaccination");
    await expect(report.getByText("Dose 1", { exact: true })).toBeHidden();
    const heightBefore = (await report.boundingBox())!.height;
    const toggle = report.getByRole("button", { name: /Vaccination list/ });
    await toggle.click();
    const dialog = page.getByRole("dialog", { name: "Vaccination list" });
    await expect(dialog).toBeVisible();
    expect((await report.boundingBox())!.height).toBe(heightBefore);
    for (const [dose, status] of [["Dose 1", "Overdue"], ["Dose 2", "Due today"], ["Dose 3", "Upcoming"], ["Dose 4", "Completed"]]) {
      const row = dialog.locator("li").filter({ hasText: dose });
      await expect(row).toContainText(status);
      await expect(row).toContainText(/Day \d+/);
      await expect(row).toContainText(/(?:Due|Recorded) Jan/);
    }
    await expect(report.getByRole("heading", { name: "Needs review" })).toHaveCount(0);
    await expect(report.getByRole("heading", { name: "Upcoming" })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(toggle).toBeFocused();
  });

  test("does not report an unavailable vaccination schedule as an empty one", async ({ page }) => {
    await mockReviewBackend(page, { userId: 1, email: "manager@example.test", fullName: "Fixture Manager", role: "MANAGER", farmId: 1 }, { planFails: true });
    await page.goto("/batches/2/selection");
    await expect(page.getByLabel("Report summary")).toContainText("Unavailable");
    await page.getByRole("tab", { name: "Health & vaccination" }).click();
    await expect(page.getByText("Vaccination schedule unavailable")).toBeVisible();
    await expect(page.getByText("No vaccination schedule or record for this batch.")).toHaveCount(0);
  });

  test("labels the current vaccination schedule separately from saved snapshot evidence", async ({ page }) => {
    const payload = reportPayload();
    payload.productUse.push({ sourceId: 55, recordedAt: "2026-01-10T08:00:00Z", productType: "VACCINE", brandName: "Snapshot vaccine", productName: "Snapshot vaccine", quantity: 1, unit: "dose", unitCost: null, calculatedCost: null, costStatus: null, purpose: null, notes: null, recordedBy: 1 } as never);
    await mockReviewBackend(page, { userId: 1, email: "manager@example.test", fullName: "Fixture Manager", role: "MANAGER", farmId: 1 }, { payload, plan: [vaccine(1, "COMPLETED")] });
    await page.goto("/batches/2/selection?reviewId=44");
    await page.getByRole("tab", { name: "Health & vaccination" }).click();
    await expect(page.getByText("Current vaccination schedule")).toBeVisible();
    await page.getByRole("button", { name: /Vaccination list/ }).click();
    await expect(page.getByText("Dose 1", { exact: true })).toBeVisible();
    await expect(page.getByText("Snapshot vaccine", { exact: true }).first()).toBeVisible();
    const dialog = page.getByRole("dialog", { name: "Vaccination list" });
    await expect(dialog.locator("li").filter({ hasText: "Dose 1" })).toContainText("Current schedule");
    await expect(dialog.locator("li").filter({ hasText: "Snapshot vaccine" })).toContainText("Saved snapshot");
  });

  test("shows recorded deaths against starting birds without treating missing records as proof", async ({ page }) => {
    const payload = reportPayload();
    Object.assign(payload.population, { totalDeaths: 15, healthRelatedDeaths: 12, accidentalDeaths: 3, currentPopulation: 135, sourceEventCount: 2 });
    await mockReviewBackend(page, { userId: 1, email: "manager@example.test", fullName: "Fixture Manager", role: "MANAGER", farmId: 1 }, { payload });
    await page.goto("/batches/2/selection");
    const summary = page.getByLabel("Report summary");
    await expect(summary).toContainText("Recorded deaths");
    await expect(summary).toContainText("10%");
    await expect(summary).toContainText("15 / 150 starting birds");
    await page.getByRole("tab", { name: "Health & vaccination" }).click();
    await expect(page.getByText(/No health events recorded/i)).toBeVisible();
  });

  test("marks the mortality comparison unavailable when population needs reconciliation", async ({ page }) => {
    const payload = reportPayload();
    Object.assign(payload.population, { reconciliationRequired: true, reconciliationMessage: "Population records need review.", totalDeaths: 20, initialPopulation: 0 });
    await mockReviewBackend(page, { userId: 1, email: "manager@example.test", fullName: "Fixture Manager", role: "MANAGER", farmId: 1 }, { payload });
    await page.goto("/batches/2/selection");
    await expect(page.getByLabel("Report summary")).toContainText("Rate unavailable");
    await expect(page.getByLabel("Report summary")).toContainText("— / 0");
    await expect(page.getByLabel("Report summary")).not.toContainText("Infinity");
    await expect(page.getByText("Population records need review.").first()).toBeVisible();
  });

  test("explains material limitations without supporting details", async ({ page }) => {
    const payload = reportPayload();
    Object.assign(payload, { dataAvailability: [{ section: "Batch finance", status: "PARTIAL", recordCount: 1, latestDate: null, message: "Some product costs are unavailable." }] });
    await mockReviewBackend(page, { userId: 1, email: "manager@example.test", fullName: "Fixture Manager", role: "MANAGER", farmId: 1 }, { payload });
    await page.goto("/batches/2/selection?reviewId=44");
    await expect(page.getByRole("region", { name: "Report limitations" })).toContainText("Some product costs are unavailable.");
    await expect(page.getByText("Supporting details", { exact: true })).toHaveCount(0);
  });

  test("filters event records by type and clears the selection", async ({ page }) => {
    await mockReviewBackend(page, { userId: 1, email: "manager@example.test", fullName: "Fixture Manager", role: "MANAGER", farmId: 1 });
    const events = [{ id: 1, eventType: "HEALTH_DEATH", title: "Health death record", eventDate: "2026-11-08", affectedCount: 10 }, { id: 2, eventType: "MISSING", title: "Missing record", eventDate: "2026-11-08", affectedCount: 2 }];
    await page.route("**/api/backend/batches/2/events/report?*", route => route.fulfill({ json: { totalRecords: 2, categoryDistribution: { HEALTH_DEATH: 1, MISSING: 1 }, overTime: [] } }));
    await page.route("**/api/backend/batches/2/events/page?*", route => { const type = new URL(route.request().url()).searchParams.get("type"); const items = events.filter(e => !type || e.eventType === type); return route.fulfill({ json: { items, page: 0, totalItems: items.length, totalPages: 1, hasPrevious: false, hasNext: false } }); });
    await page.goto("/batches/2/data-entry?view=report");
    await page.getByRole("button", { name: "Filters", exact: true }).click();
    await page.getByLabel("Filter event type").selectOption("HEALTH_DEATH");
    await expect(page).toHaveURL(/type=HEALTH_DEATH/);
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await expect(page.getByRole("button", { name: "Filters (1)" })).toBeVisible();
    const table = page.getByRole("region", { name: "Event records table" });
    await expect(table).toContainText("Health death record");
    await expect(table).not.toContainText("Missing record");
    await page.getByRole("button", { name: "Clear type filter" }).click();
    await expect(table).toContainText("Missing record");
  });

  test("keeps batch activity actions easy to tap on a narrow phone", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 721 });
    await mockReviewBackend(page, { userId: 1, email: "manager@example.test", fullName: "Fixture Manager", role: "MANAGER", farmId: 1 });
    await page.route("**/api/backend/batches/2/overview", route => route.fulfill({ json: { batch, latestIndicator: null, recentRecords: [], activeAlerts: [] } }));
    await page.goto("/batches/2");
    const eventLog = page.getByRole("link", { name: "Event log", exact: true });
    await eventLog.scrollIntoViewIfNeeded();
    const bounds = await eventLog.boundingBox();
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
    await page.screenshot({ path: "/tmp/poultry-batch-action-buttons-mobile.png" });
    await eventLog.click();
    await expect(page.getByRole("heading", { name: "Event Log", exact: true })).toBeVisible();
  });

  test("opens event records on mobile", async ({ page }) => {
    await mockReviewBackend(page, { userId: 1, email: "manager@example.test", fullName: "Fixture Manager", role: "MANAGER", farmId: 1 });
    await page.goto("/batches/2/data-entry?from=batch&view=history");
    await expect(page.getByRole("heading", { name: "Event Log" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("No events in this period")).toBeVisible();
    await page.getByRole("button", { name: "Filters", exact: true }).click();
    await expect(page.getByLabel("Filter event period")).toHaveValue("30d");
    await page.getByLabel("Filter event period").selectOption("custom");
    await expect(page.getByLabel("Event report start date")).toBeVisible();
    await page.getByLabel("Filter concern level").selectOption("HIGH");
    await expect(page).toHaveURL(/concern=HIGH/);
    await page.getByLabel("Population only").click();
    await expect(page).toHaveURL(/populationOnly=true/);
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await expect(page.getByText("No matching events")).toBeVisible();
    await page.getByRole("button", { name: "Clear search and filters" }).click();
    await expect(page.getByText("No events in this period")).toBeVisible();
    await page.getByRole("button", { name: "Filters", exact: true }).click();
    await page.getByLabel("Filter concern level").selectOption("HIGH");
    await expect(page).toHaveURL(/concern=HIGH/);
    await page.getByRole("button", { name: "Reset filters" }).click();
    await expect(page.getByLabel("Filter event period")).toHaveValue("30d");
    await expect(page.getByLabel("Filter concern level")).toHaveValue("ALL");
    await expect(page.getByLabel("Population only")).not.toBeChecked();
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Event records" })).toBeVisible();
  });

  test("shows event records in a mobile table and opens their details", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 721 });
    const event = { id: 71, batchId: 2, handlerId: 1, handlerName: "Fixture Handler", eventDate: "2026-11-08", eventType: "MISSING", title: "Missing bird", affectedCount: 23, concernLevel: null, severityLabel: null, details: "Last seen near the coop." };
    await mockReviewBackend(page, { userId: 1, email: "manager@example.test", fullName: "Fixture Manager", role: "MANAGER", farmId: 1 }, { deathEvents: { "": [event] } });
    await page.goto("/batches/2/data-entry?from=batch&view=history");
    const region = page.getByRole("region", { name: "Event records table" });
    const table = region.getByRole("table");
    await expect(region).toBeVisible();
    const bounds = await region.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.height).toBeGreaterThanOrEqual(200);
    expect(bounds!.width).toBeLessThanOrEqual(320);
    for (const name of ["Event", "Date", "Type", "Affected", "Concern"]) await expect(table.getByRole("columnheader", { name, exact: true })).toBeVisible();
    const row = table.getByRole("row", { name: /Missing bird/ });
    await expect(row).toContainText("2026-11-08");
    await expect(row).toContainText("23");
    await expect(row).toContainText("Unrated");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await row.getByRole("button", { name: "Missing bird" }).focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Missing bird" });
    await expect(dialog).toContainText("Fixture Handler");
    await expect(dialog).toContainText("Last seen near the coop.");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("offers a way back from an empty event records page", async ({ page }) => {
    await mockReviewBackend(page, { userId: 1, email: "manager@example.test", fullName: "Fixture Manager", role: "MANAGER", farmId: 1 });
    await page.goto("/batches/2/data-entry?from=batch&view=history&page=2");
    await expect(page.getByText("No events on this page")).toBeVisible();
    await page.getByRole("button", { name: "Go to first page" }).click();
    await expect(page.getByText("No events in this period")).toBeVisible();
  });

  test("opens the handler history without the recording form", async ({ page }) => {
    await mockReviewBackend(page, { userId: 2, email: "handler@example.test", fullName: "Fixture Handler", role: "HANDLER", farmId: 1 });
    await page.goto("/batches/2/data-entry?from=batch&view=history");
    await expect(page.getByRole("heading", { name: "Event Log" })).toBeVisible();
    await expect(page.getByTestId("record-event-section")).toHaveCount(0);
  });

  test("requires a fresh diagnosis before repairing a population mismatch", async ({ page }) => {
    await mockReviewBackend(page, { userId: 1, email: "manager@example.test", fullName: "Fixture Manager", role: "MANAGER", farmId: 1 });
    const warningBatch = { ...batch, currentPopulation: 145, populationStatus: "RECONCILIATION_REQUIRED", populationWarning: "Population records need review." };
    let revision = "revision-1";
    const submitted: unknown[] = [];
    await page.route("**/api/backend/batches/2/overview", (route) => route.fulfill({ json: { batch: warningBatch, latestIndicator: null, recentRecords: [], activeAlerts: [] } }));
    await page.route("**/api/backend/batches/2/population/diagnostics", (route) => route.fulfill({ json: { asOfDate: "2026-11-19", status: "STORED_MISMATCH", initialPopulation: 150, storedPopulation: revision === "revision-1" ? 145 : 146, calculatedPopulation: 150, ledgerValid: true, canRepairStoredCount: true, issueCode: null, reason: null, firstInvalidEventId: null, firstInvalidEventDate: null, sourceEventCount: 0, revision } }));
    await page.route("**/api/backend/batches/2/population/reconcile", async (route) => {
      submitted.push(route.request().postDataJSON());
      if (submitted.length === 1) { revision = "revision-2"; return route.fulfill({ status: 409, json: { message: "STALE_DIAGNOSTICS: refresh and review again" } }); }
      return route.fulfill({ json: batch });
    });
    await page.goto("/batches/2");
    await page.getByRole("button", { name: "Review population" }).click();
    const dialog = page.getByRole("dialog", { name: "Review population" });
    await expect(dialog).toContainText("Stored count");
    await expect(dialog).toContainText("145");
    await expect(dialog).toContainText("does not change event history");
    await dialog.getByRole("button", { name: "Repair stored count" }).click();
    await expect(dialog).toContainText("146");
    await dialog.getByRole("button", { name: "Repair stored count" }).click();
    await expect(dialog).toBeHidden();
    expect(submitted).toEqual([{ expectedRevision: "revision-1" }, { expectedRevision: "revision-2" }]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test("does not show a percentage when recorded deaths exceed the starting population", async ({ page }) => {
    const payload = reportPayload();
    Object.assign(payload.population, { totalDeaths: 151, healthRelatedDeaths: 150, accidentalDeaths: 1, transfersIn: 2, sourceEventCount: 3 });
    await mockReviewBackend(page, { userId: 1, email: "manager@example.test", fullName: "Fixture Manager", role: "MANAGER", farmId: 1 }, { payload });
    await page.goto("/batches/2/selection");
    await expect(page.getByLabel("Report summary")).toContainText("Rate unavailable");
    await expect(page.getByLabel("Report summary")).not.toContainText("100.7%");
    await expect(page.getByText(/Transfers.*affect/i).first()).toBeVisible();
  });

  test("qualifies an absence of death records instead of asserting that no birds died", async ({ page }) => {
    await mockReviewBackend(page, { userId: 1, email: "manager@example.test", fullName: "Fixture Manager", role: "MANAGER", farmId: 1 });
    await page.goto("/batches/2/selection");
    await expect(page.getByLabel("Report summary")).toContainText("Recorded deaths");
    await expect(page.getByLabel("Report summary")).toContainText("0 / 150 starting birds");
    await expect(page.getByText(/Recorded health and accidental deaths/i)).toBeVisible();
  });

  test("stacks vaccination and health history on mobile and omits the duplicate population section", async ({ page }) => {
    await mockReviewBackend(page, { userId: 1, email: "manager@example.test", fullName: "Fixture Manager", role: "MANAGER", farmId: 1 });
    await page.goto("/batches/2/selection");
    await page.getByRole("tab", { name: "Health & vaccination" }).click();
    const vaccination = page.locator("#report-vaccination");
    const health = page.locator("#report-health");
    await expect(vaccination).toBeVisible();
    await expect(health).toBeVisible();
    const vaccineBox = await vaccination.boundingBox();
    const healthBox = await health.boundingBox();
    expect(vaccineBox).not.toBeNull();
    expect(healthBox).not.toBeNull();
    expect(healthBox!.y).toBeGreaterThanOrEqual(vaccineBox!.y + vaccineBox!.height);
    await expect(page.getByRole("heading", { name: "Mortality and population" })).toHaveCount(0);
    await expect(page.getByLabel("Report summary")).toContainText("Recorded deaths");
    await expect(page.getByText("Jump to section", { exact: true })).toHaveCount(0);
  });

  test("does not combine currencies or conceal incomplete batch expenses", async ({ page }) => {
    const payload = reportPayload();
    const php = payload.finance.currencyTotals[0];
    payload.finance.currencyTotals.push({ ...php, currency: "USD", recordedExpense: 20, totalRecordedBatchCost: 20 });
    await mockReviewBackend(page, { userId: 1, email: "manager@example.test", fullName: "Fixture Manager", role: "MANAGER", farmId: 1 }, { payload });
    await page.goto("/batches/2/selection");
    await expect(page.getByLabel("Report summary")).toContainText("Mixed");
    await expect(page.getByLabel("Report summary")).toContainText("Partial cost");
    await page.getByRole("tab", { name: "Costs & products" }).click();
    await expect(page.getByRole("region", { name: "PHP finance" })).toBeVisible();
    await expect(page.getByRole("region", { name: "USD finance" })).toBeVisible();
  });

  test("loads sex composition alongside the overview and distinguishes missing expenses", async ({ page }) => {
    const payload = reportPayload();
    Object.assign(payload.finance.currencyTotals[0], { recordedExpense: 0, totalRecordedBatchCost: 0, recordsMayBeIncomplete: false });
    Object.assign(payload.finance, { recordedExpense: 0, totalRecordedBatchCost: 0, recordsMayBeIncomplete: false });
    await mockReviewBackend(page, { userId: 1, email: "manager@example.test", fullName: "Fixture Manager", role: "MANAGER", farmId: 1 }, { payload });

    let releaseOverview!: () => void;
    let releaseComposition!: () => void;
    const overviewGate = new Promise<void>((resolve) => { releaseOverview = resolve; });
    const compositionGate = new Promise<void>((resolve) => { releaseComposition = resolve; });
    await page.route("**/api/backend/batches/2/overview", async (route) => {
      await overviewGate;
      await route.fulfill({ json: { batch, latestIndicator: null, recentRecords: [], activeAlerts: [] } });
    });
    await page.route("**/api/backend/batches/2/sex-composition", async (route) => {
      await compositionGate;
      await route.fulfill({ json: { observedOn: "2026-11-18", populationAsOfObservation: 150, maleCount: 6, femaleCount: 25, unclassifiedCount: 119, projectionStatus: "VALID" } });
    });
    const compositionRequested = page.waitForRequest("**/api/backend/batches/2/sex-composition");
    try {
      await page.goto("/batches/2");
      await compositionRequested;
      releaseOverview();
      const summary = page.getByRole("heading", { name: "Batch summary" }).locator("..");
      await expect(summary.getByRole("button", { name: "Male / female: Loading…" })).toBeDisabled();
      const expenses = summary.getByText("Batch expenses", { exact: true }).locator("..");
      await expect(expenses).toContainText("N/A");
      await expect(expenses).toContainText("No record");
      releaseComposition();
      await expect(summary.getByRole("button", { name: /Edit sex composition: 6 male, 25 female/i })).toBeVisible();
    } finally {
      releaseOverview();
      releaseComposition();
    }
  });

  for (const partial of [false, true]) {
    test(`shows ${partial ? "partial" : "complete"} batch expenses in the mobile batch summary`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 721 });
      const payload = reportPayload();
      Object.assign(payload.finance.currencyTotals[0], { recordedExpense: 100, productsConsumedCost: 1890, totalRecordedBatchCost: 1990, recordsMayBeIncomplete: partial });
      Object.assign(payload.finance, { recordedExpense: 100, productsConsumedCost: 1890, totalRecordedBatchCost: 1990, recordsMayBeIncomplete: partial });
      await mockReviewBackend(page, { userId: 1, email: "manager@example.test", fullName: "Fixture Manager", role: "MANAGER", farmId: 1 }, { payload });
      await page.route("**/api/backend/batches/2/overview", (route) => route.fulfill({ json: { batch, latestIndicator: null, recentRecords: [], activeAlerts: [] } }));
      await page.goto("/batches/2");
      const summary = page.getByRole("heading", { name: "Batch summary" }).locator("..");
      const expenses = summary.getByText("Batch expenses", { exact: true }).locator("..");
      await expect(expenses).toContainText(partial ? "₱1,990*" : "₱1,990");
      await expect(expenses.getByText("Partial cost", { exact: true })).toHaveCount(partial ? 1 : 0);
      await expect(summary.getByText("Products used", { exact: true })).toHaveCount(0);
      expect(await expenses.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    });
  }

  test("keeps batch summary expenses manager-only even if the payload includes finance", async ({ page }) => {
    await mockReviewBackend(page, { userId: 2, email: "handler@example.test", fullName: "Fixture Handler", role: "HANDLER", farmId: 1 }, { exposeFinanceToHandler: true });
    await page.route("**/api/backend/batches/2/overview", (route) => route.fulfill({ json: { batch, latestIndicator: null, recentRecords: [], activeAlerts: [] } }));
    await page.goto("/batches/2");
    const summary = page.getByRole("heading", { name: "Batch summary" }).locator("..");
    const expenses = summary.getByText("Batch expenses", { exact: true }).locator("..");
    await expect(expenses).toContainText("Manager only");
    await expect(expenses).not.toContainText("₱");
  });

  test("labels a known PHP 1,890 batch cost as partial when usage costs are missing", async ({ page }) => {
    const payload = reportPayload();
    Object.assign(payload.finance.currencyTotals[0], { recordedExpense: 0, productsConsumedCost: 1890, totalRecordedBatchCost: 1890, recordsMayBeIncomplete: true });
    Object.assign(payload.finance, { recordedExpense: 0, productsConsumedCost: 1890, totalRecordedBatchCost: 1890, recordsMayBeIncomplete: true, unvaluedUsageCount: 5 });
    payload.productUse = [{ sourceId: 1, recordedAt: "2026-01-10T00:00:00Z", productType: "FEED", brandName: "Unvalued feed", productName: null, quantity: null, unit: "pack", unitCost: null, calculatedCost: null, costStatus: null, purpose: null, notes: null, recordedBy: 1 }] as unknown as typeof payload.productUse;
    await mockReviewBackend(page, { userId: 1, email: "manager@example.test", fullName: "Fixture Manager", role: "MANAGER", farmId: 1 }, { payload });
    await page.goto("/batches/2/selection");
    await expect(page.getByLabel("Report summary")).toContainText("₱1,890");
    await expect(page.getByLabel("Report summary")).toContainText("Partial cost");
    await page.getByRole("tab", { name: "Costs & products" }).click();
    await expect(page.locator("#report-expenses")).toContainText("5 product-use records need cost details. Total is partial.");
    await expect(page.locator("#report-expenses").getByRole("link", { name: "View products" })).toHaveAttribute("href", "#report-products");
  });

  test("identifies incomplete product costs in an older snapshot despite its complete flag", async ({ page }) => {
    const snapshotPayload = reportPayload();
    Object.assign(snapshotPayload.finance.currencyTotals[0], { recordedExpense: 0, productsConsumedCost: 1890, totalRecordedBatchCost: 1890, recordsMayBeIncomplete: false });
    Object.assign(snapshotPayload.finance, { recordedExpense: 0, productsConsumedCost: 1890, totalRecordedBatchCost: 1890, recordsMayBeIncomplete: false });
    snapshotPayload.productUse = [{ sourceId: 1, recordedAt: "2026-01-10T00:00:00Z", productType: "FEED", brandName: "Unvalued feed", productName: null, quantity: null, unit: "pack", unitCost: null, calculatedCost: null, costStatus: null, purpose: null, notes: null, recordedBy: 1 }] as unknown as typeof snapshotPayload.productUse;
    await mockReviewBackend(page, { userId: 1, email: "manager@example.test", fullName: "Fixture Manager", role: "MANAGER", farmId: 1 }, { snapshotPayload });
    await page.goto("/batches/2/selection?reviewId=44");
    await expect(page.getByLabel("Report summary")).toContainText("₱1,890");
    await expect(page.getByLabel("Report summary")).toContainText("Partial cost");
    await page.getByRole("tab", { name: "Costs & products" }).click();
    await expect(page.locator("#report-expenses")).toContainText(/product.use record.*need.*cost details/i);
  });

  test("shows product use and sale proceeds with batch expenses", async ({ page }) => {
    const payload = reportPayload();
    payload.productUse = [{ sourceId: 1, recordedAt: "2026-01-10T00:00:00Z", productType: "FEED", brandName: "Starter feed", productName: null, quantity: 2, unit: "kg", unitCost: 50, calculatedCost: 100, costStatus: "VALUED", purpose: null, notes: null, recordedBy: 1 }] as unknown as typeof payload.productUse;
    Object.assign(payload.finance.currencyTotals[0], { saleIncome: 3200, saleTransactionCount: 1, recordedIncome: 9000, recordedContribution: -3450 });
    await mockReviewBackend(page, { userId: 1, email: "manager@example.test", fullName: "Fixture Manager", role: "MANAGER", farmId: 1 }, { payload });
    await page.goto("/batches/2/selection");
    await page.getByRole("tab", { name: "Costs & products" }).click();
    const expenses = page.locator("#report-expenses");
    await expect(expenses).toContainText("₱12,450");
    await expect(page.locator("#report-products")).toContainText("Starter feed");
    const productsTable = page.getByRole("region", { name: "Products used table" }).getByRole("table");
    await expect(productsTable.getByRole("columnheader", { name: "Total cost" })).toBeVisible();
    const feedRow = productsTable.getByRole("row", { name: /Starter feed/ });
    await expect(feedRow).toContainText("2 kg");
    await expect(feedRow).toContainText("₱50.00");
    await expect(feedRow).toContainText("₱100.00");
    await expect(expenses).toContainText("Sale proceeds");
    await expect(expenses).toContainText("₱3,200");
    await expect(expenses).not.toContainText("₱9,000");
    await expect(expenses).not.toContainText("Contribution");
    await expect(expenses).not.toContainText("Past costs help with planning");
    await expect(expenses).not.toContainText("Currencies are shown separately without conversion");
    const finance = expenses.getByRole("region", { name: "PHP finance" });
    const facts = ["Cash expense", "Products used", "Batch cost", "Sale proceeds"].map((label) => finance.getByText(label, { exact: true }).locator(".."));
    const boxes = await Promise.all(facts.map((fact) => fact.boundingBox()));
    expect(boxes.every(Boolean)).toBe(true);
    expect(boxes[0]!.y).toBeCloseTo(boxes[1]!.y, 0);
    expect(boxes[2]!.y).toBeCloseTo(boxes[3]!.y, 0);
    expect(boxes[2]!.y).toBeGreaterThan(boxes[0]!.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test("shows known product subtotals as partial when some records are missing", async ({ page }) => {
    const payload = reportPayload();
    const input = { recordedAt: "2026-01-10T00:00:00Z", productType: "FEED", brandName: "Booster feed", productName: null, unit: "pack", purpose: null, notes: null, recordedBy: 1 };
    payload.productUse = [
      { ...input, sourceId: 1, quantity: null, unitCost: null, calculatedCost: null, costStatus: null },
      { ...input, sourceId: 2, quantity: 10, unitCost: 70, calculatedCost: 700, costStatus: "VALUED" },
      { ...input, sourceId: 3, quantity: 10, unitCost: 70, calculatedCost: 700, costStatus: "VALUED" },
      { ...input, sourceId: 4, brandName: "Unknown feed", quantity: null, unitCost: null, calculatedCost: null, costStatus: null },
    ] as unknown as typeof payload.productUse;
    await mockReviewBackend(page, { userId: 1, email: "manager@example.test", fullName: "Fixture Manager", role: "MANAGER", farmId: 1 }, { payload });
    await page.goto("/batches/2/selection");
    await page.getByRole("tab", { name: "Costs & products" }).click();
    const table = page.getByRole("region", { name: "Products used table" }).getByRole("table");
    const partial = table.getByRole("row", { name: /Booster feed/ });
    await expect(partial).toContainText("20 pack");
    await expect(partial).toContainText("₱1,400.00");
    await expect(partial.getByText("Partial", { exact: true })).toHaveCount(2);
    const unknown = table.getByRole("row", { name: /Unknown feed/ });
    await expect(unknown).toContainText("Not measured");
    await expect(unknown).toContainText("Unavailable");
  });

  test("shows product quantities without cost columns to handlers", async ({ page }) => {
    const payload = reportPayload();
    payload.productUse = [{ sourceId: 1, recordedAt: "2026-01-10T00:00:00Z", productType: "FEED", brandName: "Starter feed", productName: null, quantity: 2, unit: "kg", unitCost: 50, calculatedCost: 100, costStatus: "VALUED", purpose: null, notes: null, recordedBy: 1 }] as unknown as typeof payload.productUse;
    await mockReviewBackend(page, { userId: 2, email: "handler@example.test", fullName: "Fixture Handler", role: "HANDLER", farmId: 1 }, { payload, exposeFinanceToHandler: true });
    await page.goto("/batches/2/selection");
    await page.getByRole("tab", { name: "Products used" }).click();
    const table = page.getByRole("region", { name: "Products used table" }).getByRole("table");
    await expect(table.getByRole("row", { name: /Starter feed/ })).toContainText("2 kg");
    await expect(table.getByRole("columnheader", { name: /cost/i })).toHaveCount(0);
    await expect(table).not.toContainText("₱");
  });

  for (const knownCost of [1820, 0]) {
    test(`shows ${knownCost > 0 ? "the known subtotal" : "an unavailable amount"} when product costs are partial without cash expenses`, async ({ page }) => {
      const payload = reportPayload();
      payload.productUse = [{ sourceId: 1, recordedAt: "2026-01-10T00:00:00Z", productType: "FEED", brandName: "Feed", productName: null, quantity: 1, unit: "kg", unitCost: null, calculatedCost: null, costStatus: "UNVALUED", purpose: null, notes: null, recordedBy: 1 }] as unknown as typeof payload.productUse;
      Object.assign(payload.finance, { recordedExpense: 0, productsConsumedCost: knownCost, totalRecordedBatchCost: knownCost, postedTransactionCount: 0, recordsMayBeIncomplete: true });
      Object.assign(payload.finance.currencyTotals[0], { recordedExpense: 0, productsConsumedCost: knownCost, totalRecordedBatchCost: knownCost, postedTransactionCount: 0, recordsMayBeIncomplete: true });
      await mockReviewBackend(page, { userId: 1, email: "manager@example.test", fullName: "Fixture Manager", role: "MANAGER", farmId: 1 }, { payload });
      await page.goto("/batches/2/selection");
      const cost = page.getByLabel("Report summary").getByText("Batch cost", { exact: true }).locator("..");
      await expect(cost).toContainText(knownCost > 0 ? "₱1,820*" : "N/A");
      await expect(cost).toContainText("Partial cost");
      if (knownCost === 0) await expect(cost).not.toContainText("₱0");
      await page.getByRole("tab", { name: "Costs & products" }).click();
      await expect(page.getByText("1 product-use record needs cost details. Total is partial.", { exact: false })).toBeVisible();
    });
  }

  test("marks legacy finance without currency information unavailable", async ({ page }) => {
    const payload = reportPayload();
    payload.finance.currencyTotals = null as unknown as typeof payload.finance.currencyTotals;
    await mockReviewBackend(page, { userId: 1, email: "manager@example.test", fullName: "Fixture Manager", role: "MANAGER", farmId: 1 }, { payload });
    await page.goto("/batches/2/selection?reviewId=44");
    await expect(page.getByLabel("Report summary")).toContainText("Currency unavailable");
    await page.getByRole("tab", { name: "Costs & products" }).click();
    await expect(page.getByText(/Historical finance totals are unavailable/)).toBeVisible();
    await expect(page.getByText("No batch expenses recorded.")).toHaveCount(0);
  });

  test("does not show expense details to a handler even if a legacy payload contains finance", async ({ page }) => {
    await mockReviewBackend(page, { userId: 2, email: "handler@example.test", fullName: "Fixture Handler", role: "HANDLER", farmId: 1 }, { exposeFinanceToHandler: true });
    await page.goto("/batches/2/selection");
    await expect(page.getByRole("heading", { name: "Batch review" })).toBeVisible();
    await expect(page.getByLabel("Report summary")).toContainText("Manager only");
    await expect(page.getByText("₱12,450", { exact: false })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Batch expenses" })).toHaveCount(0);
  });

  test("records a manager outcome against the finalized report snapshot", async ({ page }) => {
    const snapshotPayload = reportPayload();
    snapshotPayload.population.currentPopulation = 140;
    const api = await mockReviewBackend(page, { userId: 1, email: "manager@example.test", fullName: "Fixture Manager", role: "MANAGER", farmId: 1 }, { snapshotPayload });

    await page.goto("/batches/2/selection?reviewId=44");
    await expect(page.getByText("MANAGER REVIEWED", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Record tally" })).toBeVisible();
    await page.getByRole("button", { name: "Record tally" }).click();

    const dialog = page.getByRole("dialog", { name: "Selection tally" });
    await expect(dialog.getByText("Based on Report v3").first()).toBeVisible();
    await expect(dialog.getByText("150 birds", { exact: true })).toBeVisible();
    await dialog.getByLabel("Evaluated").fill("10");
    await dialog.getByLabel("Selected", { exact: true }).fill("7");
    await dialog.getByLabel("Not selected", { exact: true }).fill("3");
    await dialog.getByRole("button", { name: "Finalize outcome" }).click();
    await finalizeDeliveredSelection(page);

    await expect.poll(() => api.createdBody()).toMatchObject({ selectionReviewId: 44, evaluatedCount: 10, acceptedCount: 7, notAcceptedCount: 3, sessionNotes: null });
    await expect.poll(() => api.finalizedRequests()).toBe(1);
    await expect(dialog).toBeHidden();
    await page.getByRole("button", { name: "View tally" }).click();
    await expect(page.getByRole("dialog", { name: "Selection tally" })).toContainText(/7 (selected|accepted) of 10 evaluated/i);
  });

  test("validates tally totals and saves optional comments", async ({ page }) => {
    const api = await mockReviewBackend(page, { userId: 1, email: "manager@example.test", fullName: "Fixture Manager", role: "MANAGER", farmId: 1 });
    await page.goto("/batches/2/selection?reviewId=44");
    await expect(page.getByText("MANAGER REVIEWED", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Record tally" }).click();
    const dialog = page.getByRole("dialog", { name: "Selection tally" });
    await dialog.getByLabel("Evaluated").fill("10");
    await dialog.getByLabel("Selected", { exact: true }).fill("7");
    await dialog.getByLabel("Not selected", { exact: true }).fill("4");
    await dialog.getByRole("button", { name: "Finalize outcome" }).click();
    await expect(dialog.getByRole("alert")).toContainText(/cannot exceed|exceed evaluated/i);
    expect(api.createdBody()).toBeNull();
    await dialog.getByLabel("Not selected", { exact: true }).fill("3");
    await dialog.getByLabel(/notes|comments/i).fill("Selected birds for further review.");
    await dialog.getByRole("button", { name: "Finalize outcome" }).click();
    await finalizeDeliveredSelection(page);
    await expect.poll(() => api.createdBody()).toMatchObject({ evaluatedCount: 10, acceptedCount: 7, notAcceptedCount: 3, sessionNotes: "Selected birds for further review." });
    await expect.poll(() => api.finalizedRequests()).toBe(1);
  });

  test("does not offer a new outcome when the live population is unverified", async ({ page }) => {
    const payload = reportPayload();
    Object.assign(payload.population, { reconciliationRequired: true, reconciliationMessage: "Population needs review." });
    await mockReviewBackend(page, { userId: 1, email: "manager@example.test", fullName: "Fixture Manager", role: "MANAGER", farmId: 1 }, { payload, snapshotPayload: reportPayload() });
    await page.goto("/batches/2/selection?reviewId=44");
    await expect(page.getByText("MANAGER REVIEWED", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Record tally" }).click();
    await expect(page.getByRole("dialog")).toContainText("A verified current population is needed before recording a selection tally.");
    await expect(page.getByRole("button", { name: "Finalize outcome" })).toHaveCount(0);
  });

  test("asks for confirmation before saving a review and leaves it unchanged when cancelled", async ({ page }) => {
    const api = await mockReviewBackend(page, { userId: 1, email: "manager@example.test", fullName: "Fixture Manager", role: "MANAGER", farmId: 1 }, { noReviews: true });
    await page.goto("/batches/2/selection");
    await page.getByRole("tab", { name: "Review & versions" }).click();
    await page.getByRole("button", { name: "Complete review", exact: true }).click();
    const confirmation = page.getByRole("dialog", { name: "Complete review?" });
    await expect(confirmation).toBeVisible();
    expect(api.reviewActions()).toEqual([]);
    await confirmation.getByRole("button", { name: "Cancel" }).click();
    await expect(confirmation).toBeHidden();
    expect(api.reviewActions()).toEqual([]);
    await expect(page.getByRole("button", { name: "Complete review", exact: true })).toBeVisible();
  });

  test("confirms the manager's selected review decision", async ({ page }) => {
    const api = await mockReviewBackend(page, { userId: 1, email: "manager@example.test", fullName: "Fixture Manager", role: "MANAGER", farmId: 1 }, { noReviews: true });
    await page.goto("/batches/2/selection");
    await page.getByRole("tab", { name: "Review & versions" }).click();
    await page.getByLabel("Decision after review").selectOption("REVIEW_COMPLETED");
    await page.getByRole("button", { name: "Complete review", exact: true }).click();
    const confirmation = page.getByRole("dialog", { name: "Complete review?" });
    await expect(confirmation).toContainText("Reviewed — no further action");
    await expect(confirmation).not.toContainText("You can record the selection tally");
    await confirmation.getByRole("button", { name: "Complete review", exact: true }).click();
    await expect.poll(() => api.reviews()[0]).toMatchObject({ status: "FINALIZED", reviewStatus: "REVIEW_COMPLETED" });
    expect(api.batchMutationRequests()).toBe(0);
  });

  test("completes the review, keeps the batch active, and prompts for the tally after reload", async ({ page }) => {
    const api = await mockReviewBackend(page, { userId: 1, email: "manager@example.test", fullName: "Fixture Manager", role: "MANAGER", farmId: 1 }, { noReviews: true });
    await page.goto("/batches/2/selection");
    await confirmCompleteReview(page);
    await expect.poll(() => api.reviewActions()).toEqual(["create", "finalize"]);
    await expect.poll(() => api.reviews()[0]).toMatchObject({ status: "FINALIZED", reviewStatus: "FOR_IN_PERSON_ASSESSMENT" });
    await expect(page.getByRole("status").filter({ hasText: "Needs tally" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Record tally" })).toBeVisible();
    expect(api.batchMutationRequests()).toBe(0);
    expect(batch.status).toBe("ACTIVE");

    await page.reload();
    await expect(page.getByRole("status").filter({ hasText: "Needs tally" })).toBeVisible();
    await page.getByRole("button", { name: "Record tally" }).click();
    const dialog = page.getByRole("dialog", { name: "Selection tally" });
    await dialog.getByLabel("Evaluated").fill("10");
    await dialog.getByLabel("Selected", { exact: true }).fill("7");
    await dialog.getByLabel("Not selected", { exact: true }).fill("3");
    await dialog.getByRole("button", { name: "Finalize outcome" }).click();
    await finalizeDeliveredSelection(page);
    await expect.poll(() => api.createdBody()).toMatchObject({ selectionReviewId: 45, evaluatedCount: 10, acceptedCount: 7, notAcceptedCount: 3 });
    await expect(page.getByText("Tally recorded", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "View tally" })).toBeVisible();
    expect(api.batchMutationRequests()).toBe(0);
  });

  test("does not complete a review when saving its snapshot fails and can retry", async ({ page }) => {
    const api = await mockReviewBackend(page, { userId: 1, email: "manager@example.test", fullName: "Fixture Manager", role: "MANAGER", farmId: 1 }, { noReviews: true, failReviewCreateOnce: true });
    await page.goto("/batches/2/selection");
    await confirmCompleteReview(page);
    await expect.poll(() => api.reviewCreateRequests()).toBe(1);
    await expect(page.getByText(/could not|unable|failed/i).first()).toBeVisible();
    expect(api.reviewFinalizeRequests()).toBe(0);
    await confirmCompleteReview(page);
    await expect.poll(() => api.reviewActions()).toEqual(["create", "create", "finalize"]);
    await expect(page.getByRole("status").filter({ hasText: "Needs tally" })).toBeVisible();
  });

  test("retries review completion using the saved draft and prevents duplicate submissions", async ({ page }) => {
    const api = await mockReviewBackend(page, { userId: 1, email: "manager@example.test", fullName: "Fixture Manager", role: "MANAGER", farmId: 1 }, { noReviews: true, failReviewFinalizeOnce: true, reviewCreateDelayMs: 500 });
    await page.goto("/batches/2/selection");
    await confirmCompleteReview(page);
    await expect(page.getByRole("button", { name: "Completing review…" })).toBeDisabled();
    await expect.poll(() => api.reviewFinalizeRequests()).toBe(1);
    await expect(page.getByText(/could not|unable|failed/i).first()).toBeVisible();
    await page.reload();
    await confirmCompleteReview(page);
    await expect.poll(() => api.reviewActions()).toEqual(["create", "finalize", "finalize"]);
    await expect(page.getByRole("status").filter({ hasText: "Needs tally" })).toBeVisible();
  });
});

test("desktop groups health and cost evidence into separate sections", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Desktop Chromium coverage.");
  await page.setViewportSize({ width: 1440, height: 900 });
  const payload = reportPayload();
  payload.productUse = [{ sourceId: 1, recordedAt: "2026-01-10T00:00:00Z", productType: "FEED", brandName: "Starter feed", productName: null, quantity: 2, unit: "kg", unitCost: 50, calculatedCost: 100, costStatus: "VALUED", purpose: null, notes: null, recordedBy: 1 }] as unknown as typeof payload.productUse;
  await mockReviewBackend(page, { userId: 1, email: "manager@example.test", fullName: "Fixture Manager", role: "MANAGER", farmId: 1 }, { payload });
  await page.goto("/batches/2/selection");
  await page.getByRole("tab", { name: "Health & vaccination" }).click();
  const vaccination = page.locator("#report-vaccination");
  const health = page.locator("#report-health");
  await expect(vaccination).toBeVisible();
  await expect(health).toBeVisible();
  const vaccineBox = await vaccination.boundingBox();
  const healthBox = await health.boundingBox();
  expect(vaccineBox).not.toBeNull();
  expect(healthBox).not.toBeNull();
  expect(Math.abs(vaccineBox!.y - healthBox!.y)).toBeLessThan(2);
  expect(healthBox!.x).toBeGreaterThanOrEqual(vaccineBox!.x + vaccineBox!.width);
  await page.getByRole("tab", { name: "Costs & products" }).click();
  await expect(page.locator("#report-expenses")).toBeVisible();
  await expect(page.locator("#report-products")).toBeVisible();
});

test("desktop keeps saved versions beside the review and snapshot", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Desktop Chromium coverage.");
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockReviewBackend(page, { userId: 1, email: "manager@example.test", fullName: "Fixture Manager", role: "MANAGER", farmId: 1 });
  const review = finalizedReview();
  await page.route("**/api/backend/batches/2/selection-reviews", (route) => route.fulfill({ json: Array.from({ length: 8 }, (_, index) => ({ ...review, id: review.id + index, versionNumber: 8 - index })) }));
  await page.goto("/batches/2/selection?reviewId=44");
  await page.getByRole("tab", { name: "Review & versions" }).click();
  const controls = page.locator("#report-review");
  const snapshot = page.locator("section").filter({ hasText: "Manager-reviewed snapshot" });
  const versions = page.locator("#report-versions");
  await expect(snapshot).toBeVisible();
  const [controlBox, snapshotBox, versionBox] = await Promise.all([controls.boundingBox(), snapshot.boundingBox(), versions.boundingBox()]);
  expect(controlBox && snapshotBox && versionBox).toBeTruthy();
  expect(versionBox!.x).toBeGreaterThanOrEqual(controlBox!.x + controlBox!.width);
  expect(Math.abs(versionBox!.y - controlBox!.y)).toBeLessThan(2);
  const list = page.getByLabel("Saved report versions");
  await expect(list.getByRole("button")).toHaveCount(8);
  await list.getByRole("button").last().scrollIntoViewIfNeeded();
  await expect(list.getByRole("button").last()).toBeVisible();
});

test("desktop shows all four finance figures in the expense panel", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Desktop Chromium coverage.");
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockReviewBackend(page, { userId: 1, email: "manager@example.test", fullName: "Fixture Manager", role: "MANAGER", farmId: 1 });
  await page.goto("/batches/2/selection");
  await page.getByRole("tab", { name: "Costs & products" }).click();
  const finance = page.getByRole("region", { name: "PHP finance" });
  const facts = ["Cash expense", "Products used", "Batch cost", "Sale proceeds"].map((label) => finance.getByText(label, { exact: true }).locator(".."));
  const boxes = await Promise.all(facts.map((fact) => fact.boundingBox()));
  expect(boxes.every(Boolean)).toBe(true);
  expect(boxes[1]!.y).toBeCloseTo(boxes[0]!.y, 0);
  expect(boxes[3]!.y).toBeCloseTo(boxes[2]!.y, 0);
  expect(boxes[2]!.y).toBeCloseTo(boxes[0]!.y, 0);
});

test("desktop report keeps unverified population hidden", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Desktop Chromium coverage.");
  const payload = reportPayload();
  Object.assign(payload.population, { reconciliationRequired: true, reconciliationMessage: "Population records need review." });
  await mockReviewBackend(page, { userId: 1, email: "manager@example.test", fullName: "Fixture Manager", role: "MANAGER", farmId: 1 }, { payload });
  await page.goto("/batches/2/selection");
  await expect(page.getByLabel("Report summary")).toContainText("— / 150");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test.describe("Recorded death summary", () => {
  const manager: Profile = { userId: 1, email: "manager@example.test", fullName: "Fixture Manager", role: "MANAGER", farmId: 1 };

  test("opens by keyboard and presents only the recorded death categories", async ({ page }) => {
    const payload = reportPayload();
    Object.assign(payload.population, { totalDeaths: 15, healthRelatedDeaths: 12, accidentalDeaths: 3, sourceEventCount: 2 });
    await mockReviewBackend(page, manager, { payload });
    await page.goto("/batches/2/selection");

    const trigger = page.getByLabel("Report summary").getByRole("button", { name: /recorded deaths/i });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: /death/i });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/health/i);
    await expect(dialog).toContainText("12");
    await expect(dialog).toContainText(/accidental/i);
    await expect(dialog).toContainText("3");
    await expect(dialog).toContainText(/no specific cause recorded|not recorded|unavailable/i);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("distinguishes no recorded deaths from confirmed absence of death", async ({ page }) => {
    await mockReviewBackend(page, manager);
    await page.goto("/batches/2/selection");
    await page.getByLabel("Report summary").getByRole("button", { name: /recorded deaths/i }).click();
    const dialog = page.getByRole("dialog", { name: /death/i });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/no.*recorded|no.*record/i);
    await expect(dialog).not.toContainText(/all birds.*healthy|no birds died/i);
  });

  test("shows recorded live notes without inventing a diagnosis", async ({ page }) => {
    const payload = reportPayload();
    Object.assign(payload.population, { totalDeaths: 3, healthRelatedDeaths: 2, accidentalDeaths: 1, sourceEventCount: 2 });
    const event = (id: number, eventType: string, details: string) => ({ id, batchId: 2, handlerId: 1, handlerName: "Handler", eventDate: "2026-01-10", eventType, affectedCount: id === 1 ? 2 : 1, title: id === 1 ? "Health-related death" : "Accidental death", details, tags: id === 1 ? "Coughing, coughing, SALE_PURPOSE:OTHER" : null, populationDelta: id === 1 ? -2 : -1, populationAfter: 147, createdAt: "2026-01-10T08:00:00Z" });
    await mockReviewBackend(page, manager, { payload, noReviews: true, deathEvents: { HEALTH_DEATH: [event(1, "HEALTH_DEATH", "Breathing difficulty reported")], ACCIDENTAL_DEATH: [event(2, "ACCIDENTAL_DEATH", "Trampled near feeder")] } });
    await page.goto("/batches/2/selection");
    await page.getByLabel("Report summary").getByRole("button", { name: /recorded deaths/i }).click();
    const dialog = page.getByRole("dialog", { name: /death/i });
    await expect(dialog).toContainText("Breathing difficulty reported");
    await expect(dialog).toContainText("Trampled near feeder");
    await expect(dialog.getByText("Coughing", { exact: true })).toHaveCount(1);
    await expect(dialog).not.toContainText("SALE_PURPOSE");
    await expect(dialog).toContainText(/recorded notes or tags/i);
  });

  test("includes older event pages and limits notes to the report period", async ({ page }) => {
    const payload = reportPayload();
    Object.assign(payload.population, { totalDeaths: 101, healthRelatedDeaths: 101, accidentalDeaths: 0, sourceEventCount: 101 });
    const events = Array.from({ length: 101 }, (_, index) => ({ id: index + 1, batchId: 2, eventDate: "2026-01-10", eventType: "HEALTH_DEATH", affectedCount: 1, title: "Health-related death", details: index === 100 ? "Earlier recorded observation" : null }));
    const api = await mockReviewBackend(page, manager, { payload, noReviews: true, deathEvents: { HEALTH_DEATH: events } });
    await page.goto("/batches/2/selection");
    await page.getByLabel("Report summary").getByRole("button", { name: /recorded deaths/i }).click();
    await expect(page.getByRole("dialog", { name: /death/i })).toContainText("Earlier recorded observation");
    const queries = api.deathEventQueries();
    expect(queries.some(params => params.get("type") === "HEALTH_DEATH" && params.get("page") === "1")).toBe(true);
    expect(queries.every(params => params.get("start") === payload.batch.startDate && params.get("end") === payload.asOfDate)).toBe(true);
  });

  test("distinguishes a failed source request from an unrecorded cause", async ({ page }) => {
    const payload = reportPayload();
    Object.assign(payload.population, { totalDeaths: 2, healthRelatedDeaths: 2, accidentalDeaths: 0, sourceEventCount: 1 });
    await mockReviewBackend(page, manager, { payload, noReviews: true, deathEventsFail: true });
    await page.goto("/batches/2/selection");
    await page.getByLabel("Report summary").getByRole("button", { name: /recorded deaths/i }).click();
    const dialog = page.getByRole("dialog", { name: /death/i });
    await expect(dialog).toContainText(/unable to load|could not load|unavailable/i);
    await expect(dialog).not.toContainText(/no specific cause recorded/i);
  });

  test("uses the saved snapshot's death records instead of newer live data", async ({ page }) => {
    const live = reportPayload();
    Object.assign(live.population, { totalDeaths: 9, healthRelatedDeaths: 9, accidentalDeaths: 0, sourceEventCount: 1 });
    live.healthEvents.push({ sourceEventId: 10, eventDate: "2026-01-14", eventType: "HEALTH_DEATH", title: "Recent death note", severity: null, affectedCount: 9, details: "Newer live observation", tags: null, recordedBy: 1 } as never);

    const snapshot = reportPayload();
    Object.assign(snapshot.population, { totalDeaths: 2, healthRelatedDeaths: 2, accidentalDeaths: 0, sourceEventCount: 1 });
    snapshot.healthEvents.push({ sourceEventId: 5, eventDate: "2026-01-10", eventType: "HEALTH_DEATH", title: "Historical death note", severity: null, affectedCount: 2, details: "Recorded historical observation", tags: null, recordedBy: 1 } as never);
    const api = await mockReviewBackend(page, manager, { payload: live, snapshotPayload: snapshot });
    await page.goto("/batches/2/selection?reviewId=44");
    await expect(page.getByText("Saved review snapshot.", { exact: true })).toBeVisible();
    await page.getByLabel("Report summary").getByRole("button", { name: /recorded deaths/i }).click();
    const dialog = page.getByRole("dialog", { name: /death/i });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("2");
    await expect(dialog).toContainText("Recorded historical observation");
    await expect(dialog).not.toContainText("Newer live observation");
    await expect(dialog).not.toContainText("Recent death note");
    expect(api.deathEventRequests()).toBe(0);
  });
});


for (const version of [3, undefined]) test(`captures each resumed selection edit with its own command identity and the opening revision (${version})`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const creationId = "f05e6719-a845-426f-9af5-4df4410a3001";
  const session = { id: 91, farmId: 1, batchId: 2, reviewerId: 1, selectionDate: "2026-11-18", evaluatedCount: 10,
    acceptedCount: 10, continueObservationCount: 0, notAcceptedCount: 0, otherCount: 0, selectionRatePercent: 100,
    selectionRateNumerator: 10, selectionRateDenominator: 10, status: "DRAFT", criterionCodes: [], criteriaNotes: null,
    sessionNotes: null, operationId: creationId, supersedesSessionId: null, createdAt: "2026-11-18T09:00:00Z",
    updatedAt: "2026-11-18T09:00:00Z", finalizedAt: null, selectionReviewId: 44, sourceDataAcknowledged: false, version };
  await mockReviewBackend(page, { userId: 1, email: "manager@example.test", fullName: "Fixture Manager", role: "MANAGER", farmId: 1 }, { initialSessions: [session] });
  const sent: Array<{ operationId: string; payload: Record<string, unknown> }> = [];
  await page.route("**/api/backend/sync/v2/operations", route => {
    const operations = route.request().postDataJSON().operations;
    sent.push(...operations);
    return route.fulfill({ json: { results: operations.map((item: {operationId: string}) => ({ operationId: item.operationId, status: "RETRYABLE", message: "Synthetic pending command" })) } });
  });
  await page.goto("/batches/2/selection?reviewId=44");
  await page.getByRole("button", { name: "Resume tally" }).click();
  const dialog = page.getByRole("dialog", { name: "Selection tally" });
  await dialog.getByLabel("Selected", { exact: true }).fill("9");
  await dialog.getByRole("button", { name: "Save draft", exact: true }).click();
  if (version == null) {
    await expect(dialog.getByText(/Refresh the selection draft.*revision/)).toBeVisible();
    expect(sent).toHaveLength(0); return;
  }
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => sent.length, { timeout: 15_000 }).toBeGreaterThan(0);
  expect(sent[0].operationId).not.toBe(creationId);
  expect(sent[0].payload).toMatchObject({ sessionId: 91, expectedVersion: 3, acceptedCount: 9, operationId: sent[0].operationId });
});

test("finalizes an unchanged acknowledged selection draft without queuing another edit", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const session = { id: 91, farmId: 1, batchId: 2, reviewerId: 1, selectionDate: "2026-11-18", evaluatedCount: 10,
    acceptedCount: 10, continueObservationCount: 0, notAcceptedCount: 0, otherCount: 0, selectionRatePercent: 100,
    selectionRateNumerator: 10, selectionRateDenominator: 10, status: "DRAFT", criterionCodes: [], criteriaNotes: null,
    sessionNotes: null, operationId: "f05e6719-a845-426f-9af5-4df4410a3001", supersedesSessionId: null,
    createdAt: "2026-11-18T09:00:00Z", updatedAt: "2026-11-18T09:00:00Z", finalizedAt: null,
    selectionReviewId: 44, sourceDataAcknowledged: false, version: 3 };
  const api = await mockReviewBackend(page, { userId: 1, email: "manager@example.test", fullName: "Fixture Manager", role: "MANAGER", farmId: 1 }, { initialSessions: [session] });
  const queued: unknown[] = [];
  await page.route("**/api/backend/sync/v2/operations", route => {
    const operations = route.request().postDataJSON().operations; queued.push(...operations);
    return route.fulfill({ json: { results: operations.map((item: { operationId: string }) => ({ operationId: item.operationId, status: "RETRYABLE" })) } });
  });
  await page.goto("/batches/2/selection?reviewId=44");
  await page.getByRole("button", { name: "Resume tally" }).click();
  const dialog = page.getByRole("dialog", { name: "Selection tally" });
  await dialog.getByRole("button", { name: "Finalize outcome", exact: true }).click();
  await expect.poll(() => api.finalizedRequests()).toBe(1);
  expect(queued).toHaveLength(0);
  expect(api.finalizedBody()).toEqual({ expectedVersion: 3 });
});
