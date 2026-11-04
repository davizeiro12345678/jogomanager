import { GAME_STYLESHEET_URL } from "./game-stylesheet";

let pending: Promise<void> | undefined;

/**
 * Quick play starts with public CSS and waits for the full gameplay stylesheet.
 * Keep this logic out of root hydration; it is imported on demand.
 */
export function ensureGameStylesheet(): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  return (pending ??= new Promise<void>((resolve, reject) => {
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
    link.onload = () => resolve();
    link.onerror = () => {
      pending = undefined;
      link.remove();
      reject(new Error("Gameplay stylesheet could not be loaded"));
    };
    document.head.appendChild(link);
  }));
}
