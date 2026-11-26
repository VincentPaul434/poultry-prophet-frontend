#!/usr/bin/env node

// Local-only verification. No farm records are sent or recreated.
try {
  const url = new URL(process.argv[2] ?? "http://127.0.0.1:18080/api/version");
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
    || url.username || url.password) {
    throw new Error("Use an HTTP loopback URL. No request was sent.");
  }
  const response = await fetch(url, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Local version endpoint returned HTTP ${response.status}`);
  const metadata = await response.json();
  const capability = metadata.offlineCapabilities;
  const ready = capability?.commandReceipts === true && capability.schemaReady === true
    && capability.protocolVersions?.includes(2) && capability.receiptEntityTypes?.includes("BATCH_EVENT");
  console.log(`Local backend: death-event syncing ${ready ? "ready" : "unavailable"}.`);
  if (!ready) {
    console.error("Start the isolated backend with scripts/validation-up.sh. It prepares local command receipts before enabling syncing. Keep existing queued records and their original IDs.");
    process.exitCode = 1;
  }
} catch (error) {
  console.error(`Could not verify local syncing: ${error instanceof Error ? error.message : "request failed"}`);
  process.exitCode = 1;
}
