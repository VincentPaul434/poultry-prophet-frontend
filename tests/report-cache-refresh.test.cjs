/* eslint-disable @typescript-eslint/no-require-imports -- Exercise actual mutation callbacks with a real query cache. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { QueryClient } = require('@tanstack/react-query');
const { loadOperations } = require('./helpers/load-operations.cjs');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { qk } = require('../lib/query-keys.ts');

test('a posted batch expense marks both current and dated reports stale while other batch reports stay fresh', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  const keys = [qk.batches.detail(7), qk.batches.selectionReviewPreview(7), qk.batches.selectionReviewPreview(7, { periodStart: '2026-01-01' }), qk.batches.selectionReviews(7), qk.batches.selectionReviewPreview(9)];
  for (const key of keys) client.setQueryData(key, { total: 100 });
  const { hooks } = loadOperations({ queryClient: client, queryKeys: { qk }, financeApi: { create: async body => ({ id: 1, ...body }) } });
  const mutation = hooks.useCreateFinanceTransaction();
  const body = { batchId: 7, type: 'EXPENSE', amount: 50, currency: 'PHP' };
  await mutation.onSuccess(await mutation.mutationFn(body), body);
  for (const key of keys.slice(0, -1)) assert.equal(client.getQueryState(key).isInvalidated, true, `stale cost remained in ${JSON.stringify(key)}`);
  assert.equal(client.getQueryState(keys.at(-1)).isInvalidated, false);
  client.clear();
});
