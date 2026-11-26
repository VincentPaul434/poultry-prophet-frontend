/* eslint-disable @typescript-eslint/no-require-imports -- Exercise actual query observers and hook lifecycle. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { QueryClient, QueryObserver } = require('@tanstack/react-query');
function load(file, mocks) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { exports, require: name => mocks[name] });
  return exports;
}
const refresh = load('lib/live-refresh.ts', {});

test('refresh updates mounted farm reads, leaves inactive data unfetched and joins an in-flight request', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } });
  let server = 200, reads = 0, inactiveReads = 0;
  const observer = new QueryObserver(client, { queryKey: ['batches', '35', 'overview'], queryFn: async () => { reads++; return server; }, staleTime: Infinity });
  const stop = observer.subscribe(() => {});
  await observer.refetch();
  client.setQueryDefaults(['batches', '99'], { queryFn: async () => { inactiveReads++; return 99; } });
  client.setQueryData(['batches', '99'], 99);
  client.setQueryData(['saved-report', 10], { population: 200 });
  const before = reads;
  server = 150;
  await refresh.refreshActiveFarmQueries(client);
  assert.equal(client.getQueryData(['batches', '35', 'overview']), 150);
  assert.equal(reads, before + 1);
  assert.equal(inactiveReads, 0);
  assert.equal(client.getQueryData(['saved-report', 10]).population, 200);
  stop(); client.clear();
});

test('refresh failures reject so the control cannot announce a successful update', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } });
  const observer = new QueryObserver(client, { queryKey: ['inventory'], queryFn: async () => { throw new Error('server down'); } });
  const stop = observer.subscribe(() => {});
  await assert.rejects(refresh.refreshActiveFarmQueries(client), /server down/);
  stop(); client.clear();
});

test('one-minute timer pauses offline/hidden, resumes once on focus and cleans up listeners', async () => {
  let effect, interval, cleaned = false, calls = 0;
  const listeners = new Map();
  const globals = { navigator: { onLine: true }, document: { visibilityState: 'visible',
    addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) },
    window: { setInterval: (fn, delay) => { assert.equal(delay, 60_000); interval = fn; return 1; }, clearInterval: () => { cleaned = true; },
      addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('hooks/use-farm-realtime.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { ...globals, exports, require: name => ({
    react: { useEffect: fn => { effect = fn; } }, '@tanstack/react-query': { useQueryClient: () => ({}) },
    '@/lib/auth-context': { useAuth: () => ({ user: { userId: 1, farmId: 2 }, authRequired: false }) },
    '@/lib/live-refresh': { LIVE_REFRESH_INTERVAL: 60_000, refreshActiveFarmQueries: async () => { calls++; } },
  })[name] });
  exports.useFarmRealtime(); const cleanup = effect();
  globals.navigator.onLine = false; interval(); assert.equal(calls, 0);
  globals.navigator.onLine = true; globals.document.visibilityState = 'hidden'; interval(); assert.equal(calls, 0);
  globals.document.visibilityState = 'visible'; listeners.get('visibilitychange')(); listeners.get('focus')();
  assert.equal(calls, 1);
  cleanup(); assert.equal(cleaned, true); assert.equal(listeners.size, 0);
});
