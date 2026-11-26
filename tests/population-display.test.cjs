/* eslint-disable @typescript-eslint/no-require-imports -- Isolated dependencies exercise actual client query functions. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX,
  }}).outputText, { exports, require: name => { if (!(name in mocks)) throw new Error(name); return mocks[name]; } });
  return exports;
}
const { qk } = load('lib/query-keys.ts', {});
const { pendingPopulation } = load('lib/pending-population.ts', {});
const row = (overrides = {}) => ({ userId: 1, farmId: 2, batchId: 35, entityType: 'BATCH_EVENT', status: 'RETRY_WAIT', operationId: 'death-50', payload: { eventType: 'HEALTH_DEATH', affectedCount: 50 }, ...overrides });

test('pending death notices exclude other owners and rejected changes and deduplicate original UUIDs', () => {
  const rows = [row(), row(), row({ userId: 9 }), row({ farmId: 9 }), row({ batchId: 9 }),
    row({ operationId: 'rejected', status: 'REJECTED' }), row({ operationId: 'conflict', status: 'CONFLICT' }),
    row({ operationId: 'health', payload: { eventType: 'HEALTH_CONCERN', affectedCount: 50 } })];
  assert.deepEqual(JSON.parse(JSON.stringify(pendingPopulation(rows, 1, 2, 35))), { pendingRecords: 1, deaths: 50, issues: 2 });
});

for (const confirmed of [200, 150]) test(`offline cards and detail retain ${confirmed} confirmed birds despite an uncertain 50-death acknowledgement`, async () => {
  const batch = { id: 35, initialPopulation: 200, currentPopulation: confirmed };
  const hooks = load('hooks/use-batches.ts', {
    react: { useEffect: () => {} }, '@tanstack/react-query': { useQuery: x => x, useQueryClient: () => ({}) },
    '@/lib/auth-context': { useAuth: () => ({ user: { userId: 1, farmId: 2 } }) }, '@/lib/query-keys': { qk },
    '@/lib/api-client': { shouldUseOfflineSnapshot: () => true }, '@/lib/api': { batchApi: {
      list: async () => { throw new Error('offline'); }, get: async () => { throw new Error('offline'); },
      overview: async () => { throw new Error('offline'); }, dashboard: async () => { throw new Error('offline'); },
    } }, '@/lib/offline-db': { getBatchSnapshots: async () => [batch], getBatchSnapshot: async () => batch,
      getBatchOverviewSnapshot: async () => ({ batch }), getDashboardSnapshot: async () => [{ batch }],
      getQueuedPopulationDelta: async () => -50 },
  });
  assert.equal((await hooks.useBatches().queryFn())[0].currentPopulation, confirmed);
  assert.equal((await hooks.useBatch(35).queryFn()).currentPopulation, confirmed);
  assert.equal((await hooks.useBatchOverview(35).queryFn()).batch.currentPopulation, confirmed);
  assert.equal((await hooks.useDashboardBatches().queryFn())[0].batch.currentPopulation, confirmed);
});

test('summary uses the same confirmed batch count instead of an older report population', () => {
  const jsx = (type, props) => ({ type: typeof type === 'function' ? type.name : type, props });
  const report = { batch: { currentPopulationDisplay: '200 / 200' }, population: {
    totalDeaths: 50, predation: 0, missing: 0, returned: 0, transfersOut: 0, transfersIn: 0, sales: 0, culling: 0, countCorrections: 0,
  }, periodStart: '2026-11-19', periodEnd: '2026-11-25' };
  const { SelectionReviewSummary } = load('components/selection-review-summary.tsx', {
    'react/jsx-runtime': { jsx, jsxs: jsx }, 'lucide-react': {}, '@/lib/format': { formatDate: x => x },
    '@/lib/auth-context': { useAuth: () => ({ isManager: false }) }, '@/components/locale-provider': { useLocale: () => ({ display: value => value }) }, '@/lib/selection-review-finance': {},
    '@/hooks/use-selection-review': { useSelectionReviewPreview: () => ({ data: report }) },
    '@/components/population-pending-notice': {}, '@/components/editable-sex-composition-metric': {},
  });
  const values = [];
  function visit(node) { if (!node) return; if (Array.isArray(node)) return node.forEach(visit); if (node.type === 'SummaryMetric') values.push(node.props); visit(node.props?.children); }
  visit(SelectionReviewSummary({ batch: { id: 35, initialPopulation: 200, currentPopulation: 150, populationStatus: 'VALID' } }));
  assert.equal(values.find(x => x.label === 'Population').value, '150 / 200');
  assert.equal(values.find(x => x.label === 'Total deaths').value, '50');
});
