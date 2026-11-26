import { expect, test, type APIRequestContext } from "@playwright/test";

test.skip(process.env.RUN_DISPOSABLE_DEV_OFFLINE !== "true", "Requires the isolated local validation API and local development frontend.");
test.setTimeout(180_000);

const backend = "http://127.0.0.1:18081/api";
const password = "local-test-only-password-123";

async function post(request: APIRequestContext, path: string, data: unknown, token?: string) {
  const response = await request.post(`${backend}${path}`, {
    data,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    maxRedirects: 0,
  });
  expect(response.ok(), `${path}: HTTP ${response.status()}`).toBeTruthy();
  return response.json();
}

test("a cached development batch page reopens with usable controls while offline", async ({ context, page, request, baseURL }) => {
  const frontend = new URL(baseURL ?? "");
  expect(["localhost", "127.0.0.1", "[::1]"]).toContain(frontend.hostname);
  expect(frontend.protocol).toBe("http:");
  const versionResponse = await request.get(`${backend}/version`, { maxRedirects: 0 });
  expect(versionResponse.ok()).toBeTruthy();
  const version = await versionResponse.json();
  expect(version.environment).toBe("validation");
  expect(version.offlineCapabilities?.schemaReady).toBe(true);

  const suffix = crypto.randomUUID();
  const manager = await post(request, "/auth/register", { email: `dev-reopen-manager-${suffix}@example.test`, password, fullName: "Offline Test Manager", farmName: "Offline Test Farm" });
  const email = `dev-reopen-handler-${suffix}@example.test`;
  const handler = await post(request, "/handlers", { email, password, fullName: "Offline Test Handler" }, manager.token);
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const batch = await post(request, "/batches", { name: "Offline Test Batch", initialPopulation: 20, bloodline: "Fixture", startDate: date, hatchDate: date, farmEntryDate: date, handlerUserIds: [handler.userId ?? handler.id] }, manager.token);

  await page.addInitScript(() => localStorage.setItem("pp_language", "en"));
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator("#password").press("Enter");
  await page.waitForURL(/dashboard/);
  const path = `/batches/${batch.id}/data-entry?from=batch`;
  await page.goto(path);
  await page.getByRole("button", { name: /Measurements/ }).waitFor();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await page.getByRole("button", { name: /Measurements/ }).waitFor();

  try {
    await context.setOffline(true);
    await page.close();
    const reopened = await context.newPage();
    await reopened.goto(path, { waitUntil: "domcontentloaded" });
    await expect(reopened.getByRole("button", { name: /Measurements/ })).toBeVisible({ timeout: 15_000 });
    await reopened.getByRole("button", { name: /Measurements/ }).click();
    await expect(reopened.getByRole("dialog").getByLabel(/Temperature °C/)).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});
