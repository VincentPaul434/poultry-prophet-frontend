/* eslint-disable @typescript-eslint/no-require-imports -- Execute actual hooks with controlled delivery dependencies. */
const test=require('node:test');const assert=require('node:assert/strict');
const {loadOperations}=require('./helpers/load-operations.cjs');
const program={name:'Fixture program',items:[{vaccineName:'Fixture vaccine',ageOffsetValue:0,ageOffsetUnit:'DAY'}]};
for(const online of [true,false]) test(`batch schedule create and assignment are one durable intent (online=${online})`,async()=>{
  let writes=0;
  const app=loadOperations({online,vaccinationApi:{createProgram:async()=>{writes++;return {id:1};}}});
  const result=await app.hooks.useCreateVaccinationProgram().mutationFn({body:program,batchId:7,replace:true});
  assert.equal(writes,0);assert.equal(result.queued,true);assert.equal(app.queued.length,1);
  assert.deepEqual(app.queued[0].payload,{action:'CREATE_AND_ASSIGN',replace:true,program,operationId:result.operationId});
  assert.equal(app.queued[0].batchId,7);assert.match(app.queued[0].occurredAt,/T.*Z$/);
});
for(const [hook,action,method] of [['useAssignVaccinationProgram','ASSIGN','assign'],['useReplaceVaccinationProgram','REPLACE','replace']])test(`${action} commits to the outbox before delivery, including online`,async()=>{
  let writes=0;
  const app=loadOperations({online:true,vaccinationApi:{[method]:async()=>{writes++;return [];}}});
  const result=await app.hooks[hook]().mutationFn({batchId:7,body:{programId:12}});
  assert.equal(writes,0);assert.equal(result.queued,true);
  assert.deepEqual(app.queued[0].payload,{action,programId:12,operationId:result.operationId});
});
test('failed local schedule capture cannot create a remote orphan program',async()=>{
  let writes=0;
  const app=loadOperations({online:true,vaccinationApi:{createProgram:async()=>{writes++;return {id:1};}},enqueue:async()=>{throw new Error('local commit failed');}});
  await assert.rejects(app.hooks.useCreateVaccinationProgram().mutationFn({body:program,batchId:7,replace:false}),/local commit/);
  assert.equal(writes,0);assert.equal(app.queued.length,0);
});
test('standalone program editing keeps its separate direct workflow',async()=>{
  const app=loadOperations({online:true,vaccinationApi:{createProgram:async()=>({id:12})}});
  assert.equal((await app.hooks.useCreateVaccinationProgram().mutationFn(program)).id,12);
  assert.equal(app.queued.length,0);
});
