import { expect, test, type Page } from "@playwright/test";

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));

  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
}

test.describe("Mobile responsive smoke tests", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(
      !testInfo.project.name.startsWith("mobile-chromium-"),
      "This suite is reserved for the configured mobile Chromium projects.",
    );
  });

  test("landing page fits the mobile viewport", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: /Malinaw na tala, mula kulungan hanggang report/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("authentication pages fit the mobile viewport", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /Balikan ang iyong farm/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto("/register");
    await expect(page.getByRole("heading", { name: /Simulan ang farm record/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
