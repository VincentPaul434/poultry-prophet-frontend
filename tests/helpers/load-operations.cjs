/* eslint-disable @typescript-eslint/no-require-imports -- Node tests execute the client modules in an isolated CommonJS VM. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
class ApiError extends Error { constructor(message, status) { super(message); this.status = status; } }
function loadOperations({ online = false, createInput = async () => ({ id: 10 }), enqueue, vaccinationApi = {}, batchApi = {}, taskApi = {} } = {}) {
  const queued = [];
  const exports = {};
  const mocks = {
    '@tanstack/react-query': { useMutation: x => x, useQueryClient: () => ({}) },
    '@/lib/api': { inputApi: { create: createInput }, vaccinationApi, batchApi, taskApi },
    '@/lib/api-client': { ApiError },
    '@/lib/offline-sync-provider': { useOfflineSync: () => ({ enqueue: async x => { if (enqueue) await enqueue(x); queued.push(structuredClone(x)); return {operationId:x.payload.operationId}; } }) },
    '@/lib/offline-db': {}, '@/lib/auth-context': {}, '@/lib/query-keys': {},
  };
  const source = fs.readFileSync(path.join(__dirname, '../../hooks/use-operations.ts'), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,
    { exports, require: name => { if (!(name in mocks)) throw new Error(name); return mocks[name]; }, navigator: {onLine:online}, crypto:require('node:crypto').webcrypto, structuredClone });
  return { hooks: exports, queued };
}
module.exports = { loadOperations, ApiError };
