import { GAME_STYLESHEET_URL } from "./game-stylesheet";

let pending: Promise<void> | undefined;

/** Quick play needs the full game CSS before the 3D UI becomes visible. */
export function ensureGameStylesheet(): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  if (document.querySelector(`link[rel="stylesheet"][href="${GAME_STYLESHEET_URL}"]`))
    return Promise.resolve();
  return (pending ??= new Promise<void>((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = GAME_STYLESHEET_URL;
    link.onload = () => resolve();
    link.onerror = () => {
      pending = undefined;
      link.remove();
      reject(new Error("Game CSS unavailable"));
    };
    document.head.append(link);
  }));
}
