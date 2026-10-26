import { useEffect, useState, useSyncExternalStore, type RefObject } from "react";
import { cinematicOverlayActive, subscribeCinematicOverlay } from "@/game/cinematic-overlay";

/** Keep the context and character mounted, but stop animation outside the
 * visible page. Re-entry therefore preserves the model and avoids shader/rig rebuilds. */
export function useVisibleGraphics<T extends Element>(host: RefObject<T | null>) {
  const [inViewport, setInViewport] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const covered = useSyncExternalStore(
    subscribeCinematicOverlay,
    cinematicOverlayActive,
    () => false,
  );
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const visibility = () => setPageVisible(document.visibilityState !== "hidden");
    visibility();
    document.addEventListener("visibilitychange", visibility);
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(([entry]) => setInViewport(Boolean(entry?.isIntersecting)), {
            rootMargin: "80px",
            threshold: 0,
          });
    if (observer) observer.observe(element);
    else setInViewport(true);
    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [host]);
  return inViewport && pageVisible && !covered;
}
