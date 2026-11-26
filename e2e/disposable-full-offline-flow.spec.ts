import { expect, test, type BrowserContext, type Page, type APIRequestContext } from "@playwright/test";

test.skip(process.env.RUN_DISPOSABLE_FULL_FLOW !== "true", "Requires the isolated local validation backend on port 18081.");
test.setTimeout(180_000);
test.use({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });
const backend = "http://127.0.0.1:18081/api";
const password = "local-test-only-password-123";

async function post(api: APIRequestContext, path: string, data: unknown, token?: string) {
  const result = await api.post(`${backend}${path}`, { data, headers: token ? { Authorization: `Bearer ${token}` } : {} });
  expect(result.ok(), `${path}: HTTP ${result.status()}`).toBeTruthy();
  return result.json();
}
async function get(api: APIRequestContext, path: string, token: string) {
  const result = await api.get(`${backend}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  expect(result.ok(), `${path}: HTTP ${result.status()}`).toBeTruthy();
  return result.json();
}
async function bind(context: BrowserContext, profile: Record<string, unknown>, token: string) {
  await context.addInitScript((user) => {
    localStorage.setItem("pp_auth_session", JSON.stringify({ sessionId: "isolated-offline-flow", user }));
    localStorage.setItem("pp_language", "en");
    Object.defineProperty(navigator.serviceWorker, "register", { value: async () => Object.assign(new EventTarget(), { active: null, installing: null, waiting: null }) });
  }, profile);
  // Every application API request is routed to the disposable server; none can reach the user's database.
  await context.route("**/api/backend/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.slice("/api/backend".length);
    if (path === "/auth/refresh") return route.fulfill({ json: { ...profile, token } });
    const headers = await route.request().allHeaders();
    // Match the real same-origin proxy when forwarding to the isolated API.
    delete headers.origin; delete headers.referer; delete headers.host; delete headers.cookie; delete headers["content-length"];
    const response = await route.fetch({ url: `${backend}${path}${url.search}`, headers });
    return route.fulfill({ response });
  });
}
async function pending(page: Page) {
  return page.evaluate(async () => {
    const open = indexedDB.open("poultry-prophet-offline-v1");
    const db = await new Promise<IDBDatabase>((resolve, reject) => { open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error); });
    try {
      const request = db.transaction("outbox").objectStore("outbox").getAll();
      return await new Promise<Array<{ operationId: string; entityType: string; batchId: number; occurredAt: string; status?: string; lastErrorCode?: string; lastErrorMessage?: string; payload: Record<string, unknown> }>>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    } finally { db.close(); }
  });
}

test("handler records a selected dose offline, manager sees cost and corrects expense", async ({ browser, context, page, request }) => {
  const version = await (await request.get(`${backend}/version`)).json();
  expect(version.environment).toBe("validation");
  expect(version.offlineCapabilities.schemaReady).toBe(true);
  const id = crypto.randomUUID();
  const manager = await post(request, "/auth/register", { email: `manager-${id}@example.test`, password, fullName: "Fixture Manager", farmName: "Offline Test Farm" });
  const managerToken: string = manager.token;
  const handlerEmail = `handler-${id}@example.test`;
  const handler = await post(request, "/handlers", { email: handlerEmail, password, fullName: "Fixture Handler" }, managerToken);
  const handlerLogin = await post(request, "/auth/login", { email: handlerEmail, password });
  const handlerToken: string = handlerLogin.token;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const batch = await post(request, "/batches", { name: `Offline ${id}`, initialPopulation: 20, bloodline: "Fixture", startDate: today, hatchDate: today, farmEntryDate: today, handlerUserIds: [handler.userId ?? handler.id] }, managerToken);
  const product = await post(request, "/inventory/products", { productType: "VACCINE", brandName: "Fixture vaccine", stockUnit: "vial", openingQuantity: 100, openingUnitCost: 10, reorderLevel: 99 }, managerToken);
  const program = await post(request, "/vaccination-programs", { name: "Fixture schedule", items: [{ vaccineName: "Fixture vaccine", farmProductId: product.id, ageOffsetValue: 0, ageOffsetUnit: "DAY" }, { vaccineName: "Fixture vaccine", farmProductId: product.id, ageOffsetValue: 7, ageOffsetUnit: "DAY" }] }, managerToken);
  const plan = await post(request, `/batches/${batch.id}/vaccination-plan`, { programId: program.id }, managerToken);
  expect(plan).toHaveLength(2);

  await bind(context, handlerLogin, handlerToken);
  await page.goto(`/batches/${batch.id}/data-entry?from=batch`);

  await page.getByRole("button", { name: "Feed or medicine used" }).click();

  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Product from farm stock").selectOption(String(product.id));

  await dialog.getByLabel("Scheduled vaccination").selectOption(String(plan[1].id));

  await dialog.getByLabel(/Units used/).fill("2");

  await expect(dialog.getByRole("button", { name: /Vaccination/ })).toHaveAttribute("aria-pressed", "true");


  await context.setOffline(true);
  await dialog.getByRole("button", { name: "Save product record" }).click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(async () => (await pending(page)).length).toBe(1);
  const [queued] = await pending(page);
  expect(queued.entityType).toBe("VACCINATION_PLAN");
  expect(queued.payload).toMatchObject({ planId: plan[1].id, quantity: 2, unit: "vial" });

  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(async () => {
    const items = await pending(page);
    const issue = items.find((item) => ["REJECTED", "CONFLICT", "AUTH_REQUIRED"].includes(item.status ?? ""));
    if (issue) throw new Error(`Offline operation needs help: ${issue.status} ${issue.lastErrorCode ?? ""} ${issue.lastErrorMessage ?? ""}`);
    return items.length;
  }, { timeout: 60_000 }).toBe(0);

  const replay = await post(request, "/sync/v2/operations", { deviceId: "offline-test", operations: [{ ...queued, schemaVersion: 1 }] }, handlerToken);
  expect(replay.results[0].status).toBe("ALREADY_APPLIED");
  const current = await get(request, "/inventory/products", managerToken);
  expect(Number(current.find((item: { id: number }) => item.id === product.id).stockOnHand)).toBe(98);
  expect(current.find((item: { id: number }) => item.id === product.id).lowStock).toBe(true);
  const doses = await get(request, `/batches/${batch.id}/vaccination-plan`, managerToken);
  expect(doses.find((item: { id: number }) => item.id === plan[0].id).status).toBe("SCHEDULED");
  expect(doses.find((item: { id: number }) => item.id === plan[1].id).status).toBe("COMPLETED");
  const inputs = await get(request, `/inputs?batchId=${batch.id}`, managerToken);
  expect(inputs).toHaveLength(1);
  expect(Number(inputs[0].calculatedCost)).toBe(20);

  const managerContext = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  try {

    await bind(managerContext, manager, managerToken);
    const managerPage = await managerContext.newPage();
    await managerPage.goto(`/batches/${batch.id}`);
    await managerPage.getByRole("button", { name: "Add expense", exact: true }).click();
    const add = managerPage.getByRole("dialog", { name: "Add batch expense" });
    await add.getByLabel("Category").fill("Transport");
    await add.getByLabel("Amount (PHP)").fill("100");
    await add.getByRole("button", { name: "Save expense" }).click();
    await expect(add).toHaveCount(0);
    await managerPage.getByRole("button", { name: "Edit expense Transport" }).click();
    const edit = managerPage.getByRole("dialog", { name: "Edit batch expense" });
    await edit.getByLabel("Amount (PHP)").fill("120");
    await edit.getByLabel("Reason for correction").fill("Wrong amount");
    await edit.getByRole("button", { name: "Save correction" }).click();
    await expect(edit).toHaveCount(0);
    const expenses = await get(request, `/financial-transactions/page?page=0&size=10&batchId=${batch.id}&type=EXPENSE&status=POSTED`, managerToken);
    expect(expenses.items).toHaveLength(1);
    expect(Number(expenses.items[0].amount)).toBe(120);

    const report = await get(request, `/batches/${batch.id}/selection-review/preview?asOfDate=${today}`, managerToken);
    const pesos = report.finance.currencyTotals.find((group: { currency: string }) => group.currency === "PHP");
    expect(Number(pesos.recordedExpense)).toBe(120);
    expect(Number(pesos.productsConsumedCost)).toBe(20);
    expect(Number(pesos.totalRecordedBatchCost)).toBe(140);
    await managerPage.goto("/dashboard");
    await expect(managerPage.getByText("Fixture vaccine: 98 vial")).toBeVisible();

    const legacyBatch = await post(request, "/batches", { name: `Legacy ${id}`, initialPopulation: 10, bloodline: "Fixture", startDate: today, hatchDate: today, farmEntryDate: today }, managerToken);
    const legacyProgram = await post(request, "/vaccination-programs", { name: "Old unlinked schedule", items: [{ vaccineName: "Old name", ageOffsetValue: 0, ageOffsetUnit: "DAY" }] }, managerToken);
    await post(request, `/batches/${legacyBatch.id}/vaccination-plan`, { programId: legacyProgram.id }, managerToken);
    await managerPage.goto(`/batches/${legacyBatch.id}`);
    await expect(managerPage.getByText("Some scheduled vaccines need a product link before they can be recorded.")).toBeVisible();
    await managerPage.getByRole("button", { name: "Change schedule" }).click();
    const schedule = managerPage.getByRole("dialog", { name: "Change batch vaccination schedule" });
    await schedule.getByLabel("Vaccine name", { exact: true }).selectOption(String(product.id));
    await schedule.getByRole("button", { name: "Save new schedule" }).click();
    await expect(schedule).toHaveCount(0);
    await expect.poll(async () => (await get(request, `/batches/${legacyBatch.id}/vaccination-plan`, managerToken)).some((item: { farmProductId: number; status: string }) => item.farmProductId === product.id && item.status === "SCHEDULED"), { timeout: 60_000 }).toBe(true);

    const afterReview = await get(request, "/inventory/products", managerToken);
    expect(Number(afterReview.find((item: { id: number }) => item.id === product.id).stockOnHand)).toBe(98);
  } finally { await managerContext.close(); }
});
