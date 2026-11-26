/* eslint-disable @typescript-eslint/no-require-imports -- Exercise actual inventory query with controlled snapshots/outbox. */
const test = require('node:test');
const assert = require('node:assert/strict');
const {loadOperations, ApiError} = require('./helpers/load-operations.cjs');

const qk = {inventoryProducts: () => ['inventory','products']};
const product = {id:9,stockOnHand:98,active:true};

test('cached confirmed stock never double-subtracts a possibly applied queued use', async () => {
  const app=loadOperations({queryKeys:{qk}, inventoryApi:{products:async()=>{throw new ApiError('offline',0);}}, offlineDb:{
    getFarmProductSnapshots:async()=>[product],
    getQueuedInventoryDelta:async()=>-2,
    listOutbox:async()=>[{entityType:'FARM_INPUT',status:'RETRY_WAIT',payload:{farmProductId:9,quantity:2}}],
  }});
  const [result]=await app.hooks.useFarmProducts().queryFn();
  assert.equal(result.stockOnHand,98);
  assert.equal(result.stockIsCached,true);
  assert.equal(result.hasPendingInventoryUse,true);
});

test('scheduled vaccine queue is reported separately from online confirmed stock', async () => {
  const app=loadOperations({queryKeys:{qk}, inventoryApi:{products:async()=>[product]},offlineDb:{saveFarmProductSnapshots:async()=>{},listOutbox:async()=>[{entityType:'VACCINATION_PLAN',status:'PENDING',payload:{planId:4,quantity:2}}]}});
  const [result]=await app.hooks.useFarmProducts().queryFn();
  assert.equal(result.stockOnHand,98);
  assert.equal(result.stockIsCached,false);
  assert.equal(result.hasPendingInventoryUse,true);
});

test('unavailable outbox storage warns rather than claiming confirmed inventory is current', async () => {
  const app=loadOperations({queryKeys:{qk},inventoryApi:{products:async()=>[product]},offlineDb:{saveFarmProductSnapshots:async()=>{},listOutbox:async()=>{throw new Error('unavailable');}}});
  const [result]=await app.hooks.useFarmProducts().queryFn();
  assert.equal(result.stockOnHand,98);
  assert.equal(result.hasPendingInventoryUse,true);
});
