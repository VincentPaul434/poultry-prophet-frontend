/* eslint-disable @typescript-eslint/no-require-imports -- Exercise the local command's actual request boundary. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

async function check(url, response) {
  const calls = [], messages = [];
  const process = { argv: ['node', 'check-local-sync.mjs', ...(url ? [url] : [])], exitCode: 0 };
  const source = fs.readFileSync('scripts/check-local-sync.mjs', 'utf8').replace(/^#!.*\n/, '');
  await vm.runInNewContext(`(async () => {${source}\n})()`, {
    process, URL, AbortSignal, console: { log: text => messages.push(text), error: text => messages.push(text) },
    fetch: async (url, options) => { calls.push({ url: url.href, options }); return response; },
  });
  return { calls, messages, exitCode: process.exitCode };
}

test('non-local URLs are refused before any network request', async () => {
  for (const url of ['https://poultry-prophet.vercel.app/api/backend/version', 'http://127.0.0.1.example.com/api/version', 'http://user:password@localhost:18080/api/version']) {
    const result = await check(url);
    assert.equal(result.calls.length, 0);
    assert.equal(result.exitCode, 1);
  }
});

test('the default checks only the local API and rejects redirects', async () => {
  const result = await check(undefined, { ok: true, json: async () => ({ offlineCapabilities: {
    commandReceipts: true, schemaReady: true, protocolVersions: [2], receiptEntityTypes: ['BATCH_EVENT'],
  } }) });
  assert.equal(result.calls[0].url, 'http://127.0.0.1:18080/api/version');
  assert.equal(result.calls[0].options.redirect, 'error');
  assert.equal(result.exitCode, 0);
});

test('a reachable local server without receipt readiness does not pass', async () => {
  const result = await check(undefined, { ok: true, json: async () => ({}) });
  assert.equal(result.exitCode, 1);
});
