import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

test("uncertain manager writes keep their immutable request and key across tabs and reload", async ({ context }) => {
  await context.route("http://localhost:8123/**", route => route.fulfill({ contentType: "text/html", body: "<html></html>" }));
  const source = readFileSync(join(process.cwd(), "lib/manager-intents.ts"), "utf8");
  const script = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const uuidScript = ts.transpileModule(readFileSync(join(process.cwd(), "lib/uuid.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const pages = [await context.newPage(), await context.newPage()];
  const load = async (page: typeof pages[number]) => {
    await page.goto("http://localhost:8123/");
    await page.addScriptTag({ content: `window.managerDb = {}; window.managerUuid = {}; (function(exports){${uuidScript}})(window.managerUuid); (function(exports,require){${script}})(window.managerDb, () => window.managerUuid);` });
  };
  await Promise.all(pages.map(load));
  const scope = { userId: 1, farmId: 2, kind: "FINANCE_CREATE", targetId: "7" };
  const payload = { batchId: 7, amount: 100, category: "Supplies", transactionDate: "2026-01-01", type: "EXPENSE" };
  const prepare = (args: { scope: object; payload: object }) => (window as unknown as { managerDb: { prepareManagerIntent: (scope: object, payload: object) => Promise<{ operationId: string }> } }).managerDb.prepareManagerIntent(args.scope, args.payload);
  const [first, concurrent] = await Promise.all(pages.map(page => page.evaluate(prepare, { scope, payload })));
  expect(concurrent.operationId).toBe(first.operationId);
  await load(pages[1]);
  const loaded = await pages[1].evaluate((currentScope) => (window as unknown as { managerDb: { readManagerIntent: (scope: object) => Promise<{ operationId: string; payload: unknown }> } }).managerDb.readManagerIntent(currentScope), scope);
  expect(loaded).toMatchObject({ operationId: first.operationId, payload });
  await expect(pages[1].evaluate(prepare, { scope, payload: { ...payload, amount: 120 } })).rejects.toThrow(/previous|pending|unresolved/i);
  const other = await pages[1].evaluate(prepare, { scope: { ...scope, userId: 3 }, payload });
  expect(other.operationId).not.toBe(first.operationId);
  const listed = await pages[0].evaluate((currentScope) => (window as unknown as { managerDb: { listManagerIntents: (scope: object) => Promise<Array<{ operationId: string }>> } }).managerDb.listManagerIntents(currentScope), { userId: 1, farmId: 2, kind: "FINANCE_CREATE" });
  expect(listed.map(item => item.operationId)).toEqual([first.operationId]);
  const states = await pages[0].evaluate(async ({ currentScope, operationId }) => {
    const db = (window as unknown as { managerDb: { resolveManagerIntent: (scope: object, id: string) => Promise<boolean>; readManagerIntent: (scope: object) => Promise<unknown> } }).managerDb;
    const wrong = await db.resolveManagerIntent(currentScope, "wrong-id");
    const retained = await db.readManagerIntent(currentScope);
    const removed = await db.resolveManagerIntent(currentScope, operationId);
    const gone = await db.readManagerIntent(currentScope);
    return { wrong, retained, removed, gone };
  }, { currentScope: scope, operationId: first.operationId });
  expect(states.wrong).toBe(false);
  expect(states.retained).toMatchObject({ operationId: first.operationId });
  expect(states.removed).toBe(true);
  expect(states.gone).toBeNull();
  const intentionalSecond = await pages[0].evaluate(prepare, { scope, payload });
  expect(intentionalSecond.operationId).not.toBe(first.operationId);
});

test("an aborted storage commit leaves the financial intent unsaved", async ({ page, context }) => {
  await context.route("http://localhost:8124/**", route => route.fulfill({ contentType:"text/html", body:"<html></html>" }));
  const source = readFileSync(join(process.cwd(), "lib/manager-intents.ts"), "utf8");
  const script = ts.transpileModule(source, { compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020} }).outputText;
  const uuidScript = ts.transpileModule(readFileSync(join(process.cwd(), "lib/uuid.ts"), "utf8"), { compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020} }).outputText;
  await page.goto("http://localhost:8124/");
  await page.addScriptTag({content:`window.managerDb = {}; window.managerUuid = {}; (function(exports){${uuidScript}})(window.managerUuid); (function(exports,require){${script}})(window.managerDb, () => window.managerUuid);`});
  const result = await page.evaluate(async () => {
    const db = (window as unknown as {managerDb:{prepareManagerIntent:(scope:object,payload:object)=>Promise<unknown>;readManagerIntent:(scope:object)=>Promise<unknown>}}).managerDb;
    const scope={userId:1,farmId:2,kind:'FINANCE_CREATE',targetId:'7'};
    const original=IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put=function(...args:Parameters<IDBObjectStore['put']>){
      const request=original.apply(this,args);
      if(this.name==='intents') request.addEventListener('success',()=>this.transaction.abort());
      return request;
    };
    let error='';
    try { await db.prepareManagerIntent(scope,{amount:100}); } catch (failure) { error=(failure as Error).message; }
    IDBObjectStore.prototype.put=original;
    return {error,remaining:await db.readManagerIntent(scope)};
  });
  expect(result.error).toMatch(/storage|save/i);
  expect(result.remaining).toBeNull();
});
