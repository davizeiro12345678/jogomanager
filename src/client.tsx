import {
  createDeferredClickReplay,
  deferHomeHydration,
  shouldDeferHomeHydration,
} from "./lib/home-hydration";

let hydrationPromise: Promise<void> | undefined;
const hydrate = () => {
  hydrationPromise ??= import("./hydrate-app").then(({ hydrateApp }) => {
    hydrateApp();
  });
  return hydrationPromise;
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
  // React's module can load before the home event handlers commit; replay
  // the first menu click only after FootballHome's effect confirms hydration.
  const menuReplay = createDeferredClickReplay(() => {
    queueMicrotask(() => document.querySelector<HTMLButtonElement>(".home-menu-button")?.click());
  });
  window.addEventListener("pfm:home-hydrated", () => menuReplay.markHydrated(), {
    once: true,
  });
  document.addEventListener(
    "click",
    (event) => {
      if (event.defaultPrevented) return;
      const menuButton =
        event.target instanceof Element
          ? event.target.closest<HTMLButtonElement>(".home-menu-button")
          : null;
      if (!menuButton || !menuReplay.queue()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      void hydrate();
    },
    true,
  );
  deferHomeHydration(
    () => {
      void hydrate();
    },
    {
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
    },
  );
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
  // Preserve the original eager module download for every other public
  // route; only the homepage should delay JavaScript until its LCP image.
  void Promise.all([import("./hydrate-app"), painted]).then(([{ hydrateApp }]) => hydrateApp());
}
