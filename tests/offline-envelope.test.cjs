/* eslint-disable @typescript-eslint/no-require-imports -- Node tests execute the client modules in an isolated CommonJS VM. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadOperations } = require('./helpers/load-operations.cjs');
test('offline sex count retains its farm date and uses a valid recording instant', async () => {
  const {hooks,queued}=loadOperations();
  const start=Date.now();
  await hooks.useRecordSexComposition().mutationFn({batchId:7,body:{observedOn:'2026-11-22',maleCount:1,femaleCount:0,unclassifiedCount:0}});
  assert.equal(queued[0].payload.observedOn,'2026-11-22');
  assert.match(queued[0].occurredAt,/T.*Z$/);
  assert.ok(Date.parse(queued[0].occurredAt)>=start);
  assert.ok(Date.parse(queued[0].occurredAt)<=Date.now());
});
