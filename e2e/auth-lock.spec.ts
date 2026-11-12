import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

async function loadLock(page: Page) {
  const source = readFileSync(join(process.cwd(), "lib/auth-lock.ts"), "utf8");
  const script = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  await page.goto("http://localhost:3000/auth-lock-test");
  await page.addScriptTag({ content: `window.authLock = {}; (function(exports){${script}})(window.authLock);` });
}

test("an expired in-flight lease is never stolen and cannot be cleared by its old owner", async ({ context }) => {
  await context.route("http://localhost:3000/auth-lock-test", route => route.fulfill({ contentType: "text/html", body: "<html></html>" }));
  const first = await context.newPage();
  const second = await context.newPage();
  await Promise.all([loadLock(first), loadLock(second)]);
  await first.evaluate(() => {
    const w = window as unknown as { authLock: { withIndexedDbAuthLock: (fn: () => Promise<void>) => Promise<void> }; release: () => void; started: boolean; outcome: string };
    w.outcome = "pending";
    void w.authLock.withIndexedDbAuthLock(async () => {
      w.started = true;
      await new Promise<void>(resolve => { w.release = resolve; });
    }).then(() => { w.outcome = "released"; }, () => { w.outcome = "failed-closed"; });
  });
  await expect.poll(() => first.evaluate(() => (window as unknown as { started: boolean }).started)).toBe(true);
  await second.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("poultry-prophet-auth-lock", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("leases", "readwrite");
      const store = tx.objectStore("leases");
      const request = store.get("credentials");
      request.onsuccess = () => store.put({ ...request.result, expiresAt: 0 }, "credentials");
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  });
  const next = await second.evaluate(async () => {
    const w = window as unknown as { authLock: { withIndexedDbAuthLock: (fn: () => Promise<void>) => Promise<void> } };
    let ran = false;
    try { await w.authLock.withIndexedDbAuthLock(async () => { ran = true; }); } catch { return { ran, failed: true }; }
    return { ran, failed: false };
  });
  expect(next).toEqual({ ran: false, failed: true });
  await first.evaluate(() => (window as unknown as { release: () => void }).release());
  await expect.poll(() => first.evaluate(() => (window as unknown as { outcome: string }).outcome)).toBe("failed-closed");
  const retry = await second.evaluate(async () => {
    const w = window as unknown as { authLock: { withIndexedDbAuthLock: (fn: () => Promise<void>) => Promise<void> } };
    try { await w.authLock.withIndexedDbAuthLock(async () => {}); return false; } catch { return true; }
  });
  expect(retry).toBe(true);
});

test("an old fence cannot clear a replacement lease", async ({ context }) => {
  await context.route("http://localhost:3000/auth-lock-test", route => route.fulfill({ contentType: "text/html", body: "<html></html>" }));
  const page = await context.newPage();
  await loadLock(page);
  await page.evaluate(() => {
    const w = window as unknown as { authLock: { withIndexedDbAuthLock: (fn: () => Promise<void>) => Promise<void> }; release: () => void; started: boolean; outcome: string };
    void w.authLock.withIndexedDbAuthLock(async () => { w.started = true; await new Promise<void>(resolve => { w.release = resolve; }); })
      .then(() => { w.outcome = "released"; }, () => { w.outcome = "failed-closed"; });
  });
  await expect.poll(() => page.evaluate(() => (window as unknown as { started: boolean }).started)).toBe(true);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("poultry-prophet-auth-lock", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("leases", "readwrite");
      const store = tx.objectStore("leases");
      const request = store.get("credentials");
      request.onsuccess = () => store.put({ owner: "new-owner", fence: request.result.fence + 1, expiresAt: Date.now() + 15_000 }, "credentials");
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
    });
    db.close();
    (window as unknown as { release: () => void }).release();
  });
  await expect.poll(() => page.evaluate(() => (window as unknown as { outcome: string }).outcome)).toBe("failed-closed");
  const owner = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("poultry-prophet-auth-lock", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const value = await new Promise<{ owner: string }>((resolve, reject) => {
      const request = db.transaction("leases").objectStore("leases").get("credentials");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return value.owner;
  });
  expect(owner).toBe("new-owner");
});
