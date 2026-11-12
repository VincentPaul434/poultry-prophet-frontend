/* eslint-disable @typescript-eslint/no-require-imports -- Run focused tests without a Next server. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { financeCurrencyGroups, formatReviewAmount } = require('../lib/selection-review-finance.ts');

test('uses only currency-qualified groups and suppresses historical mixed totals', () => {
  assert.deepEqual(financeCurrencyGroups({ recordedIncome: 100 }), []);
  const groups = [{ currency: 'PHP', recordedIncome: 100 }, { currency: 'USD', recordedIncome: 30 }];
  assert.deepEqual(financeCurrencyGroups({ currencyTotals: groups }), groups);
});

test('formats each amount with its currency and keeps unavailable amounts unavailable', () => {
  assert.match(formatReviewAmount(100, 'PHP'), /₱/);
  assert.match(formatReviewAmount(30, 'USD'), /USD/);
  assert.equal(formatReviewAmount(null, 'USD'), '—');
});
