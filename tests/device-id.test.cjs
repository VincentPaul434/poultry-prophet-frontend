/* eslint-disable @typescript-eslint/no-require-imports -- Exercise device IDs in an isolated browser VM. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function deviceStore(initial, uuid) {
  const values = new Map(Object.entries(initial));
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, '../lib/device-id.ts'), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(js, { exports, window: { localStorage: {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  } }, require: name => { if (name === './uuid') return { newSecureUuid: uuid }; throw new Error(name); } });
  return { get: exports.getDeviceId, values };
}

test('retains an existing device ID without replacing it', async () => {
  const store = deviceStore({ pp_offline_device_id: 'legacy-id' }, () => { throw new Error('must not generate'); });
  assert.equal(await store.get(), 'legacy-id');
});

test('persists a newly generated secure ID', async () => {
  const store = deviceStore({}, () => '00112233-4455-4677-8899-aabbccddeeff');
  assert.equal(await store.get(), '00112233-4455-4677-8899-aabbccddeeff');
  assert.equal(store.values.get('pp_offline_device_id'), '00112233-4455-4677-8899-aabbccddeeff');
});

test('does not store a weak device ID when secure randomness is unavailable', async () => {
  const store = deviceStore({}, () => { throw new Error('Secure random IDs are unavailable'); });
  await assert.rejects(store.get(), /Secure random/);
  assert.equal(store.values.size, 0);
});
