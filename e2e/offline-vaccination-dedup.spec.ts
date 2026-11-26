import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

test("two tabs preserve one unresolved intent per scheduled dose and account", async ({ context }) => {
  await context.route("http://offline.test/**", (route) => route.fulfill({ contentType: "text/html", body: "<html></html>" }));
  const script = ts.transpileModule(readFileSync(join(process.cwd(), "lib/offline-db.ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const pages = [await context.newPage(), await context.newPage()];
  for (const page of pages) {
    await page.goto("http://offline.test/");
    await page.addScriptTag({ content: `window.offlineDb = {}; (function(exports){${script}})(window.offlineDb);` });
  }
  const base = { schemaVersion: 1, entityType: "VACCINATION_PLAN", userId: 1, farmId: 2, batchId: 7, payload: { planId: 31, quantity: 2 }, occurredAt: "2026-01-01T00:00:00Z", queuedAt: "2026-01-01T00:00:00Z" };
  const add = (record: object) => {
    const db = (window as unknown as { offlineDb: { putOutboxOperation: (value: object) => Promise<unknown> } }).offlineDb;
    return db.putOutboxOperation(record).then(() => "saved", (error: Error) => error.message);
  };
  const outcomes = await Promise.all([
    pages[0].evaluate(add, { ...base, operationId: "first" }),
    pages[1].evaluate(add, { ...base, operationId: "second" }),
  ]);
  expect(outcomes.filter((value) => value === "saved")).toHaveLength(1);
  expect(outcomes.find((value) => value !== "saved")).toMatch(/already|review|sync/i);
  const winner = outcomes[0] === "saved" ? "first" : "second";
  expect(await pages[0].evaluate(add, { ...base, operationId: winner })).toBe("saved");
  expect(await pages[0].evaluate(add, { ...base, operationId: "other-dose", payload: { planId: 32, quantity: 2 } })).toBe("saved");
  expect(await pages[0].evaluate(add, { ...base, operationId: "other-account", userId: 3 })).toBe("saved");
  const result = await pages[0].evaluate(async (winnerId) => {
    const db = (window as unknown as { offlineDb: {
      updateOutboxOperation: (id: string, patch: object) => Promise<void>;
      putOutboxOperation: (value: object) => Promise<unknown>;
      listOutbox: (user: number, farm: number) => Promise<Array<{ operationId: string; payload: unknown; status: string }>>;
      deleteOutboxOperation: (id: string) => Promise<void>;
    } }).offlineDb;
    await db.updateOutboxOperation(winnerId, { status: "CONFLICT" });
    let conflictMessage = "";
    try { await db.putOutboxOperation({ schemaVersion: 1, entityType: "VACCINATION_PLAN", userId: 1, farmId: 2, batchId: 7, payload: { planId: 31, quantity: 3 }, occurredAt: "2026-01-01T00:00:00Z", queuedAt: "2026-01-01T00:00:00Z", operationId: "third" }); }
    catch (error) { conflictMessage = (error as Error).message; }
    const beforeRemoval = await db.listOutbox(1, 2);
    await db.deleteOutboxOperation(winnerId);
    await db.putOutboxOperation({ schemaVersion: 1, entityType: "VACCINATION_PLAN", userId: 1, farmId: 2, batchId: 7, payload: { planId: 31, quantity: 3 }, occurredAt: "2026-01-01T00:00:00Z", queuedAt: "2026-01-01T00:00:00Z", operationId: "third" });
    return { conflictMessage, beforeRemoval, afterRemoval: await db.listOutbox(1, 2) };
  }, winner);
  expect(result.conflictMessage).toMatch(/already|review|sync/i);
  expect(result.beforeRemoval.find((item) => item.operationId === winner)).toMatchObject({ status: "CONFLICT", payload: base.payload });
  expect(result.afterRemoval.map((item) => item.operationId)).toContain("third");
});
