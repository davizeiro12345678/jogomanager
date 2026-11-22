import { deferHomeHydration, shouldDeferHomeHydration } from "./lib/home-hydration";

const hydrate = () => {
  void import("./hydrate-app").then(({ hydrateApp }) => hydrateApp());
};

// Only the public homepage has a known, immediately discoverable LCP image.
// Game routes, OAuth callbacks, hidden tabs and other public pages must not
// wait for image/network conditions before restoring their React behaviors.
const publicHome = shouldDeferHomeHydration(
  document.documentElement.dataset["publicShell"] === "true",
  window.location.pathname,
  document.hidden,
);

if (publicHome) {
  deferHomeHydration(hydrate, {
    onHeroSettled(callback) {
      const hero = document.querySelector<HTMLImageElement>(".home-hero-image");
      if (!hero || hero.complete) {
        queueMicrotask(callback);
        return () => {};
      }
      hero.addEventListener("load", callback, { once: true });
      hero.addEventListener("error", callback, { once: true });
      return () => {
        hero.removeEventListener("load", callback);
        hero.removeEventListener("error", callback);
      };
    },
    onFirstInteraction(callback) {
      document.addEventListener("pointerdown", callback, { capture: true, passive: true });
      document.addEventListener("keydown", callback, { capture: true });
      return () => {
        document.removeEventListener("pointerdown", callback, true);
        document.removeEventListener("keydown", callback, true);
      };
    },
    afterTwoFrames(callback) {
      let second = 0;
      const first = requestAnimationFrame(() => {
        second = requestAnimationFrame(callback);
      });
      return () => {
        cancelAnimationFrame(first);
        if (second) cancelAnimationFrame(second);
      };
    },
    onIdle(callback) {
      if (typeof window.requestIdleCallback === "function") {
        const id = window.requestIdleCallback(callback, { timeout: 750 });
        return () => window.cancelIdleCallback(id);
      }
      const id = window.setTimeout(callback, 200);
      return () => window.clearTimeout(id);
    },
    onDeadline(callback, delayMs) {
      const id = window.setTimeout(callback, delayMs);
      return () => window.clearTimeout(id);
    },
  });
} else {
  const painted =
    document.documentElement.dataset["publicShell"] === "true" && !document.hidden
      ? new Promise<void>((resolve) => {
          const afterPaint = () =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
          if (document.readyState === "loading")
            document.addEventListener("DOMContentLoaded", afterPaint, { once: true });
          else afterPaint();
        })
      : Promise.resolve();
  void painted.then(hydrate);
}
