import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

async function loadDatabase(page: import("@playwright/test").Page) {
  const source = readFileSync(join(process.cwd(), "lib/offline-db.ts"), "utf8");
  const script = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  await page.goto("http://offline.test/");
  await page.addScriptTag({ content: `window.offlineDb = {}; (function(exports){${script}})(window.offlineDb);` });
}

// Exercise the real IndexedDB implementation in two browser tabs, without an API server.
test("claims batch heads atomically and fences expired owners", async ({ context }) => {
  await context.route("http://offline.test/**", (route) => route.fulfill({ contentType: "text/html", body: "<html></html>" }));
  const first = await context.newPage();
  const second = await context.newPage();
  for (const page of [first, second]) {
    await loadDatabase(page);
  }
  const result = await first.evaluate(async () => {
    const db = (window as unknown as { offlineDb: Record<string, (...args: never[]) => Promise<unknown>> }).offlineDb;
    const put = db.putOutboxOperation as (value: object) => Promise<unknown>;
    const claim = db.claimOutboxOperations as (user: number, farm: number, owner: string, now: number, lease: number) => Promise<Array<{ operationId: string }>>;
    const update = db.updateClaimedOutboxOperation as (id: string, owner: string, patch: object) => Promise<boolean>;
    const list = db.listOutbox as (user: number, farm: number) => Promise<Array<{ operationId: string; status: string }>>;
    const base = { schemaVersion: 1, entityType: "BATCH_EVENT", userId: 1, farmId: 2, payload: {}, occurredAt: "2026-01-01", queuedAt: "2026-01-01" };
    await put({ ...base, operationId: "a", batchId: 1 });
    await put({ ...base, operationId: "b", batchId: 1 });
    await put({ ...base, operationId: "c", batchId: 2 });
    const initial = await claim(1, 2, "first", 1000, 1000);
    const concurrent = await claim(1, 2, "second", 1500, 1000);
    const recovered = await claim(1, 2, "second", 2001, 1000);
    const staleUpdate = await update("a", "first", { status: "REJECTED" });
    return { initial, concurrent, recovered, staleUpdate, items: await list(1, 2) };
  });
  expect(result.initial.map((item) => item.operationId)).toEqual(["a", "c"]);
  expect(result.concurrent).toEqual([]);
  expect(result.recovered.map((item) => item.operationId)).toEqual(["a", "c"]);
  expect(result.staleUpdate).toBe(false);
  expect(result.items.find((item) => item.operationId === "a")?.status).toBe("SYNCING");
});

test("competing tabs claim each record only once", async ({ context }) => {
  await context.route("http://offline.test/**", (route) => route.fulfill({ contentType: "text/html", body: "<html></html>" }));
  const first = await context.newPage();
  const second = await context.newPage();
  await Promise.all([loadDatabase(first), loadDatabase(second)]);
  await first.evaluate(async () => {
    const db = (window as unknown as { offlineDb: { putOutboxOperation: (value: object) => Promise<unknown> } }).offlineDb;
    await db.putOutboxOperation({ operationId: "one", schemaVersion: 1, entityType: "BATCH_EVENT", userId: 1, farmId: 2, batchId: 1, payload: {}, occurredAt: "2026-01-01", queuedAt: "2026-01-01" });
  });
  const claim = (owner: string) => {
    const db = (window as unknown as { offlineDb: { claimOutboxOperations: (user: number, farm: number, owner: string, now: number, lease: number) => Promise<unknown[]> } }).offlineDb;
    return db.claimOutboxOperations(1, 2, owner, Date.now(), 60_000);
  };
  const results = await Promise.all([first.evaluate(claim, "first"), second.evaluate(claim, "second")]);
  expect(results.map((items) => items.length).sort()).toEqual([0, 1]);
});

