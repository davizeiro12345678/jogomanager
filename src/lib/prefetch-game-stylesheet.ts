import { GAME_STYLESHEET_URL } from "./game-stylesheet";

let prefetched = false;

/** Warm the game CSS only after a local navigation gesture, never on first paint. */
export function prefetchGameStylesheet(): void {
  if (typeof document === "undefined" || prefetched) return;
  if (document.querySelector(`link[href="${GAME_STYLESHEET_URL}"]`)) return;
  const link = document.createElement("link");
  link.rel = "prefetch";
  link.as = "style";
  link.href = GAME_STYLESHEET_URL;
  link.onerror = () => {
    prefetched = false;
    link.remove();
  };
  prefetched = true;
  document.head.append(link);
}
