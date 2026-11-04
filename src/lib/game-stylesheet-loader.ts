import { GAME_STYLESHEET_URL } from "./game-stylesheet";

let pending: Promise<void> | undefined;

/** Hint at the game CSS only after a visitor indicates intent to play. */
export function prefetchGameStylesheet(): void {
  if (typeof document === "undefined") return;
  const alreadyRequested = Array.from(document.querySelectorAll<HTMLLinkElement>("link")).some(
    (link) => link.getAttribute("href") === GAME_STYLESHEET_URL,
  );
  if (alreadyRequested) return;
  const link = document.createElement("link");
  link.rel = "prefetch";
  link.as = "style";
  link.href = GAME_STYLESHEET_URL;
  document.head.appendChild(link);
}

/** Adds the full game stylesheet on lightweight pages and waits until it applies. */
export function ensureGameStylesheet(): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  if (pending) return pending;
  let existing = Array.from(
    document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'),
  ).find((link) => link.getAttribute("href") === GAME_STYLESHEET_URL);
  if (existing?.sheet) return Promise.resolve();
  // Once the document has loaded, a link without a sheet may have failed
  // before listeners were attached. Replace it so play cannot wait forever.
  if (existing && document.readyState === "complete") {
    existing.remove();
    existing = undefined;
  }
  const link = existing ?? document.createElement("link");
  if (!existing) {
    link.rel = "stylesheet";
    link.href = GAME_STYLESHEET_URL;
  }
  const loaded = new Promise<boolean>((resolve) => {
    const cleanup = () => {
      link.removeEventListener("load", onLoad);
      link.removeEventListener("error", onError);
    };
    const onLoad = () => {
      cleanup();
      resolve(true);
    };
    const onError = () => {
      cleanup();
      link.remove();
      resolve(false);
    };
    link.addEventListener("load", onLoad);
    link.addEventListener("error", onError);
    if (!existing) document.head.appendChild(link);
  });
  pending = loaded.then(() => {
    // Recheck the link on later navigation; a failed load must not block play.
    pending = undefined;
  });
  return pending;
}
