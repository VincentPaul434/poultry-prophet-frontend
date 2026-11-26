/* eslint-disable @typescript-eslint/no-require-imports -- Exercise actual hooks with controlled storage and API failures. */
const test = require('node:test');
const assert = require('node:assert/strict');
const {loadOperations, ApiError} = require('./helpers/load-operations.cjs');

test('finance retries a lost response using the same persisted key and payload', async () => {
  let intent, attempts = 0, resolved = 0;
  const sent = [];
  const app = loadOperations({
    managerIntents: {
      prepareManagerIntent: async (scope, payload) => intent ??= {scope, payload: structuredClone(payload), operationId:'first-key'},
      resolveManagerIntent: async () => { resolved++; intent = null; return true; },
    },
    financeApi: {create: async (...args) => { sent.push(args); if (++attempts === 1) throw new ApiError('lost response', 0); return {id: 42}; }},
  });
  const mutation = app.hooks.useCreateFinanceTransaction();
  const body = {batchId: 7, amount: 100, type:'EXPENSE', category:'Feed', transactionDate:'2026-01-01'};
  await assert.rejects(mutation.mutationFn(body), /lost response/);
  assert.equal(resolved, 0, 'an uncertain response must not clear the saved intent');
  await mutation.mutationFn(body);
  assert.equal(resolved, 1);
  assert.deepEqual(sent.map(args => args[1]), ['first-key', 'first-key']);
  assert.deepEqual(sent.map(args => args[0]), [body, body]);
  assert.deepEqual(sent.map(args => args[2]), ['fixture-session', 'fixture-session']);
});

test('stock additions send the saved operation ID on an uncertain retry', async () => {
  let attempts = 0, intent, resolved = 0;
  const sent = [];
  const app = loadOperations({
    managerIntents: { prepareManagerIntent: async (scope, payload) => intent ??= {scope, payload:structuredClone(payload), operationId:'stock-key'}, resolveManagerIntent: async () => { resolved++; intent = null; return true; } },
    inventoryApi: {stockIn: async (...args) => { sent.push(args); if (++attempts === 1) throw new ApiError('lost response', 0); return {id: 17}; }},
  });
  const mutation = app.hooks.useStockInProduct();
  const vars = {productId: 9, body: {quantity: 2, purchaseUnitCost: 10}};
  await assert.rejects(mutation.mutationFn(vars), /lost response/);
  await mutation.mutationFn(vars);
  assert.equal(resolved, 1);
  assert.deepEqual(sent.map(args => args[1].operationId), ['stock-key', 'stock-key']);
  assert.deepEqual(sent.map(args => args[2]), ['fixture-session', 'fixture-session']);
});

test('a session switch before send preserves the intent and never calls the API', async () => {
  let scope = 'fixture-session', writes = 0, resolved = 0;
  const app = loadOperations({
    auth: {getSessionScope: () => scope},
    managerIntents: { prepareManagerIntent: async (_identity, payload) => { scope = 'other-session'; return {payload, operationId:'saved-key'}; }, resolveManagerIntent: async () => { resolved++; } },
    financeApi: {create: async () => { writes++; }},
  });
  await assert.rejects(app.hooks.useCreateFinanceTransaction().mutationFn({batchId: 7}), /session changed/i);
  assert.equal(writes, 0);
  assert.equal(resolved, 0);
});

test('failed durable intent commit sends no financial request', async () => {
  let writes = 0;
  const app = loadOperations({managerIntents:{prepareManagerIntent:async()=>{throw new Error('storage unavailable');}},financeApi:{create:async()=>{writes++;}}});
  await assert.rejects(app.hooks.useCreateFinanceTransaction().mutationFn({batchId:7}), /storage unavailable/);
  assert.equal(writes,0);
});

