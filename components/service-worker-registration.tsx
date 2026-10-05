"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Never let a worker from an older production run mask the current local
    // development bundle. This is especially important for UI work because
    // static Next.js assets are cache-first in the offline shell.
    if (process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_ENABLE_OFFLINE !== "true") {
      void navigator.serviceWorker.getRegistrations().then(async (registrations) => {
        await Promise.all(registrations.map((registration) => registration.unregister()));
        if ("caches" in window) {
          const cacheNames = await caches.keys();
          await Promise.all(
            cacheNames
              .filter((name) => name.startsWith("poultry-prophet-shell-"))
              .map((name) => caches.delete(name)),
          );
        }
      });
      return;
    }

    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
  }, []);
  return null;
}
