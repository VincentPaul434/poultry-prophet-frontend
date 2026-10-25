import { test, expect } from "@playwright/test";

test.describe("Public authentication flow", () => {
  test("login password visibility and home navigation work", async ({ page }) => {
    await page.goto("/login");

    const password = page.getByLabel("Password");
    await expect(password).toHaveAttribute("type", "password");

    await password.fill("secret123");
    await page.getByRole("button", { name: "Show password" }).click();
    await expect(password).toHaveAttribute("type", "text");
    await expect(password).toHaveValue("secret123");

    await page.getByRole("button", { name: "Hide password" }).click();
    await expect(password).toHaveAttribute("type", "password");

    await page.getByRole("link", { name: "Go to Poultry Prophet home" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("registration requires matching passwords before calling the API", async ({ page }) => {
    let registerCalled = false;
    await page.route("**/api/backend/auth/register", async (route) => {
      registerCalled = true;
      await route.fulfill({ status: 500, json: { message: "The registration API should not be called." } });
    });

    await page.goto("/register");
    await page.getByLabel("Full name").fill("Test Manager");
    await page.getByLabel("Email address").fill("test-manager@example.com");
    await page.getByLabel("Password", { exact: true }).fill("secret123");
    await page.getByLabel("Confirm password").fill("different123");
    await expect(page.getByText("Passwords do not match.")).toBeVisible();

    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Passwords do not match.")).toBeVisible();
    expect(registerCalled).toBe(false);
  });

  test("registration logo and back link return to the landing page", async ({ page }) => {
    await page.goto("/register");
    await page.getByRole("link", { name: "Go to Poultry Prophet home" }).click();
    await expect(page).toHaveURL(/\/$/);

    await page.goto("/register");
    await page.getByRole("link", { name: "Back to home" }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});
