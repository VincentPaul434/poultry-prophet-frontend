import { test, expect } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import ts from "typescript";

// Real worker lifecycle on an isolated origin. No farm API or user browser storage.
let server: Server;
let origin: string;
let deployment = "old";
const worker = readFileSync("public/sw.js", "utf8");
const databaseScript = ts.transpileModule(readFileSync("lib/offline-db.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

test.beforeAll(async () => {
  server = createServer((request, response) => {
    const path = new URL(request.url!, "http://localhost").pathname;
    response.setHeader("Cache-Control", "no-store");
    if (path === "/sw.js") {
      response.setHeader("Content-Type", "application/javascript");
      response.end(worker);
    } else if (path.startsWith("/_next/static/")) {
      response.setHeader("Content-Type", "application/javascript");
      response.end(`window.fixtureBuild = ${JSON.stringify(path.includes("abcdef") ? "old" : "new")};`);
    } else if (path === "/icon.svg") {
      response.setHeader("Content-Type", "image/svg+xml");
      response.end('<svg xmlns="http://www.w3.org/2000/svg"/>');
    } else {
      response.setHeader("Content-Type", "text/html");
      const hash = deployment === "old" ? "abcdef123456" : "fedcba654321";
      response.end(`<html><body><h1>${deployment} shell</h1><script src="/_next/static/chunks/fixture-${hash}.js"></script></body></html>`);
    }
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Fixture origin missing");
  origin = `http://127.0.0.1:${address.port}`;
});
test.afterAll(async () => { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); });

test("a waiting deployment preserves an old offline tab and its pending command through handoff", async ({ page, context }) => {
  await page.goto(`${origin}/dashboard`);
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("/sw.js?version=old", { updateViaCache: "none" });
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL)).toContain("version=old");
  await page.addScriptTag({ content: `window.offlineDb={};(function(exports){${databaseScript}})(window.offlineDb);` });
  const queued = await page.evaluate(async () => {
    const db = (window as unknown as { offlineDb: { putOutboxOperation: (value: object) => Promise<unknown> } }).offlineDb;
    return db.putOutboxOperation({ operationId: "f05e6719-a845-426f-9af5-4df4410a3001", schemaVersion: 1,
      entityType: "FARM_INPUT", userId: 91, farmId: 92, batchId: 93,
      payload: { operationId: "f05e6719-a845-426f-9af5-4df4410a3001", quantity: 1, notes: "retain original intent" },
      occurredAt: "2026-11-22T00:00:00Z", queuedAt: "2026-11-22T00:01:00Z" });
  });
  deployment = "new";
  await page.evaluate(async () => { await navigator.serviceWorker.register("/sw.js?version=new", { updateViaCache: "none" }); });
  await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.waiting?.scriptURL), { timeout: 10_000 }).toContain("version=new");
  expect(await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL)).toContain("version=old");
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading")).toHaveText("old shell");
  expect(await page.evaluate(() => (window as unknown as { fixtureBuild: string }).fixtureBuild)).toBe("old");
  await page.close();
  await context.setOffline(false);
  const replacement = await context.newPage();
  await replacement.goto(`${origin}/dashboard`);
  await expect.poll(() => replacement.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.active?.scriptURL)).toContain("version=new");
  await replacement.reload();
  await expect(replacement.getByRole("heading")).toHaveText("new shell");
  expect(await replacement.evaluate(() => (window as unknown as { fixtureBuild: string }).fixtureBuild)).toBe("new");
  await replacement.addScriptTag({ content: `window.offlineDb={};(function(exports){${databaseScript}})(window.offlineDb);` });
  const remaining = await replacement.evaluate(async () => (window as unknown as { offlineDb: { listOutbox: (user: number, farm: number) => Promise<unknown[]> } }).offlineDb.listOutbox(91, 92));
  expect(remaining).toEqual([queued]);
  expect(await replacement.evaluate(() => caches.keys())).toContain("poultry-prophet-shell-old");
});
