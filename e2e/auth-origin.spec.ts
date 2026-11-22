import { expect, test } from "@playwright/test";

test("credential proxy accepts the browser's public origin and rejects a different origin", async ({ request, baseURL }) => {
  if (!baseURL) throw new Error("baseURL required");
  const origin = new URL(baseURL).origin;

  const accepted = await request.post("/api/backend/auth/refresh", {
    headers: {
      Origin: origin,
      "Sec-Fetch-Site": "same-origin",
    },
  });
  expect(accepted.status()).toBe(401);
  await expect(accepted.json()).resolves.toMatchObject({ message: "Sign in again." });

  const rejected = await request.post("/api/backend/auth/refresh", {
    headers: {
      Origin: "https://different-origin.example",
      "Sec-Fetch-Site": "cross-site",
    },
  });
  expect(rejected.status()).toBe(403);
  await expect(rejected.json()).resolves.toMatchObject({ message: "Invalid request origin." });
});
