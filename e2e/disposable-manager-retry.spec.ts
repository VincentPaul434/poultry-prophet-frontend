import { expect, test, type APIRequestContext } from "@playwright/test";

test.skip(process.env.RUN_DISPOSABLE_FULL_FLOW !== "true", "Requires an isolated local validation backend on port 18081.");
test.setTimeout(180_000);
test.use({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });
const backend = "http://127.0.0.1:18081/api";

async function post(api: APIRequestContext, path: string, data: unknown, token?: string) {
  const response = await api.post(`${backend}${path}`, { data, headers: token ? { Authorization: `Bearer ${token}` } : {} });
  expect(response.ok(), `${path}: HTTP ${response.status()}`).toBeTruthy();
  return response.json();
}
async function get(api: APIRequestContext, path: string, token: string) {
  const response = await api.get(`${backend}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  expect(response.ok(), `${path}: HTTP ${response.status()}`).toBeTruthy();
  return response.json();
}

test("manager retries product, expense and stock requests after lost server acknowledgements", async ({ page, context, request, baseURL }) => {
  if (!baseURL || !["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname)) throw new Error("Local frontend required");
  const origin = new URL(baseURL).origin;
  const version = await (await request.get(`${backend}/version`)).json();
  expect(version.environment).toBe("validation");
  expect(version.offlineCapabilities.schemaReady).toBe(true);
  const unique = crypto.randomUUID();
  const manager = await post(request, "/auth/register", { email: `retry-${unique}@example.test`, password: "local-test-only-password-123", fullName: "Retry Fixture", farmName: "Retry Fixture Farm" });
  const token: string = manager.token;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const batch = await post(request, "/batches", { name: `Retry ${unique}`, initialPopulation: 20, bloodline: "Fixture", startDate: today, hatchDate: today, farmEntryDate: today, handlerUserIds: [] }, token);
  const productName = `Retry vaccine ${unique}`;
  let productId: number | null = null;
  const sent: Record<string, Array<{ key: string; payload: unknown }>> = {};
  await context.addInitScript((profile) => {
    localStorage.setItem("pp_auth_session", JSON.stringify({ sessionId: "isolated-retry-fixture", user: profile }));
    localStorage.setItem("pp_language", "en");
    Object.defineProperty(navigator.serviceWorker, "register", { value: async () => Object.assign(new EventTarget(), { active: null, installing: null, waiting: null }) });
  }, manager);
  await context.route("**/*", async route => {
    const req = route.request(); const url = new URL(req.url());
    if (url.origin !== origin) return route.abort("blockedbyclient");
    if (!url.pathname.startsWith("/api/backend/")) return ["GET", "HEAD"].includes(req.method()) ? route.continue() : route.abort("blockedbyclient");
    const path = url.pathname.slice("/api/backend".length);
    if (path === "/auth/refresh") return route.fulfill({ json: { ...manager, token } });
    const headers = await req.allHeaders();
    delete headers.origin; delete headers.referer; delete headers.host; delete headers["content-length"];
    const response = await route.fetch({ url: `${backend}${path}${url.search}`, headers });
    if (req.method() === "POST" && (path === "/inventory/products" || path === "/financial-transactions" || /^\/financial-transactions\/\d+\/corrections$/.test(path) || path === `/inventory/products/${productId}/stock-ins`)) {
      const payload = req.postDataJSON();
      const key = headers["idempotency-key"] ?? payload.operationId;
      (sent[path] ??= []).push({ key, payload });
      expect(response.ok(), `${path}: HTTP ${response.status()}`).toBeTruthy();
      if (sent[path].length === 1) return route.abort("connectionreset");
    }
    return route.fulfill({ response });
  });

  await page.goto("/inputs");
  await page.getByRole("button", { name: "Add product", exact: true }).click();
  const createProduct = page.getByRole("dialog", { name: "Add farm product" });
  await createProduct.getByLabel("Product / brand").fill(productName);
  await createProduct.getByLabel("Type", { exact: true }).selectOption("VACCINE");
  await createProduct.getByLabel("Inventory unit").fill("vial");
  await createProduct.getByLabel("Quantity precision").selectOption("whole");
  await createProduct.getByLabel("Starting stock (optional)", { exact: true }).fill("100");
  await createProduct.getByLabel(/Opening price per/).fill("10");
  await createProduct.getByRole("button", { name: "Save product" }).click();
  await expect(createProduct.getByRole("alert")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Retry previous request" }).click();
  await expect.poll(() => sent["/inventory/products"]?.length).toBe(2);
  expect(sent["/inventory/products"][0].key).toBeTruthy();
  expect(sent["/inventory/products"][1]).toEqual(sent["/inventory/products"][0]);
  await expect(page.getByText(/previous request.*unknown/i)).toHaveCount(0);
  const initialProducts = await get(request, "/inventory/products", token);
  const matchingProducts = initialProducts.filter((item: { brandName: string }) => item.brandName === productName);
  expect(matchingProducts).toHaveLength(1);
  productId = matchingProducts[0].id;
  expect(Number(matchingProducts[0].stockOnHand)).toBe(100);

  await page.goto(`/batches/${batch.id}`);
  await page.getByRole("button", { name: "Add expense", exact: true }).click();
  const expense = page.getByRole("dialog", { name: "Add batch expense" });
  await expense.getByLabel("Category").fill("Retry transport");
  await expense.getByLabel("Amount (PHP)").fill("100");
  await expense.getByRole("button", { name: "Save expense" }).click();
  await expect(expense.getByRole("alert")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Retry previous request" }).click();
  await expect.poll(() => sent["/financial-transactions"]?.length).toBe(2);
  expect(sent["/financial-transactions"][0].key).toBeTruthy();
  expect(sent["/financial-transactions"][1]).toEqual(sent["/financial-transactions"][0]);
  await expect(page.getByText(/previous request.*unknown/i)).toHaveCount(0);
  const expenses = await get(request, `/financial-transactions/page?page=0&size=10&batchId=${batch.id}&type=EXPENSE&status=POSTED`, token);
  expect(expenses.items.filter((item: { category: string }) => item.category === "Retry transport")).toHaveLength(1);
  const originalExpenseId = expenses.items.find((item: { category: string }) => item.category === "Retry transport").id;
  await page.getByRole("button", { name: "Edit expense Retry transport" }).click();
  const correction = page.getByRole("dialog", { name: "Edit batch expense" });
  await correction.getByLabel("Amount (PHP)").fill("120");
  await correction.getByLabel("Reason for correction").fill("Correct transport amount");
  await correction.getByRole("button", { name: "Save correction" }).click();
  await expect(correction.getByRole("alert")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Retry previous request" }).click();
  const correctionPath = `/financial-transactions/${originalExpenseId}/corrections`;
  await expect.poll(() => sent[correctionPath]?.length).toBe(2);
  expect(sent[correctionPath][0].key).toBeTruthy();
  expect(sent[correctionPath][1]).toEqual(sent[correctionPath][0]);
  const corrected = await get(request, `/financial-transactions/page?page=0&size=10&batchId=${batch.id}&type=EXPENSE&status=POSTED`, token);
  const matchingExpenses = corrected.items.filter((item: { category: string }) => item.category === "Retry transport");
  expect(matchingExpenses).toHaveLength(1);
  expect(Number(matchingExpenses[0].amount)).toBe(120);

  await page.goto("/inputs");
  await page.locator("article").filter({ hasText: productName }).getByRole("button", { name: "Add stock" }).click();
  const stock = page.getByRole("dialog", { name: "Add stock" });
  await stock.getByLabel("Quantity purchased").fill("5");
  await stock.getByLabel("Price per vial").fill("10");
  await stock.getByRole("button", { name: "Record purchase" }).click();
  await expect(stock.getByRole("alert")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Retry previous request" }).click();
  const stockPath = `/inventory/products/${productId}/stock-ins`;
  await expect.poll(() => sent[stockPath]?.length).toBe(2);
  expect(sent[stockPath][0].key).toBeTruthy();
  expect(sent[stockPath][1]).toEqual(sent[stockPath][0]);
  await expect(page.getByText(/previous request.*unknown/i)).toHaveCount(0);
  const products = await get(request, "/inventory/products", token);
  expect(Number(products.find((item: { id: number }) => item.id === productId).stockOnHand)).toBe(105);
  const movements = await get(request, `/inventory/movements?productId=${productId}`, token);
  expect(movements.filter((item: { movementType: string }) => item.movementType === "OPENING_BALANCE")).toHaveLength(1);
  expect(movements.filter((item: { movementType: string }) => item.movementType === "STOCK_IN")).toHaveLength(1);
});
