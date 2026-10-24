const hydrate = () => void import("./hydrate-app").then(({ hydrateApp }) => hydrateApp());

// Paint the complete SSR document before downloading and evaluating React's
// interactive runtime. Native links remain usable while hydration loads.
// Hidden tabs hydrate immediately because their animation frames may pause.
if (document.documentElement.dataset["publicShell"] === "true" && !document.hidden) {
  const afterPaint = () => requestAnimationFrame(() => requestAnimationFrame(hydrate));
  // A streamed document can execute this small module before its visible
  // article has arrived. Wait for the actual document before yielding a paint.
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", afterPaint, { once: true });
  else afterPaint();
} else hydrate();
