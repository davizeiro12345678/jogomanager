// Paint public SSR content before evaluating the client dependency graph.
// Waiting only to call hydrateRoot still lets imported modules block the paint.
// Hidden documents must not depend on paused animation callbacks.
const painted =
  document.documentElement.dataset["publicShell"] === "true" && !document.hidden
    ? new Promise<void>((resolve) => {
        const done = () => {
          document.removeEventListener("visibilitychange", onHidden);
          resolve();
        };
        const onHidden = () => {
          if (document.hidden) done();
        };
        document.addEventListener("visibilitychange", onHidden);
        const afterPaint = () => requestAnimationFrame(() => requestAnimationFrame(done));
        if (document.readyState === "loading")
          document.addEventListener("DOMContentLoaded", afterPaint, { once: true });
        else afterPaint();
      })
    : Promise.resolve();

void painted.then(() => import("./hydrate-app")).then(({ hydrateApp }) => hydrateApp());

export {};
