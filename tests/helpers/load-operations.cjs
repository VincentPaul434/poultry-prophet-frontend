/* eslint-disable @typescript-eslint/no-require-imports -- Node tests execute the client modules in an isolated CommonJS VM. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
class ApiError extends Error { constructor(message, status) { super(message); this.status = status; } }
function loadOperations({ online = false, createInput = async () => ({ id: 10 }), enqueue, vaccinationApi = {}, batchApi = {}, taskApi = {}, financeApi = {}, inventoryApi = {}, managerApi = {}, queryClient = {}, queryKeys = {}, managerIntents = {}, auth = {}, offlineDb = {} } = {}) {
  const queued = [];
  const exports = {};
  const mocks = {
    '@tanstack/react-query': { useMutation: x => x, useQuery: x => x, useQueryClient: () => queryClient },
    '@/lib/api': { inputApi: { create: createInput }, vaccinationApi, batchApi, taskApi, financeApi, inventoryApi, managerApi },
    '@/lib/api-client': { ApiError, shouldUseOfflineSnapshot: error => error instanceof ApiError && (error.status === 0 || error.status >= 500) },
    '@/lib/offline-sync-provider': { useOfflineSync: () => ({ enqueue: async x => { if (enqueue) await enqueue(x); queued.push(structuredClone(x)); return {operationId:x.payload.operationId}; } }) },
    '@/lib/offline-db': offlineDb, '@/lib/auth-context': { useAuth: () => ({ user: auth.user ?? { userId: 1, farmId: 2, role: 'MANAGER' } }) }, '@/lib/query-keys': queryKeys,
    '@/lib/auth-storage': { getSessionScope: () => auth.getSessionScope ? auth.getSessionScope() : 'fixture-session', getStoredUser: () => auth.getStoredUser ? auth.getStoredUser() : (auth.user ?? { userId: 1, farmId: 2, role: 'MANAGER' }) },
    '@/lib/uuid': { newSecureUuid: () => require('node:crypto').randomUUID() },
    '@/lib/manager-intents': { prepareManagerIntent: async (scope, payload) => ({...scope, payload, operationId:'fixture-operation'}), resolveManagerIntent: async () => true, financeIntentTarget: body => body.batchId == null ? 'farm' : String(body.batchId), ...managerIntents },
  };
  const source = fs.readFileSync(path.join(__dirname, '../../hooks/use-operations.ts'), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,
    { exports, require: name => { if (!(name in mocks)) throw new Error(name); return mocks[name]; }, navigator: {onLine:online}, crypto:require('node:crypto').webcrypto, structuredClone });
  return { hooks: exports, queued };
}
module.exports = { loadOperations, ApiError };
