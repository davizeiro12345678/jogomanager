// Public articles already contain their readable HTML and critical CSS. Let
// that first paint finish before evaluating the application graph; parsing and
// hydration must not compete with rendering the text on slower mobile CPUs.
// Non-public routes and hidden tabs never depend on paused animation callbacks.
const painted =
  document.documentElement.dataset["publicShell"] === "true" && !document.hidden
    ? new Promise<void>((resolve) => {
        if (
          typeof PerformanceObserver !== "undefined" &&
          PerformanceObserver.supportedEntryTypes?.includes("paint")
        ) {
          // Animation callbacks can run while text is still waiting for fonts.
          // Observe the actual paint, including one that preceded this module.
          let observer: PerformanceObserver | undefined;
          const finish = () => {
            observer?.disconnect();
            document.removeEventListener("visibilitychange", hidden);
            resolve();
          };
          const hidden = () => {
            if (document.hidden) finish();
          };
          try {
            observer = new PerformanceObserver((entries) => {
              if (entries.getEntries().some((entry) => entry.name === "first-contentful-paint"))
                finish();
            });
            document.addEventListener("visibilitychange", hidden);
            observer.observe({ type: "paint", buffered: true });
            return;
          } catch {
            // Partial implementations must still hydrate the public document.
            observer?.disconnect();
            document.removeEventListener("visibilitychange", hidden);
          }
        }
        const afterPaint = () =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        if (document.readyState === "loading")
          document.addEventListener("DOMContentLoaded", afterPaint, { once: true });
        else afterPaint();
      })
    : Promise.resolve();

void painted.then(() => import("./hydrate-app")).then(({ hydrateApp }) => hydrateApp());

export {};
