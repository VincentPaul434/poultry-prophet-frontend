"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { useLocale } from "@/components/locale-provider";

export function ServiceWorkerRegistration() {
  const { t } = useLocale();
  useEffect(() => {
    let failureReported = false;
    const reportFailure = (error?: unknown) => {
      if (failureReported) return;
      failureReported = true;
      console.error("Poultry Prophet offline app setup failed.", error);
      toast.error(t("status.offlineSetupFailed"), {
        description: t("status.offlineSetupHint"),
      });
    };

    if (!("serviceWorker" in navigator)) {
      reportFailure(new Error("Service workers are not supported in this browser."));
      return;
    }

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

    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).then((registration) => {
      const watchInstall = () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "redundant" && !registration.active) {
            reportFailure(new Error("The offline app shell could not be cached."));
          }
        });
      };
      watchInstall();
      registration.addEventListener("updatefound", watchInstall);
    }).catch(reportFailure);
  }, [t]);
  return null;
}
