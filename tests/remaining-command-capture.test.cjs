/* eslint-disable @typescript-eslint/no-require-imports -- Exercise actual capture hooks with controlled dependencies. */
const test=require('node:test');const assert=require('node:assert/strict');const {loadOperations}=require('./helpers/load-operations.cjs');
const id='f05e6719-a845-426f-9af5-4df4410a3001';
test('online sex observations commit to the outbox before any POST',async()=>{
  let sent=0;const app=loadOperations({online:true,batchApi:{recordSexComposition:async()=>{sent++;return{id:1};}}});
  const body={operationId:id,observedOn:'2026-11-22',maleCount:10,femaleCount:10,unclassifiedCount:0};
  await app.hooks.useRecordSexComposition().mutationFn({batchId:7,body});
  assert.equal(sent,0);assert.deepEqual(app.queued[0].payload,body);assert.match(app.queued[0].occurredAt,/T.*Z$/);
});
test('online task status commits the original identity, note and time before delivery',async()=>{
  let sent=0;const app=loadOperations({online:true,taskApi:{updateStatus:async()=>{sent++;return{id:3};}}});
  const body={operationId:id,status:'IN_PROGRESS',note:'original',occurredAt:'2026-11-22T00:00:00Z'};
  await app.hooks.useUpdateTaskStatus().mutationFn({id:3,batchId:7,body});
  assert.equal(sent,0);assert.deepEqual(app.queued[0].payload,{...body,taskId:3});assert.equal(app.queued[0].occurredAt,body.occurredAt);
});
test('online vaccination capture freezes occurrence time before the local commit',async()=>{
  let sent=0;const app=loadOperations({online:true,vaccinationApi:{record:async()=>{sent++;return{id:4};}}});
  const body={operationId:id,quantity:1,unit:'vial',notes:'original'};
  await app.hooks.useRecordVaccination().mutationFn({plan:{id:4,batchId:7},body});
  assert.equal(sent,0);assert.equal(app.queued[0].payload.planId,4);assert.equal(app.queued[0].payload.operationId,id);
  assert.match(app.queued[0].payload.recordedAt,/T.*Z$/);assert.equal(app.queued[0].payload.recordedAt,app.queued[0].occurredAt);assert.equal(body.recordedAt,undefined);
});
test('a failed local vaccination save cannot send a remote completion',async()=>{
  let sent=0;const app=loadOperations({online:true,vaccinationApi:{record:async()=>{sent++;return{id:4};}},enqueue:async()=>{throw new Error('local commit failed');}});
  await assert.rejects(app.hooks.useRecordVaccination().mutationFn({plan:{id:4,batchId:7},body:{operationId:id,quantity:1}}),/local commit/);
  assert.equal(sent,0);assert.equal(app.queued.length,0);
});