test("blocked heads, retry deadlines, legacy claims and reauthentication respect scope", async ({ page, context }) => {
  await context.route("http://offline.test/**", (route) => route.fulfill({ contentType: "text/html", body: "<html></html>" }));
  await loadDatabase(page);
  const result = await page.evaluate(async () => {
    const db = (window as unknown as { offlineDb: {
      putOutboxOperation: (value: object) => Promise<unknown>;
      updateOutboxOperation: (id: string, patch: object) => Promise<void>;
      claimOutboxOperations: (user: number, farm: number, owner: string, now: number, lease: number) => Promise<Array<{ operationId: string }>>;
      retryOutboxIssues: (user: number, farm: number) => Promise<number>;
      listOutbox: (user: number, farm: number) => Promise<Array<{ operationId: string; status: string }>>;
    } }).offlineDb;
    const base = { schemaVersion: 1, entityType: "BATCH_EVENT", userId: 1, farmId: 2, payload: {}, occurredAt: "2026-01-01", queuedAt: "2026-01-01" };
    for (const [operationId, batchId] of [["blocked", 1], ["later", 1], ["retry", 2], ["legacy", 3], ["auth", 4]] as const) {
      await db.putOutboxOperation({ ...base, operationId, batchId });
    }
    await db.putOutboxOperation({ ...base, userId: 3, operationId: "other", batchId: 4 });
    await db.updateOutboxOperation("blocked", { status: "CONFLICT" });
    await db.updateOutboxOperation("retry", { status: "RETRY_WAIT", nextAttemptAt: new Date(5000).toISOString() });
    await db.updateOutboxOperation("legacy", { status: "SYNCING" });
    await db.updateOutboxOperation("auth", { status: "AUTH_REQUIRED" });
    await db.updateOutboxOperation("other", { status: "AUTH_REQUIRED" });
    const before = await db.claimOutboxOperations(1, 2, "owner", 4000, 1000);
    const recovered = await db.retryOutboxIssues(1, 2);
    const after = await db.claimOutboxOperations(1, 2, "owner2", 5000, 1000);
    return { before, recovered, after, other: await db.listOutbox(3, 2) };
  });
  expect(result.before.map((item) => item.operationId)).toEqual(["legacy"]);
  expect(result.recovered).toBe(1);
  expect(result.after.map((item) => item.operationId)).toEqual(["retry", "legacy", "auth"]);
  expect(result.other[0].status).toBe("AUTH_REQUIRED");
});

test("queued measurements cannot replace an earlier payload and remain scoped and ordered", async ({ page, context }) => {
  await context.route("http://offline.test/**", (route) => route.fulfill({ contentType: "text/html", body: "<html></html>" }));
  await loadDatabase(page);
  const result = await page.evaluate(async () => {
    const db = (window as unknown as { offlineDb: {
      putOutboxOperation: (value: object) => Promise<unknown>;
      listOutbox: (user: number, farm: number) => Promise<Array<{ operationId: string; payload: { temperatureC: number } }>>;
      claimOutboxOperations: (user: number, farm: number, owner: string, now: number, lease: number) => Promise<Array<{ operationId: string }>>;
    } }).offlineDb;
    const base = { schemaVersion: 1, entityType: "DAILY_RECORD", userId: 1, farmId: 2, batchId: 7, occurredAt: "2026-01-01", queuedAt: "2026-01-01" };
    await db.putOutboxOperation({ ...base, operationId: "first", payload: { temperatureC: 10 } });
    let rejected = false;
    try { await db.putOutboxOperation({ ...base, operationId: "first", payload: { temperatureC: 20 } }); } catch { rejected = true; }
    await db.putOutboxOperation({ ...base, operationId: "second", payload: { temperatureC: 30 } });
    return { rejected, own: await db.listOutbox(1, 2), otherUser: await db.listOutbox(3, 2), otherFarm: await db.listOutbox(1, 3), claimed: await db.claimOutboxOperations(1, 2, "owner", 1000, 1000) };
  });
  expect(result.rejected).toBe(true);
  expect(result.own.map((item) => item.payload.temperatureC)).toEqual([10, 30]);
  expect(result.otherUser).toEqual([]);
  expect(result.otherFarm).toEqual([]);
  expect(result.claimed.map((item) => item.operationId)).toEqual(["first"]);
});
