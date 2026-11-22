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

test("corrects only owned rejected legacy deaths and keeps their place in the queue", async ({ page, context }) => {
  await context.route("http://offline.test/**", (route) => route.fulfill({ contentType: "text/html", body: "<html></html>" }));
  await loadDatabase(page);
  const result = await page.evaluate(async () => {
    const db = (window as unknown as { offlineDb: {
      putOutboxOperation: (value: object) => Promise<unknown>;
      updateOutboxOperation: (id: string, patch: object) => Promise<void>;
      correctRejectedDeathObservation: (id: string, user: number, farm: number, observation: string, signs?: string) => Promise<void>;
      claimOutboxOperations: (user: number, farm: number, owner: string, now: number, lease: number) => Promise<Array<{ operationId: string }>>;
      listOutbox: (user: number, farm: number) => Promise<Array<{ operationId: string; status: string; sequence: number; payload: Record<string, unknown> }>>;
    } }).offlineDb;
    const base = { schemaVersion: 1, entityType: "BATCH_EVENT", userId: 1, farmId: 2, batchId: 7, occurredAt: "2026-01-01", queuedAt: "2026-01-01" };
    await db.putOutboxOperation({ ...base, operationId: "bad", payload: { eventType: "HEALTH_DEATH", affectedCount: 2, eventDate: "2026-01-01", details: "Signs noticed: \nExtra note", sexAllocation: { maleDelta: -1, femaleDelta: -1, unclassifiedDelta: 0 } } });
    await db.putOutboxOperation({ ...base, operationId: "later", payload: { eventType: "OTHER" } });
    await db.updateOutboxOperation("bad", { status: "REJECTED", lastErrorMessage: "Describe the signs noticed" });
    let wrongOwnerRejected = false, blankRejected = false;
    try { await db.correctRejectedDeathObservation("bad", 3, 2, "UNKNOWN"); } catch { wrongOwnerRejected = true; }
    try { await db.correctRejectedDeathObservation("bad", 1, 2, "SIGNS", "  "); } catch { blankRejected = true; }
    const before = await db.listOutbox(1, 2);
    await db.correctRejectedDeathObservation("bad", 1, 2, "SIGNS", "weak and coughing");
    const after = await db.listOutbox(1, 2);
    const claimed = await db.claimOutboxOperations(1, 2, "owner", 1000, 1000);
    let changedTwice = false;
    try { await db.correctRejectedDeathObservation("bad", 1, 2, "UNKNOWN"); changedTwice = true; } catch { /* no longer rejected */ }
    return { wrongOwnerRejected, blankRejected, before, after, claimed, changedTwice };
  });
  expect(result.wrongOwnerRejected).toBe(true);
  expect(result.blankRejected).toBe(true);
  expect(result.before[0].status).toBe("REJECTED");
  expect(result.after[0]).toMatchObject({ operationId: "bad", sequence: result.before[0].sequence, status: "PENDING", payload: { eventType: "HEALTH_DEATH", affectedCount: 2, eventDate: "2026-01-01", deathObservation: "SIGNS", deathSigns: "weak and coughing", details: "Signs noticed: weak and coughing\nExtra note", sexAllocation: { maleDelta: -1, femaleDelta: -1, unclassifiedDelta: 0 } } });
  expect(result.claimed.map((item) => item.operationId)).toEqual(["bad"]);
  expect(result.changedTwice).toBe(false);
});

