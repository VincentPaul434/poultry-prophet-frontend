/* eslint-disable @typescript-eslint/no-require-imports -- This Node test loads the CommonJS-transpiled client in an isolated VM. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017, esModuleInterop: true } }).outputText, filename);
const axios = require('axios');
const data = new Map();
global.window = { localStorage: { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) }, location: { pathname: '/dashboard', href: '' } };
const storage = require('../lib/auth-storage.ts');
const authLock = require('../lib/auth-lock.ts');
const realLock = authLock.withIndexedDbAuthLock;
let useRealLock = false;
authLock.withIndexedDbAuthLock = (operation) => useRealLock ? realLock(operation) : operation();
const { apiClient, refreshAccessToken, logoutIfCurrent, shouldUseOfflineSnapshot } = require('../lib/api-client.ts');
const user = (id, farm, token) => ({ userId: id, farmId: farm, email: 'a@example.test', fullName: 'Test', role: 'MANAGER', token, refreshToken: `refresh-${token}`, refreshTokenExpiresAt: '2099-01-01' });
Object.defineProperty(global, 'navigator', { configurable: true, value: { locks: { request: async (_name, fn) => fn() } } });

test('a second tab waits for an active refresh before deciding whether sign-in is required', async () => {
  data.clear();
  storage.saveSession(user(1, 1, 'initial'));
  storage.markRefreshUncertain(); // Another tab owns the lock and is rotating the cookie.
  const oldLock = navigator.locks.request;
  const oldPost = axios.post;
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let lockRequests = 0;
  let posts = 0;
  navigator.locks.request = async (_name, fn) => { lockRequests++; await gate; return fn(); };
  axios.post = async () => { posts++; return { data: user(1, 1, 'second-tab-token') }; };
  try {
    const pending = refreshAccessToken();
    await Promise.resolve();
    assert.equal(lockRequests, 1, 'the second tab must wait for the existing credential lock');
    assert.equal(storage.isAuthRequired(), false);
    storage.saveSession(user(1, 1, 'first-tab-token'), true); // The first tab finishes successfully.
    release();
    assert.equal(await pending, 'second-tab-token');
    assert.equal(posts, 1);
    assert.equal(storage.isAuthRequired(), false);
  } finally {
    release();
    navigator.locks.request = oldLock;
    axios.post = oldPost;
  }
});

test('a delayed logout never revokes a later signed-in session', async () => {
  data.clear();
  storage.saveSession(user(1, 1, 'old'));
  storage.clearSession();
  const revision = storage.getAuthRevision();
  let enter;
  const gate = new Promise(resolve => { enter = resolve; });
  const oldRequest = navigator.locks.request;
  navigator.locks.request = async (_name, fn) => { await gate; return fn(); };
  let calls = 0;
  try {
    const logout = logoutIfCurrent(revision, async () => { calls++; });
    storage.saveSession(user(2, 2, 'new'));
    enter();
    await logout;
    assert.equal(calls, 0);
    assert.equal(storage.getToken(), 'new');
  } finally { navigator.locks.request = oldRequest; }
});

test('session storage contains no access or refresh credentials, and legacy secrets are purged', () => {
  data.clear();
  data.set('pp_auth_token', 'legacy-access');
  data.set('pp_auth_refresh_token', 'legacy-refresh');
  storage.saveSession(user(1, 1, 'private-access'));
  const values = JSON.stringify([...data.entries()]);
  assert.doesNotMatch(values, /private-access|refresh-private-access|legacy-access|legacy-refresh/);
  assert.equal(storage.getToken(), 'private-access');
});

test('an ambiguous refresh failure does not reuse a possibly rotated cookie', async () => {
  data.clear();
  storage.saveSession(user(1, 1, 'original'));
  const originalPost = axios.post;
  let calls = 0;
  axios.post = async () => { calls++; throw new axios.AxiosError('timeout'); };
  try {
    assert.equal(await refreshAccessToken(), null);
    assert.equal(await refreshAccessToken(), null);
    assert.equal(calls, 1);
    assert.ok(storage.getStoredUser());
  } finally { axios.post = originalPost; }
});

test('a confirmed not-started refresh can be retried after the backend becomes ready', async () => {
  data.clear();
  storage.saveSession(user(1, 1, 'original'));
  const originalPost = axios.post;
  let calls = 0;
  axios.post = async () => {
    calls++;
    if (calls === 1) throw new axios.AxiosError('Backend unavailable', 'ERR_BAD_RESPONSE', {}, undefined,
      { status: 503, data: {}, headers: { 'x-pp-refresh-not-started': '1' }, config: {} });
    return { data: user(1, 1, 'renewed') };
  };
  try {
    assert.equal(await refreshAccessToken(), null);
    assert.equal(storage.isRefreshUncertain(), false);
    assert.equal(storage.isAuthRequired(), false);
    assert.equal(await refreshAccessToken(), 'renewed');
    assert.equal(calls, 2);
  } finally { axios.post = originalPost; }
});

test('a late not-started response cannot clear a newer session uncertainty marker', async () => {
  data.clear();
  storage.saveSession(user(1, 1, 'original'));
  const originalPost = axios.post;
  let rejectRefresh;
  let started;
  const sent = new Promise(resolve => { started = resolve; });
  axios.post = async () => { started(); return new Promise((_resolve, reject) => { rejectRefresh = reject; }); };
  try {
    const pending = refreshAccessToken();
    await sent;
    storage.saveSession(user(2, 2, 'new-session'));
    storage.markRefreshUncertain();
    rejectRefresh(new axios.AxiosError('Backend unavailable', 'ERR_BAD_RESPONSE', {}, undefined,
      { status: 503, data: {}, headers: { 'x-pp-refresh-not-started': '1' }, config: {} }));
    assert.equal(await pending, null);
    assert.equal(storage.isRefreshUncertain(), true);
    assert.equal(storage.getStoredUser().userId, 2);
  } finally { axios.post = originalPost; }
});

test('rotation intent is recorded before the request and cleared after success', async () => {
  data.clear();
  storage.saveSession(user(1, 1, 'original'));
  const originalPost = axios.post;
  axios.post = async () => {
    assert.equal(storage.isRefreshUncertain(), true);
    return { data: user(1, 1, 'renewed') };
  };
  try {
    assert.equal(await refreshAccessToken(), 'renewed');
    assert.equal(storage.isRefreshUncertain(), false);
  } finally { axios.post = originalPost; }
});

test('refresh fails closed when IndexedDB coordination is unavailable', async () => {
  data.clear();
  storage.saveSession(user(1, 1, 'original'));
  const locks = navigator.locks;
  const originalPost = axios.post;
  let calls = 0;
  navigator.locks = undefined;
  useRealLock = true;
  axios.post = async () => { calls++; };
  try { assert.equal(await refreshAccessToken(), null); assert.equal(calls, 0); }
  finally { navigator.locks = locks; useRealLock = false; axios.post = originalPost; }
});
function unauthorized(config) {
  return new axios.AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, { status: 401, data: {}, headers: {}, config });
}

test('an orphaned uncertain refresh requires sign-in without replaying the cookie', async () => {
  data.clear();
  storage.saveSession(user(1, 1, 'original'));
  const scope = storage.getSessionScope();
  storage.markRefreshUncertain();
  const originalLock = authLock.withIndexedDbAuthLock;
  const originalPost = axios.post;
  let refreshCalls = 0;
  authLock.withIndexedDbAuthLock = async () => { throw new authLock.AuthLockError('abandoned'); };
  axios.post = async () => { refreshCalls++; };
  apiClient.defaults.adapter = async config => { throw unauthorized(config); };
  try {
    const error = await apiClient.post('/sync/v2/operations', {}).catch(failure => failure);
    assert.equal(error.status, 401);
    assert.equal(storage.isAuthRequired(), true);
    assert.equal(storage.getSessionScope(), scope);
    assert.ok(storage.getStoredUser());
    assert.equal(refreshCalls, 0);
  } finally { authLock.withIndexedDbAuthLock = originalLock; axios.post = originalPost; }
});

test('an abandoned lock without uncertain refresh does not discard a valid session', async () => {
  data.clear();
  storage.saveSession(user(1, 1, 'original'));
  const originalLock = authLock.withIndexedDbAuthLock;
  authLock.withIndexedDbAuthLock = async () => { throw new authLock.AuthLockError('abandoned'); };
  try {
    assert.equal(await refreshAccessToken(), null);
    assert.equal(storage.isAuthRequired(), false);
    assert.equal(storage.getToken(), 'original');
  } finally { authLock.withIndexedDbAuthLock = originalLock; }
});

test('an old request is never retried using a different user or farm', async () => {
  for (const next of [user(2, 1, 'next'), user(1, 2, 'next'), user(1, 1, 'next')]) {
    data.clear();
    storage.saveSession(user(1, 1, 'original'));
    let release;
    let started;
    const sent = new Promise(resolve => { started = resolve; });
    let calls = 0;
    apiClient.defaults.adapter = async config => {
      calls++;
      if (calls > 1) throw unauthorized(config);
      started();
      await new Promise(resolve => { release = resolve; });
      throw unauthorized(config);
    };
    const request = apiClient.post('/sync/v2/operations', {}).catch(error => error);
    await sent;
    storage.saveSession(next);
    release();
    const error = await request;
    assert.equal(error.status, 401);
    assert.equal(calls, 1);
    assert.equal(storage.getToken(), 'next');
  }
});


test('a session change during refresh prevents the original request from being replayed', async () => {
  data.clear();
  storage.saveSession(user(1, 1, 'original'));
  let refreshStarted;
  let finishRefresh;
  const started = new Promise(resolve => { refreshStarted = resolve; });
  const originalPost = axios.post;
  axios.post = async () => {
    refreshStarted();
    await new Promise(resolve => { finishRefresh = resolve; });
    return { data: user(1, 1, 'renewed') };
  };
  let calls = 0;
  apiClient.defaults.adapter = async config => { calls++; throw unauthorized(config); };
  try {
    const request = apiClient.post('/sync/v2/operations', {}).catch(error => error);
    await started;
    storage.saveSession(user(2, 2, 'new-login'));
    finishRefresh();
    const error = await request;
    assert.equal(error.status, 401);
    assert.equal(calls, 1);
    assert.equal(storage.getToken(), 'new-login');
  } finally {
    axios.post = originalPost;
  }
});

test('a successful refresh may retry within the same session and farm', async () => {
  data.clear();
  storage.saveSession(user(1, 1, 'original'));
  const originalPost = axios.post;
  axios.post = async () => ({ data: user(1, 1, 'renewed') });
  const authorizations = [];
  apiClient.defaults.adapter = async config => {
    authorizations.push(config.headers.Authorization);
    if (authorizations.length === 1) throw unauthorized(config);
    return { status: 200, statusText: 'OK', data: { ok: true }, headers: {}, config };
  };
  try {
    const response = await apiClient.post('/sync/v2/operations', {});
    assert.deepEqual(authorizations, ['Bearer original', 'Bearer renewed']);
    assert.equal(response.data.ok, true);
  } finally {
    axios.post = originalPost;
  }
});

test('a rejected refresh retains the offline identity and requires reauthentication', async () => {
  data.clear();
  window.location.href = '';
  storage.saveSession(user(1, 1, 'original'));
  const originalPost = axios.post;
  axios.post = async () => { throw new axios.AxiosError('Unauthorized', 'ERR_BAD_REQUEST', undefined, undefined, { status: 401, data: {} }); };
  apiClient.defaults.adapter = async config => { throw unauthorized(config); };
  try {
    const error = await apiClient.get('/farm').catch(error => error);
    assert.equal(error.status, 401);
    assert.equal(storage.getToken(), null);
    assert.equal(storage.isAuthRequired(), true);
    assert.equal(storage.getStoredUser().userId, 1);
    assert.ok(storage.getSessionScope());
    assert.equal(window.location.href, '');
    assert.doesNotMatch(JSON.stringify([...data]), /original|refresh-original/);
    let calls = 0;
    apiClient.defaults.adapter = async () => { calls++; throw new Error('unexpected request'); };
    const offlineError = await apiClient.get('/batches').catch(error => error);
    assert.equal(offlineError.status, 401);
    assert.equal(shouldUseOfflineSnapshot(offlineError), true);
    assert.equal(calls, 0);
    storage.clearSession();
    assert.equal(storage.getStoredUser(), null);
    assert.equal(storage.getSessionScope(), null);
  } finally {
    axios.post = originalPost;
  }
});

test('a session-bound command cannot dispatch under an account changed before Axios interception', async () => {
  data.clear();storage.saveSession(user(1,1,'first-token'));
  const expected=storage.getSessionScope(); const adapter=apiClient.defaults.adapter;let sent=0;
  apiClient.defaults.adapter=async config=>{sent++;return {data:{},status:200,statusText:'OK',headers:{},config};};
  try {
    const pending=apiClient.post('/sync/v2/operations',{}, {_expectedSessionScope:expected});
    storage.saveSession(user(2,2,'second-token'));
    await assert.rejects(pending,error=>error.status===401);
    assert.equal(sent,0);assert.equal(storage.getToken(),'second-token');
  } finally {apiClient.defaults.adapter=adapter;}
});
