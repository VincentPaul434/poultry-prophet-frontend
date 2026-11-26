import { expect, test } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("real service worker restores a visited page offline and falls back for an unvisited page", async ({ context, page }) => {
  const worker = readFileSync(join(process.cwd(), "public/sw.js"));
  const server = createServer((request, response) => {
    const path = new URL(request.url ?? "/", "http://localhost").pathname;
    if (path === "/sw.js") { response.writeHead(200, { "Content-Type": "text/javascript" }); response.end(worker); return; }
    if (path === "/icon.svg") { response.writeHead(200, { "Content-Type": "image/svg+xml" }); response.end('<svg xmlns="http://www.w3.org/2000/svg"/>'); return; }
    response.writeHead(200, { "Content-Type": "text/html" });
    response.end(path === "/offline" ? "<h1>Offline fallback fixture</h1>" : `<h1>Visited fixture ${path}</h1>`);
  });
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No local fixture port");
    const origin = `http://127.0.0.1:${address.port}`;
    await page.goto(`${origin}/start`);
    await page.evaluate(async () => { await navigator.serviceWorker.register('/sw.js?version=qa-browser'); await navigator.serviceWorker.ready; });
    await page.reload();
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
    await page.goto(`${origin}/batches/1`);
    await expect(page.getByRole("heading", { name: "Visited fixture /batches/1" })).toBeVisible();
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Visited fixture /batches/1" })).toBeVisible();
    await page.goto(`${origin}/batches/not-cached`);
    await expect(page.getByRole("heading", { name: "Offline fallback fixture" })).toBeVisible();
  } finally {
    await context.setOffline(false);
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
