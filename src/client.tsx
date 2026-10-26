// Discover mandatory runtime dependencies immediately instead of placing their
// downloads behind two animation frames. Public SSR content still paints
// before hydration; hidden tabs never depend on paused animation callbacks.
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

void Promise.all([import("./hydrate-app"), painted]).then(([{ hydrateApp }]) => hydrateApp());
