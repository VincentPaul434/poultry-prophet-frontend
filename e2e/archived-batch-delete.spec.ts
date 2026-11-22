import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block", viewport: { width: 320, height: 721 } });
test.setTimeout(60_000);

test("archived batches with history require confirmation and deletion updates the list", async ({ page, baseURL }) => {
  if (!baseURL || new URL(baseURL).hostname !== "localhost") throw new Error("Fixture requires localhost");
  const origin = new URL(baseURL).origin;
  const user = { userId: 8, farmId: 1, role: "MANAGER", email: "fixture@example.test", fullName: "Fixture Manager" };
  const archived = [1, 2].map((id) => ({ id, farmId: 1, name: id === 1 ? "Empty batch" : "Recorded batch", status: "ARCHIVED", stageName: "Brooding", initialPopulation: 30, currentPopulation: 30, startDate: "2026-11-01", hatchDate: "2026-11-01", bloodline: "Fixture", handlerUserIds: [], archivedAt: "2026-11-10T00:00:00Z" }));
  const deleted = new Set<number>();
  let deleteRequests = 0;
  await page.addInitScript((profile) => {
    localStorage.setItem("pp_auth_session", JSON.stringify({ sessionId: "archive-delete-fixture", user: profile }));
    localStorage.setItem("pp_language", "en");
  }, user);
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== origin) return route.abort("blockedbyclient");
    if (!url.pathname.startsWith("/api/backend/")) return ["GET", "HEAD"].includes(request.method()) ? route.continue() : route.abort("blockedbyclient");
    const path = url.pathname.slice("/api/backend".length);
    if (path === "/auth/refresh" && request.method() === "POST") return route.fulfill({ json: { ...user, token: "fixture-token" } });
    if (["/batches/1", "/batches/2"].includes(path) && request.method() === "DELETE") {
      deleteRequests++;
      const id = Number(path.split("/").pop());
      expect(request.postDataJSON()).toMatchObject({ confirmationName: id === 1 ? "Empty batch" : "Recorded batch" });
      deleted.add(id);
      return route.fulfill({ status: 204 });
    }
    if (request.method() !== "GET") return route.abort("blockedbyclient");
    if (path === "/batches" && url.searchParams.get("archived") === "true") return route.fulfill({ json: archived.filter((batch) => !deleted.has(batch.id)) });
    if (path === "/batches/1/retirement-impact" || path === "/batches/2/retirement-impact") {
      const canDelete = path.includes("/1/");
      return route.fulfill({ json: { batchId: canDelete ? 1 : 2, batchName: canDelete ? "Empty batch" : "Recorded batch", status: "ARCHIVED", canArchive: true, canDelete: true, openTaskCount: 0, activeAlertCount: 0, recordCounts: { events: canDelete ? 0 : 2 }, deleteBlockers: [] } });
    }
    if (path === "/batches/dashboard" || ["/alerts", "/batches", "/incubation-cycles/attention", "/invites/pending"].includes(path)) return route.fulfill({ json: [] });
    if (path === "/farm") return route.fulfill({ json: { id: 1, name: "Fixture farm" } });
    if (path === "/tasks/summary") return route.fulfill({ json: { open: 0, late: 0, today: 0, upcoming: 0, noDueDate: 0, completed: 0, cancelled: 0 } });
    if (path === "/alerts/summary") return route.fulfill({ json: { activeTotal: 0, critical: 0, warning: 0, info: 0 } });
    if (path === "/version") return route.fulfill({ json: { application: "poultry-prophet", version: "test", environment: "test" } });
    if (path === "/health") return route.fulfill({ json: { status: "UP" } });
    return route.fulfill({ status: 404, json: { message: "Unexpected fixture request" } });
  });

  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Archived batches" })).toBeVisible({ timeout: 45_000 });
  await expect(page.getByRole("button", { name: "Delete Recorded batch" })).toBeVisible();
  await page.getByRole("button", { name: "Delete Recorded batch" }).click();
  const protectedDialog = page.getByRole("dialog");
  await expect(protectedDialog.getByLabel("Linked records to delete")).toContainText("Event records");
  await expect(protectedDialog.getByLabel("Linked records to delete")).toContainText("2");
  await expect(protectedDialog.getByRole("button", { name: "Delete permanently" })).toBeDisabled();
  await protectedDialog.getByLabel(/Type.*Recorded batch/).fill("Recorded batch");
  await expect(protectedDialog.getByRole("button", { name: "Delete permanently" })).toBeEnabled();
  await protectedDialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(deleteRequests).toBe(0);
  await page.getByRole("button", { name: "Delete Recorded batch" }).click();
  await protectedDialog.getByLabel(/Type.*Recorded batch/).fill("Recorded batch");
  await protectedDialog.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page.getByRole("link", { name: "Recorded batch" })).toHaveCount(0);
  await expect.poll(() => deleteRequests).toBe(1);

  await page.getByRole("button", { name: "Delete Empty batch" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Delete permanently" })).toBeDisabled();
  await dialog.getByLabel(/Type.*Empty batch/).fill("Wrong name");
  await expect(dialog.getByRole("button", { name: "Delete permanently" })).toBeDisabled();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect.poll(() => deleteRequests).toBe(1);
  await page.getByRole("button", { name: "Delete Empty batch" }).click();
  await dialog.getByLabel(/Type.*Empty batch/).fill("Empty batch");
  await dialog.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page.getByRole("link", { name: "Empty batch" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Recorded batch" })).toHaveCount(0);
  await expect.poll(() => deleteRequests).toBe(2);
});
