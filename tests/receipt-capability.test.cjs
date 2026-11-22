/* eslint-disable @typescript-eslint/no-require-imports -- Exercise the real API delivery boundary. */
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
class ApiError extends Error { constructor(message,status){super(message);this.status=status;} }
function api(metadata,getError){
  const posts=[],gets=[],exports={};
  const apiClient={get:async(path,config)=>{gets.push({path,config});if(getError)throw getError;return{data:metadata};},post:async(path,body,config)=>{posts.push({path,body:structuredClone(body),config});return{data:{received:body.operations.length,applied:body.operations.length,conflicts:0,rejected:0,retryable:0,results:body.operations.map(op=>({operationId:op.operationId,status:'APPLIED',serverId:1,serverTime:'2026-11-22T00:00:00Z',message:null}))}};}};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/api.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:name=>{if(name==='./api-client')return{apiClient,ApiError};throw new Error(name);}});
  return{sync:exports.syncApi,posts,gets};
}
const op=(operationId,entityType,batchId)=>({operationId,entityType,batchId,schemaVersion:1,occurredAt:'2026-11-22T00:00:00Z',payload:{operationId}});
const command=op('selection','SELECTION_SESSION_UPDATE',7);
const ready={offlineCapabilities:{protocolVersions:[2],commandReceipts:true,schemaReady:true,receiptEntityTypes:['SELECTION_SESSION_UPDATE','VACCINATION_SCHEDULE']}};
for(const metadata of [null,{}, {offlineCapabilities:{...ready.offlineCapabilities,commandReceipts:false}}, {offlineCapabilities:{...ready.offlineCapabilities,schemaReady:false}}, {offlineCapabilities:{...ready.offlineCapabilities,receiptEntityTypes:[]}}])test('unknown or unavailable receipt capability retains protected work without a POST',async()=>{
  const app=api(metadata);const result=await app.sync.operations({deviceId:'fixture',operations:[command]},'scope-A');
  assert.equal(app.posts.length,0);assert.equal(result.results[0].status,'RETRYABLE');
  assert.equal(result.results[0].operationId,'selection');assert.equal(app.gets[0].config._expectedSessionScope,'scope-A');
});
test('a ready server receives the unchanged command with the original session fence',async()=>{
  const app=api(ready);await app.sync.operations({deviceId:'fixture',operations:[command]},'scope-A');
  assert.deepEqual(app.posts[0].body.operations,[command]);assert.equal(app.posts[0].config._expectedSessionScope,'scope-A');
});
test('unsupported receipt batches stay ordered while unrelated batches can progress',async()=>{
  const app=api({offlineCapabilities:{...ready.offlineCapabilities,receiptEntityTypes:['FARM_INPUT']}});const body={deviceId:'fixture',operations:[command,op('dependent','BATCH_EVENT',7),op('independent','FARM_INPUT',8)]};
  const result=await app.sync.operations(body);
  assert.deepEqual(app.posts[0].body.operations.map(op=>op.operationId),['independent']);
  assert.deepEqual(Array.from(result.results.filter(result=>result.status==='RETRYABLE'),result=>result.operationId),['selection','dependent']);
  assert.deepEqual(body.operations.map(op=>op.operationId),['selection','dependent','independent']);
});
test('unadvertised batch commands also wait for explicit capability',async()=>{
  const app=api({});await app.sync.operations({deviceId:'fixture',operations:[op('event','BATCH_EVENT',7)]});assert.equal(app.gets.length,1);assert.equal(app.posts.length,0);
});
test('authentication failure while checking capability never dispatches a command',async()=>{
  const app=api({},new ApiError('sign in',401));
  await assert.rejects(app.sync.operations({deviceId:'fixture',operations:[command]}),error=>error.status===401);
  assert.equal(app.posts.length,0);
});

for(const type of ['BATCH_EVENT','FARM_INPUT','SELECTION_SESSION','SEX_COMPOSITION','TASK_STATUS','VACCINATION_PLAN','DAILY_RECORD'])test(`an older backend never receives unprotected ${type} commands`,async()=>{
  const app=api({});const result=await app.sync.operations({deviceId:'fixture',operations:[op('remaining',type,7)]},'scope-A');
  assert.equal(app.posts.length,0);assert.equal(result.results[0].status,'RETRYABLE');assert.equal(result.results[0].operationId,'remaining');
});
