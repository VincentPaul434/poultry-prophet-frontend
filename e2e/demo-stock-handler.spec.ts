import { expect, test, type Page } from "@playwright/test";

test.use({ serviceWorkers: "block" });

const handler = { userId: 2, email: "handler@example.test", fullName: "Fixture Handler", role: "HANDLER", farmId: 1 };
const batch = { id: 2, farmId: 1, name: "Test batch", currentPopulation: 20, initialPopulation: 20, populationStatus: "VALID", hatchDate: "2026-11-01", startDate: "2026-11-01", stageName: "Brooding", status: "ACTIVE", handlerUserIds: [2] };
const products = [
  { id: 1, brandName: "Demo stock", productType: "VACCINE", stockUnit: "vial", stockOnHand: 50, active: true, demoStockHistory: true },
  { id: 2, brandName: "Ordinary stock", productType: "VACCINE", stockUnit: "vial", stockOnHand: 5, active: true, demoStockHistory: false },
  { id: 3, brandName: "Old cached stock", productType: "VACCINE", stockUnit: "vial", stockOnHand: 3, active: true },
];
const emptyPage = { items: [], page: 0, size: 20, totalItems: 0, totalPages: 0, hasPrevious: false, hasNext: false };
const plan = products.map((product, index) => ({ id: index + 1, batchId: 2, programId: 1, farmProductId: product.id, vaccineName: `${product.brandName} vaccine`, hatchDate: "2026-11-01", ageDay: 1, stageName: "Brooding", dueDate: "2026-11-02", remindOn: "2026-11-01", status: "SCHEDULED", displayState: "OVERDUE", taskId: null, completedInputLogId: null, completedBy: null, completedAt: null, completionOperationId: null, skippedReason: null }));

async function mockHandler(page: Page) {
  await page.addInitScript((user) => localStorage.setItem("pp_auth_session", JSON.stringify({ sessionId: "handler-demo-stock", user })), handler);
  await page.route("**/api/backend/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/backend", "");
    if (path === "/auth/refresh") return route.fulfill({ json: { ...handler, token: "fixture-token" } });
    if (path === "/farm") return route.fulfill({ json: { id: 1, name: "Fixture Farm" } });
    if (path === "/version") return route.fulfill({ json: { application: "poultry-prophet", version: "e2e", commitSha: "e2e", buildTime: "2026-11-17T00:00:00Z", environment: "test", compatibleFrontendVersion: "0.1.0-validation" } });
    if (path === "/health") return route.fulfill({ json: { status: "UP" } });
    if (path === "/alerts/summary") return route.fulfill({ json: { activeTotal: 0, critical: 0, warning: 0, info: 0 } });
    if (path === "/inventory/products") return route.fulfill({ json: products });
    if (path === "/batches") return route.fulfill({ json: [batch] });
    if (path === "/batches/2") return route.fulfill({ json: batch });
    if (path === "/batches/2/overview") return route.fulfill({ json: { batch, latestIndicator: null, recentRecords: [], activeAlerts: [] } });
    if (path === "/batches/2/selection-review/preview") return route.fulfill({ status: 503, json: { message: "Not needed for this test" } });
    if (path === "/batches/2/vaccination-plan") return route.fulfill({ json: plan });
    if (path === "/inputs/page" || path.endsWith("/events/page")) return route.fulfill({ json: emptyPage });
    if (path === "/offline/bootstrap") return route.fulfill({ json: { userId: 2, farmId: 1, role: "HANDLER", batches: [batch], dashboard: [], products: [], tasks: [], vaccinationPlans: {}, overviews: {}, events: {}, inputs: {} } });
    if (path === "/tasks/handler-queue/summary") return route.fulfill({ json: { now: 0, upcoming: 0, overdue: 0, completed: 0 } });
    if (path === "/tasks/handler-queue") return route.fulfill({ json: emptyPage });
    if (path === "/alerts" || path === "/inputs" || path === "/invites/pending" || path.endsWith("/selection-reviews") || path.endsWith("/selection-sessions") || path.endsWith("/events") || path.endsWith("/records")) return route.fulfill({ json: [] });
    return route.fulfill({ json: {} });
  });
}

test("handler sees demo and unknown provenance for selected products", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile-chromium-"), "Mobile handler flow.");
  await mockHandler(page);
  await page.goto("/batches/2/data-entry?from=batch");
  await page.getByRole("button", { name: "Feed or medicine used" }).click();
  const dialog = page.getByRole("dialog");
  const select = dialog.getByLabel("Product from farm stock");
  await select.selectOption("1");
  await expect(dialog.getByText("Demo stock in history. Verify the physical quantity and price.")).toBeVisible();
  await select.selectOption("2");
  await expect(dialog.getByText(/Demo stock in history|Stock history unavailable/)).toHaveCount(0);
  await select.selectOption("3");
  await expect(dialog.getByText("Stock history unavailable. Verify the physical quantity before use.")).toBeVisible();
});

test("vaccine confirmation warns only when stock history warrants it", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile-chromium-"), "Mobile handler flow.");
  await mockHandler(page);
  await page.goto("/batches/2");
  await page.getByRole("button", { name: "Record Demo stock vaccine" }).click();
  await expect(page.getByRole("dialog").getByText("Demo stock in history. Verify the physical quantity and price.")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Record Ordinary stock vaccine" }).click();
  await expect(page.getByRole("dialog").getByText(/Demo stock in history|Stock history unavailable/)).toHaveCount(0);
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Record Old cached stock vaccine" }).click();
  await expect(page.getByRole("dialog").getByText("Stock history unavailable. Verify the physical quantity before use.")).toBeVisible();
});
