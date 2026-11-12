/* eslint-disable @typescript-eslint/no-require-imports -- Exercise the worker in an isolated service-worker VM. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const origin = 'https://app.example';
function worker(version = 'build-one', stores = new Map()) {
  const handlers = {};
  let online = true;
  let calls = [];
  let body = 'fresh';
  let status = 200;
  const key = request => typeof request === 'string' || request instanceof URL ? new URL(request, origin).href : request.url;
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return {
        async match(request) { return store.get(key(request))?.clone(); },
        async put(request, response) { store.set(key(request), response.clone()); },
        async addAll(urls) { for (const url of urls) store.set(key(url), new Response(`precache ${url}`)); },
      };
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
    async match(request) { for (const name of stores.keys()) { const hit = await (await this.open(name)).match(request); if (hit) return hit; } },
  };
  const self = {
    location: new URL(`${origin}/sw.js?version=${version}`),
    addEventListener(type, handler) { handlers[type] = handler; },
    skipWaiting: async () => {}, clients: { claim: async () => {} },
  };
  const fetch = async request => {
    calls.push(key(request));
    if (!online) throw new TypeError('offline');
    return new Response(body, { status });
  };
  vm.runInNewContext(fs.readFileSync('public/sw.js', 'utf8'), { self, caches, fetch, URL, Response, Promise });
  return {
    stores, calls, set online(value) { online = value; }, set body(value) { body = value; }, set status(value) { status = value; },
    async lifecycle(type) { let pending; handlers[type]({ waitUntil(promise) { pending = promise; } }); await pending; },
    async request(path, options = {}) {
      const request = { url: new URL(path, origin).href, method: 'GET', mode: 'cors', ...options };
      let pending;
      handlers.fetch({ request, respondWith(promise) { pending = promise; } });
      return pending ? await pending : undefined;
    },
  };
}

function registration(buildId) {
  const calls = [];
  const navigationBuildId = require('next/dist/client/navigation-build-id');
  navigationBuildId.setNavigationBuildId(buildId);
  const source = ts.transpileModule(fs.readFileSync('components/service-worker-registration.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const registration = { installing: null, addEventListener() {} };
  const context = {
    exports: {}, process: { env: { NODE_ENV: 'production' } },
    navigator: { serviceWorker: { register: async (...args) => { calls.push(args); return registration; } } },
    console,
    require(name) {
      if (name === 'react') return { useEffect: fn => fn() };
      if (name === 'sonner') return { toast: { error() {} } };
      if (name === '@/components/locale-provider') return { useLocale: () => ({ t: key => key }) };
      if (name === 'next/dist/client/navigation-build-id') return navigationBuildId;
      throw new Error(`Unexpected import ${name}`);
    },
  };
  vm.runInNewContext(source, context);
  context.exports.ServiceWorkerRegistration();
  return calls;
}

test('registration identifies the current deployment and bypasses HTTP cache for worker updates', () => {
  const calls = registration('build 1');
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], '/sw.js?version=build%201');
  assert.equal(calls[0][1].scope, '/');
  assert.equal(calls[0][1].updateViaCache, 'none');
});

test('registration refuses an unknown deployment instead of sharing an unversioned cache', () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    assert.equal(registration('').length, 0);
  } finally {
    console.error = originalError;
  }
});

test('route data and mutable files fetch fresh content and fall back offline', async () => {
  const sw = worker();
  for (const path of ['/dashboard?_rsc=abc', '/manifest.webmanifest', '/_next/static/development/_buildManifest.js']) {
    sw.body = 'old'; assert.equal(await (await sw.request(path)).text(), 'old');
    sw.body = 'new'; assert.equal(await (await sw.request(path)).text(), 'new');
    sw.online = false; assert.equal(await (await sw.request(path)).text(), 'new');
    sw.online = true;
  }
});

test('fingerprinted Next assets are cache-first while navigations are network-first', async () => {
  const sw = worker();
  const asset = '/_next/static/chunks/app/layout-af7ea9d9ee14dfe5.js';
  sw.body = 'old'; await sw.request(asset); await sw.request('/dashboard', { mode: 'navigate' });
  sw.body = 'new';
  assert.equal(await (await sw.request(asset)).text(), 'old');
  assert.equal(await (await sw.request('/dashboard', { mode: 'navigate' })).text(), 'new');
  sw.online = false;
  assert.equal(await (await sw.request('/dashboard', { mode: 'navigate' })).text(), 'new');
});

test('offline navigation uses offline page for an uncached route', async () => {
  const sw = worker(); await sw.lifecycle('install'); sw.online = false;
  assert.equal(await (await sw.request('/unknown', { mode: 'navigate' })).text(), 'precache /offline');
});

test('activation removes older app caches without touching unrelated caches', async () => {
  const stores = new Map([['poultry-prophet-shell-old', new Map()], ['other-app', new Map()]]);
  const sw = worker('build-two', stores); await sw.lifecycle('install'); await sw.lifecycle('activate');
  assert.deepEqual([...stores.keys()].sort(), ['other-app', 'poultry-prophet-shell-build-two']);
});

test('a new deployment cannot read an older deployment cache before activation', async () => {
  const stores = new Map();
  const old = worker('build-one', stores);
  old.body = 'old deployment';
  await old.request('/dashboard?_rsc=one');
  const current = worker('build-two', stores);
  current.online = false;
  await assert.rejects(current.request('/dashboard?_rsc=one'), /Network unavailable/);
});

test('a failed network response is returned without replacing the last cached route', async () => {
  const sw = worker();
  sw.body = 'last good'; await sw.request('/dashboard?_rsc=abc');
  sw.status = 500; sw.body = 'server error';
  const errorResponse = await sw.request('/dashboard?_rsc=abc');
  assert.equal(errorResponse.status, 500);
  assert.equal(await errorResponse.text(), 'server error');
  sw.online = false;
  assert.equal(await (await sw.request('/dashboard?_rsc=abc')).text(), 'last good');
});

test('API, cross-origin, and non-GET requests bypass the worker', async () => {
  const sw = worker();
  assert.equal(await sw.request('/api/backend/batches'), undefined);
  assert.equal(await sw.request('/api'), undefined);
  assert.equal(await sw.request('https://other.example/image.png'), undefined);
  assert.equal(await sw.request('/dashboard', { method: 'POST' }), undefined);
});
