/* eslint-disable @typescript-eslint/no-require-imports -- Exercise the real proxy against an explicitly disposable API. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const route = require('../app/api/backend/[...path]/route.ts');
const url = process.env.POULTRY_DISPOSABLE_BACKEND_URL;

test('real validation API keeps refresh credentials in the proxy cookie', { skip: url !== 'http://127.0.0.1:18081/api' }, async (t) => {
  const version = await fetch(`${url}/version`).then(response => response.json());
  assert.equal(version.application, 'poultry-prophet-backend');
  assert.equal(version.environment, 'validation');
  const previous = process.env.BACKEND_API_URL;
  process.env.BACKEND_API_URL = url;
  t.after(() => { if (previous === undefined) delete process.env.BACKEND_API_URL; else process.env.BACKEND_API_URL = previous; });
  const request = (path, body, cookie) => {
    const headers = { origin: 'http://127.0.0.1:3001', 'content-type': 'application/json' };
    if (cookie) headers.cookie = cookie;
    const req = new Request(`http://127.0.0.1:3001/api/backend/${path.join('/')}`, { method: 'POST', headers, body: JSON.stringify(body) });
    req.nextUrl = new URL(req.url);
    return route.POST(req, { params: Promise.resolve({ path }) });
  };
  const register = await request(['auth', 'register'], { email: `proxy-${crypto.randomUUID()}@example.test`, fullName: 'Disposable Proxy Test', password: 'test-password-only' });
  assert.equal(register.status, 201);
  const auth = await register.json();
  assert.ok(auth.token);
  assert.equal(auth.refreshToken, undefined);
  const setCookie = register.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Strict/);
  const initialCookie = setCookie.split(';')[0];
  const refresh = await request(['auth', 'refresh'], {}, initialCookie);
  assert.equal(refresh.status, 200);
  const rotated = await refresh.json();
  assert.ok(rotated.token);
  assert.equal(rotated.refreshToken, undefined);
  const replacement = refresh.headers.get('set-cookie').split(';')[0];
  assert.notEqual(replacement, initialCookie);
  const logout = await request(['auth', 'logout'], {}, replacement);
  assert.equal(logout.status, 204);
  assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
});
