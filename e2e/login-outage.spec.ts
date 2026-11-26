import { expect, test } from "@playwright/test";

for (const [language, status, message] of [
  ["en", 504, "The server may be starting or unavailable. Please try again shortly."],
  ["taglish", 503, "Maaaring nagsisimula pa ang server o hindi ito maabot. Subukan muli pagkalipas ng ilang sandali."],
] as const) {
  test(`sign-in explains an unavailable backend in ${language}`, async ({ page }) => {
    await page.addInitScript((value) => localStorage.setItem("pp_language", value), language);
    let attempts = 0;
    await page.route("**/api/backend/auth/login", async (route) => {
      attempts += 1;
      await route.fulfill({ status, json: { status, message: "synthetic upstream failure" } });
    });
    await page.goto("/login");
    await page.locator("#email").fill("test@example.test");
    await page.locator("#password").fill("test-only-password");
    await page.locator("#password").press("Enter");
    await expect(page.getByText(message)).toBeVisible();
    await expect(page.locator("#email")).toHaveValue("test@example.test");
    expect(attempts).toBe(1);
  });
}
