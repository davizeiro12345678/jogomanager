const { dataset } = document.documentElement;
const visiblePublicShell = dataset["publicShell"] === "true" && !document.hidden;
const deferRuntime = visiblePublicShell && dataset["editorialShell"] === "true";

// Public SSR content paints before hydration. Hidden tabs never depend on
// animation callbacks, which browsers can pause in the background.
const painted = visiblePublicShell
  ? new Promise<void>((resolve) => {
      const finish = () => {
        if (deferRuntime) {
          document.removeEventListener("visibilitychange", finishWhenHidden);
          document.removeEventListener("DOMContentLoaded", afterPaint);
        }
        resolve();
      };
      const afterPaint = () => requestAnimationFrame(() => requestAnimationFrame(finish));
      const finishWhenHidden = () => {
        if (document.hidden) finish();
      };
      if (deferRuntime) document.addEventListener("visibilitychange", finishWhenHidden);
      if (document.readyState === "loading")
        document.addEventListener("DOMContentLoaded", afterPaint, { once: true });
      else afterPaint();
    })
  : Promise.resolve();

const loadRuntime = () => import("./hydrate-app");
// The guide text is in the server HTML. Give the browser a rendering
// opportunity before Vite preloads the hydration dependency graph.
const runtime = deferRuntime ? painted.then(loadRuntime) : loadRuntime();

void Promise.all([runtime, painted]).then(([{ hydrateApp }]) => hydrateApp());

export {};
