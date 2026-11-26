/* eslint-disable @typescript-eslint/no-require-imports -- Exercise late browser storage opens in a VM. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

test('unresponsive manager intent storage fails in bounded time and closes late handles', async () => {
  const requests = [], timers = [], exports = {};
  const source = ts.transpileModule(fs.readFileSync('lib/manager-intents.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  vm.runInNewContext(source, {exports, require:()=>({newSecureUuid:()=>require('node:crypto').randomUUID()}), indexedDB:{open(){const request={};requests.push(request);return request;}}, setTimeout:(callback,delay)=>{timers.push({callback,delay});return timers.length;}, clearTimeout:()=>{}});
  const loading = exports.readManagerIntent({userId:1,farmId:2,kind:'FINANCE_CREATE',targetId:'farm'});
  assert.equal(timers[0]?.delay, 10_000);
  timers[0].callback();
  await assert.rejects(loading, /storage|saved request/i);
  let closed = 0;
  requests[0].result = {close(){closed++;}};
  requests[0].onsuccess();
  assert.equal(closed, 1);
});
