/* eslint-disable @typescript-eslint/no-require-imports -- Node tests execute the client modules in an isolated CommonJS VM. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadOperations } = require('./helpers/load-operations.cjs');
test('online product capture commits locally before any network delivery', async () => {
  let networkCalls=0;
  let release;
  const committed=new Promise(resolve=>{release=resolve;});
  const {hooks,queued}=loadOperations({online:true,createInput:async()=>{networkCalls++;return {id:10};},enqueue:()=>committed});
  const original={batchId:7,productType:'FEED',brandName:'Fixture',quantity:1};
  let finished=false;
  const started=Date.now();
  const saving=hooks.useCreateFarmInput().mutationFn(original).then(result=>{finished=true;return result;});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(networkCalls,0,'only the claimed outbox sender may deliver a batch product');
  assert.equal(finished,false,'save must await the local commit');
  release();
  const result=await saving;
  assert.equal(result.queued,true);
  assert.equal(queued.length,1);
  assert.equal(queued[0].payload.operationId,result.operationId);
  assert.equal(queued[0].occurredAt,queued[0].payload.recordedAt);
  assert.ok(Date.parse(queued[0].occurredAt)>=started);
  assert.equal(original.recordedAt,undefined);
});
test('a failed local product commit never sends and never reports saved',async()=>{
  let networkCalls=0;
  const {hooks,queued}=loadOperations({online:true,createInput:async()=>{networkCalls++;return {id:10};},enqueue:async()=>{throw new Error('storage full');}});
  await assert.rejects(hooks.useCreateFarmInput().mutationFn({batchId:7,productType:'FEED',quantity:1}),/storage full/);
  assert.equal(networkCalls,0);
  assert.equal(queued.length,0);
});
test('incubation inputs retain the existing direct server workflow',async()=>{
  const {hooks,queued}=loadOperations({online:true,createInput:async body=>({id:12,incubationCycleId:body.incubationCycleId})});
  const result=await hooks.useCreateFarmInput().mutationFn({incubationCycleId:3,productType:'FEED',quantity:1});
  assert.equal(result.id,12);
  assert.equal(queued.length,0);
});
test('explicit product occurrence time and supplied identity survive retry unchanged',async()=>{
  const body={batchId:7,productType:'FEED',brandName:'Fixture',quantity:1,recordedAt:'2026-11-21T23:55:00Z',operationId:'00000000-0000-4000-8000-000000000001'};
  const {hooks,queued}=loadOperations();
  await hooks.useCreateFarmInput().mutationFn(body);
  assert.equal(queued[0].occurredAt,body.recordedAt);
  assert.deepEqual(queued[0].payload,body);
});