test("corrects legacy unknown and no-signs choices without changing unrelated issues", async ({ page, context }) => {
  await context.route("http://offline.test/**", (route) => route.fulfill({ contentType: "text/html", body: "<html></html>" }));
  await loadDatabase(page);
  const result = await page.evaluate(async () => {
    const db = (window as unknown as { offlineDb: {
      putOutboxOperation: (value: object) => Promise<unknown>;
      updateOutboxOperation: (id: string, patch: object) => Promise<void>;
      correctRejectedDeathObservation: (id: string, user: number, farm: number, observation: string) => Promise<void>;
      listOutbox: (user: number, farm: number) => Promise<Array<{ operationId: string; status: string; payload: Record<string, unknown> }>>;
    } }).offlineDb;
    const base = { schemaVersion: 1, entityType: "BATCH_EVENT", userId: 1, farmId: 2, batchId: 7, occurredAt: "2026-01-01", queuedAt: "2026-01-01" };
    for (const [id, eventType] of [["unknown", "MORTALITY"], ["none", "HEALTH_DEATH"], ["unrelated", "TRANSFER_OUT"], ["conflict", "HEALTH_DEATH"]]) {
      await db.putOutboxOperation({ ...base, operationId: id, payload: { eventType, affectedCount: 1, details: null } });
      await db.updateOutboxOperation(id, { status: id === "conflict" ? "CONFLICT" : "REJECTED", lastErrorMessage: "Record what was observed or that it is unknown" });
    }
    let unrelatedRejected = false, conflictRejected = false, wrongFarmRejected = false;
    try { await db.correctRejectedDeathObservation("unrelated", 1, 2, "UNKNOWN"); } catch { unrelatedRejected = true; }
    try { await db.correctRejectedDeathObservation("conflict", 1, 2, "UNKNOWN"); } catch { conflictRejected = true; }
    try { await db.correctRejectedDeathObservation("none", 1, 3, "UNKNOWN"); } catch { wrongFarmRejected = true; }
    await db.correctRejectedDeathObservation("unknown", 1, 2, "UNKNOWN");
    await db.correctRejectedDeathObservation("none", 1, 2, "NO_SIGNS");
    return { unrelatedRejected, conflictRejected, wrongFarmRejected, items: await db.listOutbox(1, 2) };
  });
  expect(result.unrelatedRejected && result.conflictRejected && result.wrongFarmRejected).toBe(true);
  expect(result.items.find((item) => item.operationId === "unknown")).toMatchObject({ status: "PENDING", payload: { eventType: "MORTALITY", deathObservation: "UNKNOWN", deathSigns: null, details: "Signs not observed / unknown." } });
  expect(result.items.find((item) => item.operationId === "none")).toMatchObject({ status: "PENDING", payload: { deathObservation: "NO_SIGNS", deathSigns: null, details: "No signs noticed." } });
  expect(result.items.find((item) => item.operationId === "unrelated")?.status).toBe("REJECTED");
  expect(result.items.find((item) => item.operationId === "conflict")?.status).toBe("CONFLICT");
});

test("leaves a rejected death untouched when offline storage cannot save a correction", async ({ page, context }) => {
  await context.route("http://offline.test/**", (route) => route.fulfill({ contentType: "text/html", body: "<html></html>" }));
  await loadDatabase(page);
  const result = await page.evaluate(async () => {
    const db = (window as unknown as { offlineDb: {
      putOutboxOperation: (value: object) => Promise<unknown>;
      updateOutboxOperation: (id: string, patch: object) => Promise<void>;
      correctRejectedDeathObservation: (id: string, user: number, farm: number, observation: string) => Promise<void>;
      listOutbox: (user: number, farm: number) => Promise<Array<{ status: string; payload: unknown }>>;
    } }).offlineDb;
    await db.putOutboxOperation({ operationId: "death", schemaVersion: 1, entityType: "BATCH_EVENT", userId: 1, farmId: 2, batchId: 7, occurredAt: "2026-01-01", queuedAt: "2026-01-01", payload: { eventType: "HEALTH_DEATH", details: null, affectedCount: 1 } });
    await db.updateOutboxOperation("death", { status: "REJECTED", lastErrorMessage: "Record what was observed or that it is unknown" });
    const before = await db.listOutbox(1, 2);
    const originalPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === "outbox") throw new DOMException("Storage full", "QuotaExceededError");
      return originalPut.apply(this, args);
    };
    let failed = false;
    try { await db.correctRejectedDeathObservation("death", 1, 2, "UNKNOWN"); } catch { failed = true; }
    finally { IDBObjectStore.prototype.put = originalPut; }
    return { failed, before, after: await db.listOutbox(1, 2) };
  });
  expect(result.failed).toBe(true);
  expect(result.after).toEqual(result.before);
});

test("duplicate enqueue preserves the original intent and rejects changed payloads for every queue state", async ({ page, context }) => {
  await context.route("http://offline.test/**", route => route.fulfill({ contentType: "text/html", body: "<html></html>" }));
  await loadDatabase(page);
  const result = await page.evaluate(async () => {
    const db = (window as unknown as { offlineDb: {
      putOutboxOperation: (value: object) => Promise<unknown>;
      listOutbox: (user: number, farm: number) => Promise<unknown[]>;
      updateOutboxOperation: (id: string, patch: object) => Promise<void>;
    } }).offlineDb;
    const original = { operationId: "unchanging", schemaVersion: 1, entityType: "FARM_INPUT", userId: 1, farmId: 2, batchId: 7,
      payload: { operationId: "unchanging", quantity: 1, notes: "original" }, occurredAt: "2026-11-22T00:00:00Z", queuedAt: "2026-11-22T00:01:00Z" };
    await db.putOutboxOperation(original);
    const baseline = (await db.listOutbox(1, 2))[0];
    const changed = [
      { payload: { ...original.payload, quantity: 2 } },
      { occurredAt: "2026-11-22T01:00:00Z" },
      { userId: 3 }, { farmId: 3 }, { batchId: 8 }, { entityType: "BATCH_EVENT" }, { schemaVersion: 2 },
    ];
    const rejected = [];
    for (const patch of changed) {
      try { await db.putOutboxOperation({ ...original, ...patch }); rejected.push(false); }
      catch { rejected.push(true); }
    }
    await db.putOutboxOperation({ ...original, queuedAt: "2026-11-22T02:00:00Z", payload: { notes: "original", quantity: 1, operationId: "unchanging" } });
    const afterDuplicate = (await db.listOutbox(1, 2))[0];
    const states = [];
    for (const status of ["SYNCING", "RETRY_WAIT", "AUTH_REQUIRED", "REJECTED", "CONFLICT"]) {
      await db.updateOutboxOperation(original.operationId, { status, attemptCount: 2, leaseOwner: "other-tab" });
      const before = (await db.listOutbox(1, 2))[0];
      let accepted = true;
      try { await db.putOutboxOperation(original); } catch { accepted = false; }
      states.push({ accepted, unchanged: JSON.stringify(before) === JSON.stringify((await db.listOutbox(1, 2))[0]) });
    }
    return { rejected, baseline, afterDuplicate, states };
  });
  expect(result.rejected).toEqual([true, true, true, true, true, true, true]);
  expect(result.afterDuplicate).toEqual(result.baseline);
  expect(result.states).toEqual(Array.from({ length: 5 }, () => ({ accepted: true, unchanged: true })));
});

