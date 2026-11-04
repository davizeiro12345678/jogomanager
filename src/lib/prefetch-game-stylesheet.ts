import { GAME_STYLESHEET_URL } from "./game-stylesheet";

let cssPrefetched = false;

/** Non-blocking CSS warmup, loaded only on navigation intent. */
export function prefetchGameStylesheet(): void {
  if (typeof document === "undefined" || cssPrefetched) return;
  const links = document.querySelectorAll<HTMLLinkElement>(
    'link[rel="stylesheet"],link[rel="prefetch"]',
  );
  if (Array.from(links).some((link) => link.getAttribute("href") === GAME_STYLESHEET_URL)) {
    cssPrefetched = true;
    return;
  }
  const link = document.createElement("link");
  link.rel = "prefetch";
  link.as = "style";
  link.href = GAME_STYLESHEET_URL;
  link.onerror = () => {
    cssPrefetched = false;
    link.remove();
  };
  document.head.appendChild(link);
  cssPrefetched = true;
}
