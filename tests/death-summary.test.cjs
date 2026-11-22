/* eslint-disable @typescript-eslint/no-require-imports -- Focused tests run directly under Node. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const api = { page: async () => { throw new Error('Unexpected API call'); } };
const originalLoad = Module._load;
Module._load = function (name, ...args) {
  if (name === '@/lib/api') return { batchEventApi: api };
  return originalLoad.call(this, name, ...args);
};
const { fetchDeathEvents, collectDeathNotes } = require('../lib/death-summary.ts');
Module._load = originalLoad;

test('reads every death-event page with an explicit period and category', async () => {
  const calls = [];
  api.page = async (batchId, params) => {
    calls.push({ batchId, ...params });
    const id = params.type === 'HEALTH_DEATH' ? params.page + 1 : params.page + 10;
    return { page: params.page, hasNext: params.type === 'HEALTH_DEATH' && params.page === 0, items: [{ id, eventType: params.type }] };
  };
  const events = await fetchDeathEvents(16, '2026-10-05', '2026-11-19');
  assert.deepEqual(events.map(item => item.id).sort((a, b) => a - b), [1, 2, 10]);
  assert.equal(calls.length, 3);
  assert.ok(calls.every(call => call.batchId === 16 && call.size === 100 && call.start === '2026-10-05' && call.end === '2026-11-19'));
});

test('fails instead of returning an incomplete or inconsistent event list', async () => {
  api.page = async (batchId, params) => {
    if (params.type === 'HEALTH_DEATH' && params.page === 1) throw new Error('Network unavailable');
    return { page: params.page, hasNext: params.type === 'HEALTH_DEATH', items: [{ id: 1, eventType: params.type }] };
  };
  await assert.rejects(fetchDeathEvents(16, '2026-10-05', '2026-11-19'), /Network unavailable/);
  api.page = async (batchId, params) => ({ page: params.page, hasNext: true, items: [] });
  await assert.rejects(fetchDeathEvents(16, '2026-10-05', '2026-11-19'), /could not be loaded completely/);
});

test('deduplicates recorded notes without inventing causes from event categories', () => {
  assert.deepEqual(collectDeathNotes([
    { eventType: 'HEALTH_DEATH', title: 'Health-related death', details: null },
    { eventType: 'HEALTH_DEATH', title: 'Respiratory signs', details: '  Suspected illness  ', tags: 'Labored breathing, respiratory signs' },
    { eventType: 'HEALTH_DEATH', title: 'RESPIRATORY SIGNS', details: 'suspected   illness', tags: 'LABORED BREATHING' },
    { eventType: 'ACCIDENTAL_DEATH', title: 'Accidental death', details: 'N/A', tags: 'SALE_PURPOSE:BREEDING, Unknown' },
    { eventType: 'ACCIDENTAL_DEATH', title: 'Accidental death', details: 'Found near fence' },
    { eventType: 'HEALTH_CONCERN', title: 'Unrelated concern', details: 'Not a death record' },
  ]), { HEALTH_DEATH: ['Respiratory signs', 'Suspected illness', 'Labored breathing'], ACCIDENTAL_DEATH: ['Found near fence'] });
});

test('keeps an explicit lack of signs distinct from an unknown observation', () => {
  assert.deepEqual(collectDeathNotes([
    { eventType: 'HEALTH_DEATH', title: 'Health-related death', details: 'No signs noticed.' },
    { eventType: 'HEALTH_DEATH', title: 'Health-related death', details: 'Signs not observed / unknown.' },
  ]).HEALTH_DEATH, ['No signs noticed.', 'Signs not observed / unknown.']);
});
