/* eslint-disable @typescript-eslint/no-require-imports -- Node tests run this hook in an isolated VM. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

for (const [name, initial, acknowledgment, expected] of [
  ['clear', true, false, false],
  ['clear an omitted legacy value', true, undefined, false],
  ['set', false, true, true],
]) test(`a queued draft edit can ${name} a prior newer-data acknowledgment`, async () => {
  const existing = { id: 4, status: 'DRAFT', selectionDate: '2026-11-25', createdAt: '2026-11-25T00:00:00Z', evaluatedCount: 1, acceptedCount: 1, sourceDataAcknowledged: initial };
  const queued = { entityType: 'SELECTION_SESSION_UPDATE', batchId: 3, status: 'PENDING', queuedAt: '2026-11-25T00:01:00Z', payload: { sessionId: 4, ...(acknowledgment === undefined ? {} : { sourceDataAcknowledged: acknowledgment }) } };
  const mocks = {
    react: { useEffect() {} },
    '@tanstack/react-query': { useQuery: value => value, useQueryClient: () => ({}) },
    '@/lib/api': { selectionSessionApi: { list: async () => [existing] } },
    '@/lib/api-client': { shouldUseOfflineSnapshot: () => false },
    '@/lib/auth-context': { useAuth: () => ({ user: { userId: 1, farmId: 2 } }) },
    '@/lib/offline-sync-provider': {},
    '@/lib/offline-db': { listOutbox: async () => [queued], saveSelectionSessionSnapshot: async () => {} },
    '@/lib/query-keys': { qk: { batches: { selectionSessions: id => ['sessions', id] } } },
  };
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, '../hooks/use-selection-sessions.ts'), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(js, { exports, require: name => mocks[name], navigator: { onLine: true }, console });
  const result = await exports.useSelectionSessions(3).queryFn();
  assert.equal(result[0].sourceDataAcknowledged, expected);
  assert.equal(result[0].offlineSyncStatus, 'PENDING');
});
