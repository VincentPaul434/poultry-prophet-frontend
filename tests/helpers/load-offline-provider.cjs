/* eslint-disable @typescript-eslint/no-require-imports -- Node tests execute the client modules in an isolated CommonJS VM. */
const fs=require('node:fs'); const path=require('node:path'); const vm=require('node:vm'); const ts=require('typescript');
const {ApiError}=require('./load-operations.cjs');
function loadProvider(initial, send) {
  let rows=structuredClone(initial), snapshot, successfulSyncs=0;
  let authScope=JSON.stringify(["initial",1,2]), authOwner={userId:1,farmId:2};
  const calls=[];
  const db={
    listOutbox:async(u,f)=>structuredClone(rows.filter(r=>r.userId===u&&r.farmId===f)),
    getLastSuccessfulSync:async()=>null,getDeviceId:async()=> 'isolated-device',setLastSuccessfulSync:async()=>{successfulSyncs++;},
    claimOutboxOperations:async(u,f,owner,now,lease)=>{
      const heads=new Map();for(const row of rows.filter(r=>r.userId===u&&r.farmId===f).sort((a,b)=>a.sequence-b.sequence))if(!heads.has(row.batchId))heads.set(row.batchId,row);
      const claimed=[...heads.values()].filter(r=>r.status==='PENDING');
      for(const row of claimed){row.status='SYNCING';row.leaseOwner=owner;row.leaseUntil=now+lease;}
      return structuredClone(claimed);
    },
    updateClaimedOutboxOperation:async(id,owner,patch)=>{
      const row=rows.find(r=>r.operationId===id);if(!row||row.leaseOwner!==owner||row.status!=='SYNCING')return false;
      if(patch)Object.assign(row,patch);else rows=rows.filter(r=>r!==row); return true;
    },
    renewOutboxClaims:async()=>{},commitSyncedSelectionSession:async()=>{},
  };
  for(const name of ['saveOfflineBootstrap','saveBatchSnapshots','saveDashboardSnapshot','saveFarmProductSnapshots','saveBatchEventSnapshot','saveBatchOverviewSnapshot'])db[name]=async()=>{};
  const mocks={
    react:{createContext:()=>({Provider:'Provider'}),useCallback:f=>f,useMemo:f=>f(),useRef:x=>({current:x}),useLayoutEffect:f=>f(),useEffect:()=>{},useState:x=>{snapshot=x;return [x,f=>{snapshot=typeof f==='function'?f(snapshot):f;}];}},
    'react/jsx-runtime':{jsx:(_,props)=>props},
    '@tanstack/react-query':{useQueryClient:()=>({invalidateQueries:()=>{}})},
    './api-client':{ApiError}, './api':{offlineApi:{bootstrap:async()=>({batches:[],dashboard:[],products:[]})},syncApi:{operations:async body=>{calls.push(structuredClone(body));return send(body);}}},
    './auth-context':{useAuth:()=>({user:{userId:1,farmId:2},isAuthenticated:true,isLoading:false,authRequired:false})},
    './auth-storage':{isAuthRequired:()=>false,getSessionScope:()=>authScope,getStoredUser:()=>authOwner}, './offline-db':db,
    './device-id':{getDeviceId:async()=> 'isolated-device'},
  };
  const loaded={};
  function load(file){if(loaded[file])return loaded[file];const exports={};loaded[file]=exports;
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../../lib',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,
      {exports,require:n=>n in mocks?mocks[n]:load(n.replace('./','')+'.ts'),navigator:{onLine:true},window:{setTimeout,clearTimeout,setInterval:()=>1,clearInterval:()=>{}},crypto:require('node:crypto').webcrypto,AbortController,fetch:async()=>({ok:true}),console});return exports;}
  const provider=load('offline-sync-provider.tsx').OfflineSyncProvider({children:null});
  return {sync:()=>provider.value.syncNow(),rows:()=>structuredClone(rows),snapshot:()=>snapshot,switchSession:(u,f)=>{authScope=JSON.stringify(["other",u,f]);authOwner={userId:u,farmId:f};},calls,successfulSyncs:()=>successfulSyncs};
}
function record(n,batch=7){return {operationId:`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,schemaVersion:1,entityType:'BATCH_EVENT',userId:1,farmId:2,batchId:batch,payload:{eventType:'BEHAVIOR_OBSERVATION',title:'Fixture'},occurredAt:'2026-11-22T03:00:00Z',queuedAt:'2026-11-22T03:00:01Z',sequence:n,status:'PENDING',attemptCount:0};}
function response(body){return {results:body.operations.map(o=>({operationId:o.operationId,status:'APPLIED',serverId:42,serverTime:'2026-11-22T03:05:00Z',message:null}))};}
module.exports={loadProvider,record,response,ApiError};
