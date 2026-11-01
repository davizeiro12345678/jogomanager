// Public articles already contain their readable HTML and critical CSS. Let
// that first paint finish before evaluating the application graph; parsing and
// hydration must not compete with rendering the text on slower mobile CPUs.
// Gameplay and hidden tabs never depend on paused animation callbacks.
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

void painted.then(() => import("./hydrate-app")).then(({ hydrateApp }) => hydrateApp());

export {};
