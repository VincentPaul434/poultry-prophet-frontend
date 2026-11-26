/* eslint-disable @typescript-eslint/no-require-imports -- Standalone local QA server. */
const http = require('node:http');
const { randomUUID } = require('node:crypto');

// This fixture can send synthetic writes only to the disposable local API.
// Start explicitly with RUN_DISPOSABLE_RECOVERY=true and verify that port
// 18081 uses a disposable database before starting the gate.
if (process.env.RUN_DISPOSABLE_RECOVERY !== 'true') throw new Error('Explicit local QA opt-in is required.');
const port = Number(process.env.RECOVERY_QA_PORT || 18083);
if (![18083, 18084].includes(port)) throw new Error('Only the reserved local QA ports are allowed.');
const gateId = randomUUID();
let mode = 'ready';
const counts = { refresh: 0, sync: 0, dropped: 0 };

async function main() {
  const response = await fetch('http://127.0.0.1:18081/api/version');
  const version = await response.json();
  if (!response.ok || version.environment !== 'validation' || !version.offlineCapabilities?.schemaReady || !version.offlineCapabilities?.commandReceipts) {
    throw new Error('The loopback backend is not ready for disposable receipt-backed QA.');
  }
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    if (url.pathname === '/__qa/control') {
      const requested = url.searchParams.get('mode');
      if (!['ready', 'unavailable', 'drop-sync-once'].includes(requested)) { res.writeHead(400).end(); return; }
      mode = requested;
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ gateId, mode, counts }));
      return;
    }
    if (url.pathname === '/__qa/status') {
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ gateId, mode, counts }));
      return;
    }
    if (mode === 'unavailable') {
      res.writeHead(503, { 'content-type': 'application/json', 'x-disposable-qa-gate': gateId }).end('{"message":"synthetic backend outage"}');
      return;
    }
    if (url.pathname === '/api/auth/refresh') counts.refresh++;
    const sync = url.pathname === '/api/sync/v2/operations' && req.method === 'POST';
    if (sync) counts.sync++;
    const upstream = http.request({ hostname: '127.0.0.1', port: 18081, path: req.url, method: req.method, headers: { ...req.headers, host: '127.0.0.1:18081' } }, (result) => {
      if (sync && mode === 'drop-sync-once' && result.statusCode >= 200 && result.statusCode < 300) {
        result.resume();
        result.on('end', () => {
          mode = 'ready'; counts.dropped++;
          res.writeHead(504, { 'content-type': 'application/json', 'x-disposable-qa-gate': gateId }).end('{"message":"synthetic lost acknowledgement"}');
        });
        return;
      }
      res.writeHead(result.statusCode, { ...result.headers, 'x-disposable-qa-gate': gateId });
      result.pipe(res);
    });
    upstream.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end(); });
    req.pipe(upstream);
  });
  server.listen(port, '127.0.0.1', () => console.log(`Disposable QA gate listening on 127.0.0.1:${port}, upstream fixed to 127.0.0.1:18081.`));
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
