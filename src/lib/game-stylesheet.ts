import appCss from "../styles.css?url";

/** The single URL of the full game stylesheet. The root head and the quick
 * match both use this `?url` asset; a second plain `import "@/styles.css"`
 * made the server build name the file differently from the browser build,
 * so every game page linked a missing stylesheet and painted unstyled. */
export const GAME_STYLESHEET_URL = appCss;

let pending: Promise<void> | undefined;

/** Adds the full game stylesheet on lightweight pages and waits until it applies. */
export function ensureGameStylesheet(): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  return (pending ??= new Promise<void>((resolve) => {
    const existing = Array.from(
      document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'),
    ).find((link) => link.getAttribute("href") === GAME_STYLESHEET_URL);
    if (existing) {
      resolve();
      return;
    }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = GAME_STYLESHEET_URL;
    // A failed stylesheet must not block the match; it still plays unstyled.
    link.onload = () => resolve();
    link.onerror = () => resolve();
    document.head.appendChild(link);
  }));
}

let cssPrefetched = false;

/**
 * Non-blocking, intent-only warmup for navigation from public content into
 * gameplay. The SSR page keeps its own public CSS; this never applies game
 * styles on a public route or blocks the first paint.
 */
export function prefetchGameStylesheet(): void {
  if (typeof document === "undefined" || cssPrefetched) return;
  const links = document.querySelectorAll<HTMLLinkElement>("link[href]");
  if (
    Array.from(links).some(
      (link) =>
        link.getAttribute("href") === GAME_STYLESHEET_URL &&
        (link.rel === "stylesheet" || link.rel === "prefetch"),
    )
  ) {
    cssPrefetched = true;
    return;
  }
  const link = document.createElement("link");
  link.rel = "prefetch";
  link.as = "style";
  link.href = GAME_STYLESHEET_URL;
  document.head.appendChild(link);
  cssPrefetched = true;
}
