/* eslint-disable @typescript-eslint/no-require-imports -- Test the browser helper in an isolated VM. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadUuid(crypto) {
  const source = fs.readFileSync(path.join(__dirname, '../lib/uuid.ts'), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const exports = {};
  vm.runInNewContext(js, { exports, crypto, Uint8Array });
  return exports.newSecureUuid;
}

test('uses the browser native UUID when available', () => {
  assert.equal(loadUuid({ randomUUID: () => '00112233-4455-4677-8899-aabbccddeeff' })(), '00112233-4455-4677-8899-aabbccddeeff');
});

test('creates RFC 4122 v4 IDs with secure random bytes when randomUUID is unavailable', () => {
  const uuid = loadUuid({ getRandomValues: bytes => { bytes.set([0,17,34,51,68,85,102,119,136,153,170,187,204,221,238,255]); return bytes; } });
  assert.equal(uuid(), '00112233-4455-4677-8899-aabbccddeeff');
});

test('fails explicitly without secure entropy instead of returning an invalid or guessable ID', () => {
  assert.throws(() => loadUuid({})(), /secure|safely/i);
});
