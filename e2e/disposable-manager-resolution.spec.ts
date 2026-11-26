import { expect, test, type APIRequestContext } from "@playwright/test";

test.skip(process.env.RUN_DISPOSABLE_FULL_FLOW !== "true", "Requires the isolated validation backend on port 18081.");
test.setTimeout(180_000);
test.use({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });
const backend = "http://127.0.0.1:18081/api";

async function post(api: APIRequestContext, path: string, data: unknown, token?: string) {
  const response = await api.post(`${backend}${path}`, { data, headers: token ? { Authorization: `Bearer ${token}` } : {} });
  expect(response.ok(), `${path}: ${response.status()}`).toBeTruthy();
  return response.json();
}

for (const initial of ["rejected", "committed"] as const) test(`manager stops an ${initial} expense without a duplicate`, async ({ page, context, request, baseURL }) => {
  if (!baseURL || !["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname)) throw new Error("Local frontend required");
  const origin = new URL(baseURL).origin;
  const version = await (await request.get(`${backend}/version`)).json();
  expect(version.environment).toBe("validation");
  expect(version.offlineCapabilities.schemaReady).toBe(true);
  const unique = crypto.randomUUID();
  const manager = await post(request, "/auth/register", { email: `resolution-${unique}@example.test`, password: "local-test-only-password-123", fullName: "Resolution Fixture", farmName: "Resolution Test Farm" });
  const token: string = manager.token;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const batch = await post(request, "/batches", { name: `Resolve ${unique}`, initialPopulation: 20, bloodline: "Fixture", startDate: today, hatchDate: today, farmEntryDate: today }, token);
  let captured: { key: string; payload: unknown } | undefined;
  let resolution: string | undefined;
  await context.addInitScript((profile) => {
    localStorage.setItem("pp_auth_session", JSON.stringify({ sessionId: "isolated-resolution-fixture", user: profile }));
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
    if (req.method() === "POST" && path === "/financial-transactions" && !captured) {
      captured = { key: headers["idempotency-key"], payload: req.postDataJSON() };
      if (initial === "rejected") return route.fulfill({ status: 400, json: { message: "Synthetic validation rejection" } });
      const response = await route.fetch({ url: `${backend}${path}${url.search}`, headers });
      expect(response.ok()).toBeTruthy();
      return route.abort("connectionreset");
    }
    const response = await route.fetch({ url: `${backend}${path}${url.search}`, headers });
    if (path === "/manager-operations/resolve") resolution = (await response.json()).status;
    return route.fulfill({ response });
  });
  await page.goto(`/batches/${batch.id}`);
  await page.getByRole("button", { name: "Add expense", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add batch expense" });
  await dialog.getByLabel("Category").fill("Resolution transport");
  await dialog.getByLabel("Amount (PHP)").fill("100");
  await dialog.getByRole("button", { name: "Save expense" }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Stop previous request" }).click();
  await page.getByRole("dialog", { name: "Stop this request?" }).getByRole("button", { name: "Confirm stop" }).click();
  await expect.poll(() => resolution).toBe(initial === "rejected" ? "CANCELLED" : "APPLIED");
  await expect(page.getByRole("button", { name: "Add expense", exact: true })).toBeEnabled();
  expect(captured?.key).toBeTruthy();
  if (initial === "rejected") {
    const late = await request.post(`${backend}/financial-transactions`, { data: captured!.payload, headers: { Authorization: `Bearer ${token}`, "Idempotency-Key": captured!.key } });
    expect(late.status()).toBe(409);
  }
  const response = await request.get(`${backend}/financial-transactions/page?page=0&size=10&batchId=${batch.id}&type=EXPENSE&status=POSTED`, { headers: { Authorization: `Bearer ${token}` } });
  const rows = (await response.json()).items.filter((row: { category: string }) => row.category === "Resolution transport");
  expect(rows).toHaveLength(initial === "committed" ? 1 : 0);
});