test('expense correction survives a lost response and retries its original scoped intent', async () => {
  let saved, attempts = 0, resolved = 0;
  const sent = [];
  const app = loadOperations({
    managerIntents: {
      prepareManagerIntent: async (scope, payload, supplied) => saved ??= {...scope, payload: structuredClone(payload), operationId: supplied ?? 'correction-key'},
      resolveManagerIntent: async () => { resolved++; saved = null; return true; },
    },
    financeApi: { correct: async (...args) => { sent.push(args); if (++attempts === 1) throw new ApiError('lost response', 0); return {id: 43, batchId: 7}; } },
  });
  const mutation = app.hooks.useCorrectFinanceExpense();
  const body = {transactionDate:'2026-01-01', category:'Feed', amount:120, reason:'Correct amount', expectedUpdatedAt:'2026-01-01T00:00:00Z'};
  await assert.rejects(mutation.mutationFn({id: 9, batchId: 7, body}), /lost response/);
  assert.equal(resolved, 0);
  assert.equal(saved.kind, 'FINANCE_CORRECTION');
  assert.equal(saved.targetId, '9');
  assert.equal(saved.contextId, '7');
  await mutation.mutationFn({id: 9, batchId: 7, body});
  assert.equal(resolved, 1);
  assert.deepEqual(sent.map(args => args[1].operationId), ['correction-key', 'correction-key']);
  assert.deepEqual(sent.map(args => args[2]), ['fixture-session', 'fixture-session']);
});

for (const outcome of ['APPLIED', 'CANCELLED']) test(`resolution removes an intent only after server confirms ${outcome}`, async () => {
  const saved = {userId:1, farmId:2, kind:'FINANCE_CREATE', targetId:'7', operationId:'old-key', payload:{batchId:7, amount:100}};
  let removed=0, sent;
  const app=loadOperations({managerIntents:{readManagerIntent:async()=>saved, resolveManagerIntent:async()=>{removed++;return true;}},
    managerApi:{resolve:async (...args)=>{sent=args;return {status:outcome};}}});
  const result=await app.hooks.useResolveManagerIntent().mutationFn(saved);
  assert.equal(result.status,outcome);
  assert.deepEqual(structuredClone(sent[0]),{kind:saved.kind,targetId:saved.targetId,operationId:saved.operationId,payload:saved.payload});
  assert.equal(sent[1],'fixture-session');
  assert.equal(removed,1);
});

test('resolution retains the original intent if the server cannot prove its outcome', async () => {
  const saved = {userId:1, farmId:2, kind:'FINANCE_CREATE', targetId:'7', operationId:'old-key', payload:{batchId:7}};
  let removed=0;
  const app=loadOperations({managerIntents:{readManagerIntent:async()=>saved,resolveManagerIntent:async()=>{removed++;}},
    managerApi:{resolve:async()=>{throw new ApiError('review required',409);}}});
  await assert.rejects(app.hooks.useResolveManagerIntent().mutationFn(saved),/review required/);
  assert.equal(removed,0);
});

test('resolution never sends a replaced intent or an intent owned by another farm', async () => {
  const saved = {userId:1, farmId:2, kind:'FINANCE_CREATE', targetId:'7', operationId:'current-key', payload:{batchId:7}};
  let sends=0, removed=0;
  const app=loadOperations({managerIntents:{readManagerIntent:async()=>saved,resolveManagerIntent:async()=>{removed++;}},
    managerApi:{resolve:async()=>{sends++;return {status:'CANCELLED'};}}});
  await assert.rejects(app.hooks.useResolveManagerIntent().mutationFn({...saved,operationId:'old-key'}),/changed/i);
  await assert.rejects(app.hooks.useResolveManagerIntent().mutationFn({...saved,farmId:8}),/session changed/i);
  assert.equal(sends,0);
  assert.equal(removed,0);
});

for (const [label, hook, method, input, keyPosition] of [
  ['product creation', 'useCreateFarmProduct', 'createProduct', {brandName:'Test',stockUnit:'vial',productType:'VACCINE',openingQuantity:10}, 1],
  ['stock adjustment', 'useAdjustInventory', 'adjust', {productId:9,body:{quantityDelta:2,reason:'Counted'}}, 1],
]) test(`${label} retries with its original persisted key`, async () => {
  let attempts = 0, intent, resolved = 0;
  const sent = [];
  const app = loadOperations({
    managerIntents: {prepareManagerIntent: async (scope,payload) => intent ??= {...scope,payload:structuredClone(payload),operationId:'fixed-operation'}, resolveManagerIntent: async () => {resolved++; intent=null;return true;}},
    inventoryApi: {[method]: async (...args) => {sent.push(args);if(++attempts===1)throw new ApiError('lost response',0);return {id:17};}},
  });
  const mutation = app.hooks[hook]();
  await assert.rejects(mutation.mutationFn(input), /lost response/);
  await mutation.mutationFn(input);
  assert.equal(resolved,1);
  const keys=sent.map(args=>method==='adjust' ? args[keyPosition].operationId : args[keyPosition]);
  assert.deepEqual(keys,['fixed-operation','fixed-operation']);
});
