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
  const lifecycleCalls = { skipWaiting: 0, claim: 0 };
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
    skipWaiting: async () => { lifecycleCalls.skipWaiting++; }, clients: { claim: async () => { lifecycleCalls.claim++; } },
  };
  const fetch = async request => {
    calls.push(key(request));
    if (!online) throw new TypeError('offline');
    return new Response(body, { status });
  };
  vm.runInNewContext(fs.readFileSync('public/sw.js', 'utf8'), { self, caches, fetch, URL, Response, Promise });
  return {
    stores, calls, lifecycleCalls, set online(value) { online = value; }, set body(value) { body = value; }, set status(value) { status = value; },
    async lifecycle(type) { let pending; handlers[type]?.({ waitUntil(promise) { pending = promise; } }); await pending; },
    async request(path, options = {}) {
      const request = { url: new URL(path, origin).href, method: 'GET', mode: 'cors', ...options };
      let pending;
      handlers.fetch({ request, respondWith(promise) { pending = promise; } });
      return pending ? await pending : undefined;
    },
  };
}

function registration(buildId, { environment = 'production', registrations = [], cacheApi = {}, controller = {}, notifications = [] } = {}) {
  const calls = [];
  const navigationBuildId = require('next/dist/client/navigation-build-id');
  navigationBuildId.setNavigationBuildId(buildId);
  const source = ts.transpileModule(fs.readFileSync('components/service-worker-registration.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const registration = { active: { state: "activated" }, installing: null, addEventListener() {} };
  const context = {
    exports: {}, process: { env: { NODE_ENV: environment } },
    window: { location: { origin }, caches: cacheApi }, caches: cacheApi,
    navigator: { serviceWorker: { controller, getRegistrations: async () => registrations, register: async (...args) => { calls.push(args); return registration; } } },
    console, URL,
    require(name) {
      if (name === 'react') return { useEffect: fn => fn() };
      if (name === 'sonner') return { toast: { error() {}, info: (...args) => notifications.push(args) } };
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

test('worker lifecycle never takes over an open page or deletes its deployment assets', async () => {
  const stores = new Map([['poultry-prophet-shell-old', new Map()], ['other-app', new Map()]]);
  const oldCache = stores.get('poultry-prophet-shell-old');
  oldCache.set(`${origin}/_next/static/chunks/old-abcdef123456.js`, new Response('old required code'));
  const sw = worker('build-two', stores);
  await sw.lifecycle('install');
  assert.equal(sw.lifecycleCalls.skipWaiting, 0, 'updates must wait until existing controlled pages close');
  await sw.lifecycle('activate');
  assert.equal(sw.lifecycleCalls.claim, 0, 'do not take over documents rendered by another deployment');
  assert.equal(await oldCache.get(`${origin}/_next/static/chunks/old-abcdef123456.js`).text(), 'old required code');
  assert.deepEqual([...stores.keys()].sort(), ['other-app', 'poultry-prophet-shell-build-two', 'poultry-prophet-shell-old']);
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


test('ordinary development disables only its own worker and preserves deployment caches', async () => {
  const unregistered = [];
  const deleted = [];
  const makeRegistration = (scope, scriptURL, name) => ({ scope, active: { scriptURL }, unregister: async () => { unregistered.push(name); } });
  registration('development', {
    environment: 'development',
    registrations: [
      makeRegistration(`${origin}/`, `${origin}/sw.js?version=previous`, 'farm'),
      makeRegistration(`${origin}/other/`, `${origin}/other/sw.js`, 'other'),
    ],
    cacheApi: { keys: async () => ['poultry-prophet-shell-old', 'other-app'], delete: async name => { deleted.push(name); } },
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(unregistered, ['farm']);
  assert.deepEqual(deleted, [], 'an older open farm tab may still need its cached assets');
});

test('first install asks for an online refresh while the current page is uncontrolled', async () => {
  const notifications = [];
  registration('first-install', { controller: null, notifications });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(notifications.length, 1, 'an uncontrolled page must not silently look prepared');
  assert.equal(notifications[0][0], 'status.offlineRefreshRequired');
  assert.equal(notifications[0][1].description, 'status.offlineRefreshHint');
  assert.equal(notifications[0][1].position, 'bottom-center', 'persistent setup notice must not cover the mobile header');
  assert.equal(notifications[0][1].closeButton, true, 'the user can dismiss the notice');
  assert.equal(notifications[0][1].duration, 8_000, 'setup guidance must not float over content indefinitely');
  assert.equal(notifications[0][1].style.pointerEvents, 'none', 'informational text must not intercept form or navigation taps');
});
test('an already controlled page is not asked to reload when its update waits', async () => {
  const notifications = [];
  registration('next-install', { controller: { scriptURL: `${origin}/sw.js?version=previous` }, notifications });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(notifications.length, 0);
});
