import { expect, test, type Page } from "@playwright/test";

test.use({ serviceWorkers: "block" });

const manager = { userId: 1, email: "manager@example.test", fullName: "Fixture Manager", role: "MANAGER", farmId: 1 };

async function prepareDashboard(page: Page, supportsMetadata: boolean) {
  const submitted: Record<string, unknown>[] = [];
  await page.addInitScript((profile) => {
    localStorage.setItem("pp_auth_session", JSON.stringify({ sessionId: "batch-registration-test", user: profile }));
    localStorage.setItem("pp_language", "en");
  }, manager);
  await page.route("**/api/backend/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/backend", "");
    if (path === "/auth/refresh") return route.fulfill({ json: { ...manager, token: "fixture-token" } });
    if (path === "/batches/capabilities") return supportsMetadata
      ? route.fulfill({ json: { batchMetadata: true } })
      : route.fulfill({ status: 404, json: { message: "Not found" } });
    if (path === "/batches" && route.request().method() === "POST") {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      submitted.push(body);
      return route.fulfill({ status: 201, json: { id: 42, farmId: 1, ...body } });
    }
    if (path === "/farm") return route.fulfill({ json: { id: 1, name: "Fixture Farm", location: null, description: null } });
    if (path === "/alerts" || path === "/invites/pending" || path === "/batches/dashboard" || path === "/batches") return route.fulfill({ json: [] });
    if (path === "/alerts/summary") return route.fulfill({ json: { activeTotal: 0, critical: 0, warning: 0, info: 0 } });
    if (path === "/health") return route.fulfill({ json: { status: "UP" } });
    if (path === "/version") return route.fulfill({ json: { application: "poultry-prophet", version: "test", commitSha: "test", buildTime: "2026-11-18T00:00:00Z", environment: "test", compatibleFrontendVersion: "0.1.0-validation" } });
    if (path === "/offline/bootstrap") return route.fulfill({ json: { userId: 1, farmId: 1, role: "MANAGER", batches: [], dashboard: [], products: [], tasks: [], vaccinationPlans: {}, overviews: {}, events: {}, inputs: {} } });
    return route.fulfill({ json: {} });
  });
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "New batch", exact: true }).first().click();
  const dialog = page.getByRole("dialog", { name: "Create new batch" });
  await dialog.getByLabel("Batch name").fill("Test batch");
  await dialog.getByLabel("Number of birds").fill("12");
  return { dialog, submitted };
}

test("requires a real bloodline and permits an empty derby date", async ({ page }) => {
  const { dialog, submitted } = await prepareDashboard(page, true);
  const bloodline = dialog.getByLabel(/Bloodline/);
  await expect(bloodline).toHaveAttribute("required", "");
  await bloodline.fill("   ");
  await dialog.getByRole("button", { name: "New batch" }).click();
  await expect(page.getByText("Bloodline is required.")).toBeVisible();
  expect(submitted).toHaveLength(0);

  await bloodline.fill("  Sweater  ");
  await dialog.getByRole("button", { name: "New batch" }).click();
  await expect(dialog).toBeHidden();
  expect(submitted).toHaveLength(1);
  expect(submitted[0]).toMatchObject({ bloodline: "Sweater", derbyDate: null });
});

test("sends a derby date only when the backend can save it", async ({ page }) => {
  const { dialog, submitted } = await prepareDashboard(page, true);
  await dialog.getByLabel(/Bloodline/).fill("Sweater");
  await dialog.getByLabel(/Derby date/).fill("2027-03-15");
  await dialog.getByRole("button", { name: "New batch" }).click();
  await expect(dialog).toBeHidden();
  expect(submitted[0]).toMatchObject({ bloodline: "Sweater", derbyDate: "2027-03-15" });
});

test("does not silently discard a date on an older backend", async ({ page }) => {
  const { dialog, submitted } = await prepareDashboard(page, false);
  await dialog.getByLabel(/Bloodline/).fill("Sweater");
  await dialog.getByLabel(/Derby date/).fill("2027-03-15");
  await dialog.getByRole("button", { name: "New batch" }).click();
  await expect(page.getByText(/backend needs an update/i)).toBeVisible();
  await expect(dialog).toBeVisible();
  expect(submitted).toHaveLength(0);
});

test("lets a user add and clear the optional date on an existing batch", async ({ page }) => {
  let derbyDate: string | null = null;
  const batch = {
    id: 42, farmId: 1, name: "Test batch", initialPopulation: 12, currentPopulation: 12,
    populationStatus: "VALID", populationWarning: null, startDate: "2026-11-01",
    hatchDate: "2026-11-01", farmEntryDate: "2026-11-01", bloodline: "Sweater", source: null,
    stageId: 1, stageName: "brooding", stageAuto: true, status: "ACTIVE", handlerUserIds: [],
    createdAt: "2026-11-01T00:00:00Z", archivedAt: null, archivedByUserId: null,
    archiveReason: null, preArchiveStatus: null, hatchDateConfirmedAt: null, hatchDateConfirmedByUserId: null,
  };
  await page.addInitScript((profile) => {
    localStorage.setItem("pp_auth_session", JSON.stringify({ sessionId: "batch-edit-test", user: profile }));
    localStorage.setItem("pp_language", "en");
  }, manager);
  await page.route("**/api/backend/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/backend", "");
    if (path === "/auth/refresh") return route.fulfill({ json: { ...manager, token: "fixture-token" } });
    if (path === "/batches/capabilities") return route.fulfill({ json: { batchMetadata: true } });
    if (path === "/batches/42/derby-date" && route.request().method() === "PATCH") {
      derbyDate = (route.request().postDataJSON() as { derbyDate: string | null }).derbyDate;
      return route.fulfill({ json: { ...batch, derbyDate } });
    }
    if (path === "/batches/42/overview") return route.fulfill({ json: { batch: { ...batch, derbyDate }, latestIndicator: null, recentRecords: [], activeAlerts: [] } });
    if (path === "/batches/42/vaccination-plan" || path === "/batches/42/selection-sessions" || path === "/alerts" || path === "/invites/pending") return route.fulfill({ json: [] });
    if (path === "/farm") return route.fulfill({ json: { id: 1, name: "Fixture Farm" } });
    if (path === "/health") return route.fulfill({ json: { status: "UP" } });
    return route.fulfill({ status: 404, json: { message: "Not found" } });
  });

  await page.goto("/batches/42");
  await page.getByRole("button", { name: "Edit derby date" }).click();
  let dialog = page.getByRole("dialog", { name: "Edit derby date" });
  await dialog.getByLabel(/Derby date/).fill("2027-03-15");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Mar 15, 2027")).toBeVisible();

  await page.getByRole("button", { name: "Edit derby date" }).click();
  dialog = page.getByRole("dialog", { name: "Edit derby date" });
  await dialog.getByLabel(/Derby date/).fill("");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  expect(derbyDate).toBeNull();
});
