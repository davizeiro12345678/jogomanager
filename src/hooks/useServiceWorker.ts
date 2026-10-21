import { useEffect } from "react";

/** Registra o service worker (jogo instalável e utilizável sem internet). */
export function useServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const isPreview =
      import.meta.env.DEV ||
      window.location.hostname.includes("lovableproject.com") ||
      window.location.hostname.includes("-preview--");
    if (isPreview) {
      void navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
          Promise.all(registrations.map((registration) => registration.unregister())),
        );
      return;
    }
    const id = window.setTimeout(() => {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }, 1200);
    return () => window.clearTimeout(id);
  }, []);
}
