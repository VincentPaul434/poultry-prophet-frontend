import { expect, test, type BrowserContext } from "@playwright/test";

const user = { userId: 7, email: "manager@example.test", fullName: "Farm Manager", role: "MANAGER", farmId: 1 };

function accessToken(expiresAt: number) {
  return `${Buffer.from('{"alg":"none"}').toString("base64url")}.${Buffer.from(JSON.stringify({ exp: Math.floor(expiresAt / 1000) })).toString("base64url")}.test`;
}

async function mockBackend(context: BrowserContext, onRefresh: (refreshToken: string) => Promise<object>) {
  await context.route("**/api/backend/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/backend", "");
    if (path === "/auth/refresh") {
      const body = route.request().postDataJSON() as { refreshToken: string };
      return route.fulfill({ json: await onRefresh(body.refreshToken) });
    }
    if (path === "/farm") return route.fulfill({ json: { id: 1, name: "Fixture Farm", location: "Test", description: null } });
    if (path === "/alerts") return route.fulfill({ json: [] });
    if (path === "/alerts/summary") return route.fulfill({ json: { activeTotal: 0, critical: 0, warning: 0, info: 0 } });
    if (path === "/version") return route.fulfill({ json: { application: "poultry-prophet", version: "e2e", commitSha: "e2e", buildTime: "2026-11-11T00:00:00Z", environment: "test", compatibleFrontendVersion: "0.1.0-validation" } });
    if (path === "/health") return route.fulfill({ json: { status: "UP" } });
    if (path === "/offline/bootstrap") return route.fulfill({ json: { userId: 7, farmId: 1, batches: [], dashboard: [], products: [], tasks: [], vaccinationPlans: {}, overviews: {}, events: {}, inputs: {} } });
    return route.fulfill({ json: {} });
  });
}

async function seedSession(context: BrowserContext, token: string, refreshToken = "first-refresh") {
  await context.addInitScript(({ token, refreshToken, user }) => {
    if (window.localStorage.getItem("pp_auth_e2e_seeded")) return;
    window.localStorage.setItem("pp_auth_session", JSON.stringify({ token, refreshToken, refreshTokenExpiresAt: new Date(Date.now() + 60 * 86_400_000).toISOString(), user }));
    window.localStorage.setItem("pp_auth_e2e_seeded", "1");
  }, { token, refreshToken, user });
}

test("opening another tab reuses an unexpired access token", async ({ page, context }) => {
  let refreshCalls = 0;
  await mockBackend(context, async () => { refreshCalls += 1; return {}; });
  await seedSession(context, accessToken(Date.now() + 60 * 60_000));

  const secondTab = await context.newPage();
  await Promise.all([page.goto("/settings"), secondTab.goto("/settings")]);
  await expect(page.getByRole("heading", { name: "Settings", exact: true, level: 1 })).toBeVisible();
  await expect(secondTab.getByRole("heading", { name: "Settings", exact: true, level: 1 })).toBeVisible();
  expect(refreshCalls).toBe(0);
});

test("two tabs rotate an expired token only once and share the result", async ({ page, context }) => {
  let refreshCalls = 0;
  const renewedToken = accessToken(Date.now() + 60 * 60_000);
  await mockBackend(context, async (refreshToken) => {
    refreshCalls += 1;
    await new Promise((resolve) => setTimeout(resolve, 200));
    if (refreshToken !== "first-refresh") throw new Error(`Unexpected refresh token: ${refreshToken}`);
    return { ...user, token: renewedToken, refreshToken: "second-refresh", refreshTokenExpiresAt: new Date(Date.now() + 60 * 86_400_000).toISOString() };
  });
  await seedSession(context, accessToken(Date.now() - 60_000));

  const secondTab = await context.newPage();
  await Promise.all([page.goto("/settings"), secondTab.goto("/settings")]);
  await expect(page.getByRole("heading", { name: "Settings", exact: true, level: 1 })).toBeVisible();
  await expect(secondTab.getByRole("heading", { name: "Settings", exact: true, level: 1 })).toBeVisible();
  expect(refreshCalls).toBe(1);
  const stored = await secondTab.evaluate(() => JSON.parse(window.localStorage.getItem("pp_auth_session") ?? "null") as { refreshToken?: string } | null);
  expect(stored?.refreshToken).toBe("second-refresh");
});

test("signing out in one tab clears the other tab", async ({ page, context }) => {
  await mockBackend(context, async () => ({}));
  await seedSession(context, accessToken(Date.now() + 60 * 60_000));
  const secondTab = await context.newPage();
  await Promise.all([page.goto("/settings"), secondTab.goto("/settings")]);
  await expect(secondTab.getByRole("heading", { name: "Settings", exact: true, level: 1 })).toBeVisible();

  await page.evaluate(() => window.localStorage.removeItem("pp_auth_session"));
  await expect(secondTab).toHaveURL(/\/login$/);
});
