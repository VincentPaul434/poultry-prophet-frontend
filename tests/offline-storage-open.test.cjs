/* eslint-disable @typescript-eslint/no-require-imports -- Exercise browser storage-open failures with deterministic timers. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function storage() {
  const requests = [];
  const timers = [];
  const exports = {};
  const script = ts.transpileModule(fs.readFileSync('lib/offline-db.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(script, { exports, window: {
    indexedDB: { open() { const request = {}; requests.push(request); return request; } },
    setTimeout(callback, delay) { timers.push({ callback, delay }); return timers.length; },
    clearTimeout() {},
  } });
  return { db: exports, requests, timers };
}

test('an unresponsive storage open fails in bounded time, permits retry and closes late handles', async () => {
  const { db, requests, timers } = storage();
  const saving = db.listOutbox(1, 2);
  assert.equal(timers[0].delay, 10_000);
  timers[0].callback();
  await assert.rejects(saving, error => error.code === 'OPEN_TIMEOUT' && /retry/.test(error.message) && /Do not clear site data/.test(error.message));
  const retry = db.listOutbox(1, 2);
  assert.equal(requests.length, 2, 'a failed open must not permanently poison the cached promise');
  let closed = 0;
  requests[0].result = { close() { closed++; } };
  requests[0].onsuccess();
  assert.equal(closed, 1, 'abandoned opens must not retain a stale connection');
  requests[1].onerror();
  await assert.rejects(retry, /Could not open offline storage/);
});

test('an abandoned blocked open aborts a later upgrade rather than mutating storage unexpectedly', async () => {
  const { db, requests } = storage();
  const saving = db.listOutbox(1, 2);
  requests[0].onblocked();
  await assert.rejects(saving, error => error.code === 'BLOCKED' && /another tab/.test(error.message));
  let aborted = 0;
  requests[0].transaction = { abort() { aborted++; } };
  requests[0].onupgradeneeded();
  assert.equal(aborted, 1);
});
