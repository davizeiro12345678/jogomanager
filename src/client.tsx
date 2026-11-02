// Public articles already contain their readable HTML and critical CSS. Let
// that first paint finish before evaluating the application graph; parsing and
// hydration must not compete with rendering the text on slower mobile CPUs.
// Non-public routes and hidden tabs never depend on paused animation callbacks.
const painted =
  document.documentElement.dataset["publicShell"] === "true" && !document.hidden
    ? new Promise<void>((resolve) => {
        let observer: PerformanceObserver | undefined;
        const finish = () => {
          observer?.disconnect();
          document.removeEventListener("visibilitychange", hidden);
          resolve();
        };
        const hidden = () => {
          if (document.hidden) finish();
        };
        document.addEventListener("visibilitychange", hidden);
        try {
          if (PerformanceObserver.supportedEntryTypes?.includes("paint")) {
            // Buffered observation also includes a paint before this module.
            observer = new PerformanceObserver((entries) => {
              if (entries.getEntries().some((entry) => entry.name === "first-contentful-paint"))
                finish();
            });
            observer.observe({ type: "paint", buffered: true });
            return;
          }
        } catch {
          // Missing or partial implementations fall back to animation frames.
          observer?.disconnect();
          observer = undefined;
        }
        const afterPaint = () => requestAnimationFrame(() => requestAnimationFrame(finish));
        if (document.readyState === "loading")
          document.addEventListener("DOMContentLoaded", afterPaint, { once: true });
        else afterPaint();
      })
    : Promise.resolve();

void painted
  .then(() => import("./hydrate-app"))
  .then(({ hydrateApp }) => setTimeout(hydrateApp, 0));

export {};
