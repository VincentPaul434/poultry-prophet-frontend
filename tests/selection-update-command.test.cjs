/* eslint-disable @typescript-eslint/no-require-imports -- Run the actual hook in a controlled browser dependency VM. */
const test = require('node:test'); const assert = require('node:assert/strict');
const fs = require('node:fs'); const vm = require('node:vm'); const ts = require('typescript');
function load({ failSave = false } = {}) {
  const queued=[]; let sent=0; const exports={};
  const mocks={
    react:{}, '@tanstack/react-query':{useMutation: x=>x,useQueryClient:()=>({getQueryData:()=>[{id:91,status:'DRAFT',version:3,evaluatedCount:10,acceptedCount:5}]})},
    '@/lib/api':{selectionSessionApi:{update:async()=>{sent++;return {id:91};},create:async()=>{sent++;return {id:91};}}},
    '@/lib/api-client':{shouldUseOfflineSnapshot:()=>false},
    '@/lib/auth-context':{useAuth:()=>({user:{userId:2,farmId:1}})},
    '@/lib/offline-sync-provider':{useOfflineSync:()=>({enqueue:async item=>{if(failSave)throw new Error('local commit failed');queued.push(structuredClone(item));}})},
    '@/lib/offline-db':{}, '@/lib/query-keys':{qk:{batches:{selectionSessions:()=>['sessions']}}},
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('hooks/use-selection-sessions.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,
    {exports,require:n=>{if(!(n in mocks))throw new Error(n);return mocks[n];},navigator:{onLine:true}});
  return {hooks:exports,queued,sent:()=>sent};
}
const body={operationId:'f05e6719-a845-426f-9af5-4df4410a3001',selectionDate:'2026-11-22',evaluatedCount:10,acceptedCount:6,continueObservationCount:4,notAcceptedCount:0,otherCount:0,criterionCodes:[],expectedVersion:3};
test('online selection updates persist the original edit UUID and revision before delivery',async()=>{
  const app=load(); const result=await app.hooks.useUpdateSelectionSession(2).mutationFn({sessionId:91,body});
  assert.equal(app.sent(),0); assert.equal(app.queued.length,1);
  assert.deepEqual(app.queued[0].payload,{...body,sessionId:91});
  assert.equal(result.offlineSyncStatus,'PENDING');
});
test('selection updates without a known revision cannot create an unsafe command',async()=>{
  const app=load();const legacy={...body};delete legacy.expectedVersion;
  await assert.rejects(app.hooks.useUpdateSelectionSession(2).mutationFn({sessionId:91,body:legacy}),/revision|refresh/i);
  assert.equal(app.sent(),0);assert.equal(app.queued.length,0);
});
test('failed local selection capture never sends an online update',async()=>{
  const app=load({failSave:true});
  await assert.rejects(app.hooks.useUpdateSelectionSession(2).mutationFn({sessionId:91,body}),/local commit/);
  assert.equal(app.sent(),0);assert.equal(app.queued.length,0);
});

test('online selection creation is durable before delivery',async()=>{
  const app=load();const request={...body,selectionReviewId:44};delete request.expectedVersion;
  const result=await app.hooks.useCreateSelectionSession(2).mutationFn(request);
  assert.equal(app.sent(),0);assert.equal(app.queued.length,1);assert.deepEqual(app.queued[0].payload,request);assert.ok(result.id<0);
});
test('failed local selection creation never sends an uncertain online write',async()=>{
  const app=load({failSave:true});const request={...body,selectionReviewId:44};delete request.expectedVersion;
  await assert.rejects(app.hooks.useCreateSelectionSession(2).mutationFn(request),/local commit/);
  assert.equal(app.sent(),0);assert.equal(app.queued.length,0);
});
