/* eslint-disable @typescript-eslint/no-require-imports -- Node tests execute the client modules in an isolated CommonJS VM. */
const test=require('node:test');const assert=require('node:assert/strict');
const {loadProvider,record,response,ApiError}=require('./helpers/load-offline-provider.cjs');
test('request validation failure isolates the bad head without trapping another batch',async()=>{
  const bad=record(1), following=record(2), good=record(3,8);
  const h=loadProvider([bad,following,good],async body=>{if(body.operations.some(o=>o.operationId===bad.operationId))throw new ApiError('Invalid payload',400);return response(body);});
  await h.sync();
  assert.equal(h.rows().find(r=>r.operationId===bad.operationId).status,'REJECTED');
  assert.equal(h.rows().find(r=>r.operationId===following.operationId).status,'PENDING');
  assert.ok(!h.rows().some(r=>r.operationId===good.operationId));
  assert.deepEqual(h.rows()[0].payload,bad.payload);assert.equal(h.rows()[0].occurredAt,bad.occurredAt);
  const count=h.calls.length;await h.sync();assert.equal(h.calls.length,count);
});
test('invalid occurrence time is retained for repair without sending it',async()=>{
  const bad={...record(1),occurredAt:'not-a-date'};const good=record(2,8);
  const h=loadProvider([bad,good],async body=>response(body));await h.sync();
  assert.ok(h.rows().length,'invalid command must remain on this device');
  assert.equal(h.rows()[0].status,'REJECTED');assert.equal(h.rows()[0].occurredAt,'not-a-date');
  assert.ok(h.calls.every(b=>b.operations.every(o=>o.operationId!==bad.operationId)));
  assert.ok(!h.rows().some(r=>r.operationId===good.operationId));
});
test('legacy date-only sex-count wire data is never rewritten during send',async()=>{
  const old={...record(1),entityType:'SEX_COMPOSITION',occurredAt:'2026-11-22',payload:{observedOn:'2026-11-22',maleCount:1,femaleCount:0,unclassifiedCount:0}};
  const h=loadProvider([old],async body=>response(body));await h.sync();
  assert.equal(h.calls[0].operations[0].occurredAt,'2026-11-22');assert.deepEqual(h.calls[0].operations[0].payload,old.payload);assert.equal(h.rows().length,0);
});
for(const status of [0,503,401])test(`HTTP ${status} retains command content and scope`,async()=>{
  const old=record(1);const h=loadProvider([old],async()=>{throw new ApiError('unavailable',status);});await h.sync();
  assert.equal(h.rows()[0].status,status===401?'AUTH_REQUIRED':'RETRY_WAIT');
  for(const key of ['operationId','userId','farmId','payload','occurredAt','queuedAt','sequence'])assert.deepEqual(h.rows()[0][key],old[key]);
});
test('singleton isolation retains successful acknowledgements when another head needs authentication',async()=>{
  const good=record(1),auth=record(2,8),untried=record(3,9);
  const h=loadProvider([good,auth,untried],async body=>{
    if(body.operations.length>1)throw new ApiError('invalid request',400);
    if(body.operations[0].operationId===auth.operationId)throw new ApiError('expired',401);
    return response(body);
  });await h.sync();
  assert.ok(!h.rows().some(r=>r.operationId===good.operationId));
  assert.ok(h.rows().every(r=>r.status==='AUTH_REQUIRED'));
  assert.ok(!h.calls.some(b=>b.operations.length===1&&b.operations[0].operationId===untried.operationId));
});
test('missing server acknowledgement never removes the command',async()=>{
  const old=record(1);const h=loadProvider([old],async()=>({results:[]}));await h.sync();
  assert.equal(h.rows()[0].status,'RETRY_WAIT');assert.deepEqual(h.rows()[0].payload,old.payload);
});
test('permission failure is retained for review rather than retried as a network outage',async()=>{
  const old=record(1);const h=loadProvider([old],async()=>{throw new ApiError('Permission denied',403);});await h.sync();
  assert.equal(h.rows()[0].status,'REJECTED');assert.equal(h.rows()[0].lastErrorMessage,'Permission denied');
  const count=h.calls.length;await h.sync();assert.equal(h.calls.length,count);
});
test('combined request too large is split before valid independent heads are rejected',async()=>{
  const h=loadProvider([record(1),record(2,8)],async body=>{
    if(body.operations.length>1)throw new ApiError('Request too large',413);
    return response(body);
  });await h.sync();assert.equal(h.rows().length,0);assert.equal(h.calls.length,3);
});
test('a single oversized command remains saved for review without an endless retry',async()=>{
  const original=record(1);const h=loadProvider([original],async()=>{throw new ApiError('Request too large',413);});
  await h.sync();assert.equal(h.rows()[0].status,'REJECTED');assert.deepEqual(h.rows()[0].payload,original.payload);
  await h.sync();assert.equal(h.calls.length,1);
});
test('a singleton cannot acknowledge another command whose own send is uncertain',async()=>{
  const a=record(1),b=record(2,8);
  const h=loadProvider([a,b],async body=>{
    if(body.operations.length>1)throw new ApiError('Invalid combined body',400);
    if(body.operations[0].operationId===a.operationId)return response({operations:[b]});
    throw new ApiError('response lost',0);
  });await h.sync();
  assert.equal(h.rows().length,2);assert.ok(h.rows().every(r=>r.status==='RETRY_WAIT'));
});
test('cross-tab account switch stops subsequent singleton sends even with a stale React user',async()=>{
  const a=record(1),b=record(2,8);let h;
  h=loadProvider([a,b],async body=>{
    if(body.operations.length>1)throw new ApiError('Invalid combined body',400);
    h.switchSession(9,3);return response(body);
  });await h.sync();
  assert.equal(h.calls.filter(b=>b.operations.length===1).length,1);
  assert.equal(h.rows()[0].operationId,b.operationId);assert.equal(h.rows()[0].status,'AUTH_REQUIRED');
});


test('a held or rejected command never advances the successful sync time',async()=>{
  for (const status of ['RETRYABLE','REJECTED','CONFLICT']) {
    const h=loadProvider([record(1)],async body=>({results:body.operations.map(operation=>({operationId:operation.operationId,status,serverId:null,message:'retained'}))}));
    await h.sync();assert.equal(h.successfulSyncs(),0);assert.equal(h.rows().length,1);
  }
  const h=loadProvider([record(1)],response);await h.sync();assert.equal(h.successfulSyncs(),1);
});
