"use client";

import { useEffect } from "react";
import { getNavigationBuildId } from "next/dist/client/navigation-build-id";
import { toast } from "sonner";
import { useLocale } from "@/components/locale-provider";

export function ServiceWorkerRegistration() {
  const { t } = useLocale();
  useEffect(() => {
    let failureReported = false;
    let refreshReported = false;
    let disposed = false;
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
        await Promise.all(registrations.filter((registration) => {
          const worker = registration.active ?? registration.waiting ?? registration.installing;
          if (!worker || registration.scope !== `${window.location.origin}/`) return false;
          const script = new URL(worker.scriptURL);
          return script.origin === window.location.origin && script.pathname === "/sw.js";
        }).map((registration) => registration.unregister()));
        // Unregistering affects future navigation. Existing controlled pages
        // can still be open, so their deployment caches must remain available.
        // Neither development cleanup nor updates may clear the record outbox.
      }).catch(reportFailure);
      return;
    }

    // Next initializes this with the deployment ID (when configured) or build ID
    // before hydration. Changing the script URL installs a fresh cache per build.
    const version = getNavigationBuildId();
    if (!version) {
      reportFailure(new Error("The app deployment identifier is unavailable."));
      return;
    }

    void navigator.serviceWorker.register(`/sw.js?version=${encodeURIComponent(version)}`, {
      scope: "/",
      updateViaCache: "none",
    }).then((registration) => {
      const reportRefreshNeeded = () => {
        if (disposed || refreshReported || navigator.serviceWorker.controller || !registration.active) return;
        refreshReported = true;
        toast.info(t("status.offlineRefreshRequired"), {
          description: t("status.offlineRefreshHint"),
          duration: 8_000,
          position: "bottom-center",
          closeButton: true,
          style: { pointerEvents: "none" },
          classNames: { closeButton: "!pointer-events-auto" },
        });
      };
      reportRefreshNeeded();
      const watchInstall = () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "activated") reportRefreshNeeded();
          if (worker.state === "redundant" && !registration.active) {
            reportFailure(new Error("The offline app shell could not be cached."));
          }
        });
      };
      watchInstall();
      registration.addEventListener("updatefound", watchInstall);
    }).catch(reportFailure);
    return () => { disposed = true; };
  }, [t]);
  return null;
}
