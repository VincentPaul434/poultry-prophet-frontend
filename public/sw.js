const CACHE_NAME = "poultry-prophet-shell-v3";
const OFFLINE_URL = "/offline";

async function cacheSuccessfulResponse(request, response) {
  if (response.status !== 200 || response.type === "opaque") return;
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  } catch {
    // A quota or cache error should not turn a successful network response into a failure.
  }
}

async function precacheDashboard(cache) {
  try {
    const dashboardUrl = new URL("/dashboard", self.location.origin);
    const response = await fetch(dashboardUrl, { cache: "reload" });
    if (response.status !== 200) return;

    await cache.put(dashboardUrl, response.clone());
    const html = await response.text();
    const assetUrls = [...html.matchAll(/(?:src|href)=["']([^"']*\/_next\/static\/[^"']+)["']/g)]
      .map((match) => new URL(match[1], self.location.origin))
      .filter((url) => url.origin === self.location.origin);

    await Promise.all(assetUrls.map(async (url) => {
      try {
        const assetResponse = await fetch(url, { cache: "reload" });
        if (assetResponse.status === 200) await cache.put(url, assetResponse);
      } catch {
        // Keep the cached offline route even when an optional asset is unavailable.
      }
    }));
  } catch {
    // The offline page remains available even if dashboard precaching fails.
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(async (cache) => {
    await cache.addAll([OFFLINE_URL, "/icon.svg"]);
    await precacheDashboard(cache);
    await self.skipWaiting();
  }));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => Promise.all(
      cacheNames
        .filter((name) => name.startsWith("poultry-prophet-shell-") && name !== CACHE_NAME)
        .map((name) => caches.delete(name)),
    )).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        await cacheSuccessfulResponse(request, response);
        return response;
      } catch {
        return (await caches.match(request)) || (await caches.match(OFFLINE_URL));
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    await cacheSuccessfulResponse(request, response);
    return response;
  })());
});
