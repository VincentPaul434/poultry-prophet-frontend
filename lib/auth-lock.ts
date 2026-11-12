// A committed lease is shared by all tabs, including those without Web Locks.
// Never steal an expired lease: its owner may still have a cookie-changing
// request in flight. An abandoned lease deliberately blocks future mutations.
const DATABASE = "poultry-prophet-auth-lock";
const STORE = "leases";
const KEY = "credentials";
const LEASE_MS = 15_000;
const RENEW_MS = 3_000;
const WAIT_MS = 60_000;

type Lease = { owner: string | null; fence: number; expiresAt: number };
type Claim = { kind: "acquired"; fence: number } | { kind: "busy" } | { kind: "abandoned" };

export class AuthLockError extends Error {
  constructor() { super("Unable to safely coordinate sign-in across tabs."); }
}

function unavailable(): AuthLockError {
  return new AuthLockError();
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(unavailable());
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => { settled = true; reject(unavailable()); }, 5_000);
    let request: IDBOpenDBRequest;
    try { request = indexedDB.open(DATABASE, 1); }
    catch { clearTimeout(timer); reject(unavailable()); return; }
    request.onupgradeneeded = () => { request.result.createObjectStore(STORE); };
    request.onerror = () => { clearTimeout(timer); if (!settled) { settled = true; reject(unavailable()); } };
    request.onblocked = () => { clearTimeout(timer); if (!settled) { settled = true; reject(unavailable()); } };
    request.onsuccess = () => {
      clearTimeout(timer);
      if (settled) { request.result.close(); return; }
      settled = true;
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });
}

function updateLease<T>(db: IDBDatabase, update: (lease: Lease | undefined, store: IDBObjectStore) => T): Promise<T> {
  return new Promise((resolve, reject) => {
    let result: T;
    let tx: IDBTransaction;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      tx = db.transaction(STORE, "readwrite");
      timer = setTimeout(() => {
        try { tx.abort(); } catch { /* The transaction may already be inactive. */ }
        reject(unavailable());
      }, 10_000);
      const store = tx.objectStore(STORE);
      const read = store.get(KEY);
      read.onsuccess = () => {
        try { result = update(read.result as Lease | undefined, store); }
        catch { tx.abort(); }
      };
      tx.oncomplete = () => { clearTimeout(timer); resolve(result); };
      tx.onabort = () => { clearTimeout(timer); reject(unavailable()); };
      tx.onerror = () => { clearTimeout(timer); reject(unavailable()); };
    } catch { clearTimeout(timer); reject(unavailable()); }
  });
}

export async function withIndexedDbAuthLock<T>(operation: () => Promise<T>): Promise<T> {
  const db = await openDatabase();
  const owner = crypto.randomUUID();
  const deadline = Date.now() + WAIT_MS;
  let fence: number | undefined;
  try {
    while (fence === undefined) {
      const claim = await updateLease<Claim>(db, (lease, store) => {
        const now = Date.now();
        if (lease?.owner) return { kind: lease.expiresAt > now ? "busy" : "abandoned" };
        const next = (lease?.fence ?? 0) + 1;
        store.put({ owner, fence: next, expiresAt: now + LEASE_MS } satisfies Lease, KEY);
        return { kind: "acquired", fence: next };
      });
      if (claim.kind === "abandoned" || Date.now() >= deadline) throw unavailable();
      if (claim.kind === "acquired") fence = claim.fence;
      else await new Promise(resolve => setTimeout(resolve, 50));
    }
    const heldFence = fence;
    let lost = false;
    let renewing = false;
    const renew = async () => {
      if (renewing || lost) return;
      renewing = true;
      try {
        const ok = await updateLease(db, (lease, store) => {
          if (!lease || lease.owner !== owner || lease.fence !== heldFence || lease.expiresAt <= Date.now()) return false;
          store.put({ ...lease, expiresAt: Date.now() + LEASE_MS }, KEY);
          return true;
        });
        if (!ok) lost = true;
      } catch { lost = true; }
      finally { renewing = false; }
    };
    const timer = setInterval(() => { void renew(); }, RENEW_MS);
    try {
      return await operation();
    } finally {
      clearInterval(timer);
      // The fenced lease is cleared only if its ownership is still certain.
      if (!lost) {
        const released = await updateLease(db, (lease, store) => {
          if (!lease || lease.owner !== owner || lease.fence !== heldFence || lease.expiresAt <= Date.now()) return false;
          store.put({ owner: null, fence: heldFence, expiresAt: 0 } satisfies Lease, KEY);
          return true;
        });
        if (!released) throw unavailable();
      } else throw unavailable();
    }
  } finally { db.close(); }
}