test("a blocked storage upgrade gives recovery guidance and can retry without clearing records", async ({ page, context }) => {
  await context.route("http://offline.test/**", route => route.fulfill({ contentType: "text/html", body: "<html></html>" }));
  await page.goto("http://offline.test/");
  // Hold a synthetic older database open to reproduce another tab blocking v5.
  await page.evaluate(async () => {
    const request = indexedDB.open("poultry-prophet-offline-v1", 4);
    await new Promise<void>((resolve, reject) => {
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore("outbox", { keyPath: "operationId" });
        store.put({ operationId: "legacy-kept", userId: 1, farmId: 2, batchId: 7, sequence: 1, status: "PENDING", payload: { notes: "keep me" } });
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => { (window as unknown as { blocker: IDBDatabase }).blocker = request.result; resolve(); };
    });
  });
  // addScriptTag only, since navigating would close the held connection.
  const source = readFileSync(join(process.cwd(), "lib/offline-db.ts"), "utf8");
  const script = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  await page.addScriptTag({ content: `window.offlineDb = {}; (function(exports){${script}})(window.offlineDb);` });
  const result = await page.evaluate(async () => {
    const db = (window as unknown as { offlineDb: { listOutbox: (u: number, f: number) => Promise<unknown[]> }; blocker: IDBDatabase });
    const first = await Promise.race([
      db.offlineDb.listOutbox(1, 2).then(() => "unexpected success", error => String(error.message)),
      new Promise<string>(resolve => setTimeout(() => resolve("hung save"), 1500)),
    ]);
    db.blocker.close();
    await new Promise(resolve => setTimeout(resolve, 100));
    const records = await db.offlineDb.listOutbox(1, 2);
    return { first, records };
  });
  expect(result.first).toMatch(/another tab/i);
  expect(result.first).toMatch(/retry/i);
  expect(result.records).toMatchObject([{ operationId: "legacy-kept", payload: { notes: "keep me" } }]);
});

test("an aborted queue commit reports unsaved and preserves earlier records", async ({ page, context }) => {
  await context.route("http://offline.test/**", route => route.fulfill({ contentType: "text/html", body: "<html></html>" }));
  await loadDatabase(page);
  const result = await page.evaluate(async () => {
    const db = (window as unknown as { offlineDb: { putOutboxOperation: (value: object) => Promise<unknown>; listOutbox: (u: number, f: number) => Promise<unknown[]> } }).offlineDb;
    const base = { schemaVersion: 1, entityType: "FARM_INPUT", userId: 1, farmId: 2, batchId: 7, payload: { quantity: 1 }, occurredAt: "2026-11-22T00:00:00Z", queuedAt: "2026-11-22T00:01:00Z" };
    await db.putOutboxOperation({ ...base, operationId: "already-saved" });
    const before = await db.listOutbox(1, 2);
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore["put"]>) {
      const request = original.apply(this, args);
      if (this.name === "outbox" && args[0].operationId === "cannot-save") {
        request.addEventListener("success", () => this.transaction.abort());
      }
      return request;
    };
    let saved = false;
    let error = "";
    try { await db.putOutboxOperation({ ...base, operationId: "cannot-save" }); saved = true; }
    catch (failure) { error = String(failure); }
    finally { IDBObjectStore.prototype.put = original; }
    return { before, after: await db.listOutbox(1, 2), saved, error };
  });
  expect(result.saved).toBe(false);
  expect(result.error).toMatch(/abort/i);
  expect(result.after).toEqual(result.before);
});
