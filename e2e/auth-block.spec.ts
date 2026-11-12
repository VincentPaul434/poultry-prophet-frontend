import { expect, test, type Page, type Request } from "@playwright/test";

const email = "manager@example.test";
const fullName = "Test Farm Manager";
const password = "test-password-123";

function authResponse() {
  const header = Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");

  return {
    token: `${header}.${payload}.test`,
    userId: 7,
    email,
    fullName,
    role: "MANAGER",
    farmId: 1,
  };
}

async function mockBackend(page: Page, baseURL: string) {
  const origin = new URL(baseURL).origin;

  // Block external requests and unexpected writes, even if an auth route changes.
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== origin || url.pathname.startsWith("/api/") || url.searchParams.has("password") || !["GET", "HEAD"].includes(request.method())) {
      return route.abort();
    }
    return route.continue();
  });

  // Dashboard requests after authentication must not reach the real backend.
  await page.route("**/api/backend/**", async (route) => {
    if (route.request().method() !== "GET") return route.abort();

    const path = new URL(route.request().url()).pathname.replace("/api/backend", "");
    const responses: Record<string, unknown> = {
      "/farm": { id: 1, name: "Fixture Farm", location: null, description: null },
      "/alerts": [],
      "/alerts/summary": { activeTotal: 0, critical: 0, warning: 0, info: 0 },
      "/batches": [],
      "/batches/dashboard": [],
      "/inventory/products": [],
      "/invites/pending": [],
      "/health": { status: "UP" },
      "/version": { application: "poultry-prophet", version: "e2e", commitSha: "e2e", buildTime: "2026-01-01T00:00:00Z", environment: "test", compatibleFrontendVersion: "0.1.0-validation" },
      "/offline/bootstrap": { userId: 7, farmId: 1, batches: [], dashboard: [], products: [], tasks: [], vaccinationPlans: {}, overviews: {}, events: {}, inputs: {} },
    };

    if (!(path in responses)) return route.fulfill({ status: 404, json: { message: "Unexpected backend request" } });
    return route.fulfill({ json: responses[path] });
  });
}

test.use({ serviceWorkers: "block" });

test.describe("Authentication forms", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    if (!baseURL) throw new Error("Playwright baseURL is required for the network guard");
    await mockBackend(page, baseURL);
  });

  test("password visibility can be toggled without losing the value", async ({ page }) => {
    await page.goto("/login", { waitUntil: "networkidle" });
    const input = page.getByLabel(/^password$/i);
    await input.fill(password);
    await page.getByRole("button", { name: "Show password" }).click();
    await expect(input).toHaveAttribute("type", "text");
    await expect(input).toHaveValue(password);
    await page.getByRole("button", { name: "Hide password" }).click();
    await expect(input).toHaveAttribute("type", "password");
  });

  test("signs in without Web Locks when IndexedDB is available", async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, "locks", { value: undefined }));
    await page.route("**/api/backend/auth/login", route => route.fulfill({ json: authResponse() }));
    await page.goto("/login", { waitUntil: "networkidle" });
    await page.getByLabel(/^(email|email address)$/i).fill(email);
    await page.getByLabel(/^password$/i).fill(password);
    await page.getByRole("button", { name: /^(mag-sign in|sign in|log in|login)$/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/?(?:[?#].*)?$/);
  });

  test("does not submit credentials when IndexedDB coordination is unavailable", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "locks", { value: undefined });
      Object.defineProperty(window, "indexedDB", { value: undefined });
    });
    let calls = 0;
    await page.route("**/api/backend/auth/login", route => { calls++; return route.fulfill({ json: authResponse() }); });
    await page.goto("/login", { waitUntil: "networkidle" });
    await page.getByLabel(/^(email|email address)$/i).fill(email);
    await page.getByLabel(/^password$/i).fill(password);
    await page.getByRole("button", { name: /^(mag-sign in|sign in|log in|login)$/i }).click();
    await expect(page.getByText("Unable to safely coordinate sign-in across tabs.")).toBeVisible();
    expect(calls).toBe(0);
  });

  test("shows a login error and allows a successful retry", async ({ page }) => {
    const requests: Request[] = [];
    const errorMessage = "The email or password is incorrect.";
    await page.route("**/api/backend/auth/login", async (route) => {
      requests.push(route.request());
      return requests.length === 1
        ? route.fulfill({ status: 401, json: { message: errorMessage } })
        : route.fulfill({ json: authResponse() });
    });

    // The forms are server-rendered; let their client scripts finish loading
    // before interacting, including on a cold development server.
    await page.goto("/login", { waitUntil: "networkidle" });
    await page.getByLabel(/^(email|email address)$/i).fill(email);
    await page.getByLabel(/^password$/i).fill("wrong-password-123");
    await page.getByRole("button", { name: /^(mag-sign in|sign in|log in|login)$/i }).click();

    await expect(page.getByText(errorMessage, { exact: true }).first()).toBeVisible();
    await expect(page).toHaveURL(/\/login\/?(?:[?#].*)?$/);
    expect(requests).toHaveLength(1);
    expect(requests[0].method()).toBe("POST");
    expect(requests[0].postDataJSON()).toEqual({ email, password: "wrong-password-123" });

    await page.getByLabel(/^password$/i).fill(password);
    await page.getByRole("button", { name: /^(mag-sign in|sign in|log in|login)$/i }).click();

    await expect(page).toHaveURL(/\/dashboard\/?(?:[?#].*)?$/);
    await expect(page.getByRole("heading", { name: "Batches", level: 1 })).toBeVisible();
    expect(requests).toHaveLength(2);
    expect(requests[1].method()).toBe("POST");
    expect(requests[1].postDataJSON()).toEqual({ email, password });
  });

  test("blocks mismatched passwords, then registers after they match", async ({ page }) => {
    const requests: Request[] = [];
    await page.route("**/api/backend/auth/register", async (route) => {
      requests.push(route.request());
      return route.fulfill({ json: authResponse() });
    });

    await page.goto("/register", { waitUntil: "networkidle" });
    await page.getByLabel(/^(buong pangalan|full name|name)$/i).fill(fullName);
    await page.getByLabel(/^(email|email address)$/i).fill(email);
    await page.getByLabel(/^password$/i).fill(password);
    const confirmation = page.getByLabel(/^(ulitin ang password|confirm password|repeat password)$/i);
    await confirmation.fill("different-password-123");
    await page.getByRole("button", { name: /^(gumawa ng account|create account|sign up|register)$/i }).click();

    await expect(page.getByText(/hindi magkapareho ang password|passwords? (do not|don't) match|passwords? must match/i).first()).toBeVisible();
    await expect(page).toHaveURL(/\/register\/?(?:[?#].*)?$/);
    expect(requests).toHaveLength(0);

    await confirmation.fill(password);
    await page.getByRole("button", { name: /^(gumawa ng account|create account|sign up|register)$/i }).click();

    await expect(page).toHaveURL(/\/dashboard\/?(?:[?#].*)?$/);
    await expect(page.getByRole("heading", { name: "Batches", level: 1 })).toBeVisible();
    expect(requests).toHaveLength(1);
    expect(requests[0].method()).toBe("POST");
    expect(requests[0].postDataJSON()).toEqual({ fullName, email, password });
  });
});
