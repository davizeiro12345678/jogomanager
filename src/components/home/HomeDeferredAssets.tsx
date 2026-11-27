import { useEffect } from "react";

/**
 * Home server-renders its editorial content and first-paint styles normally.
 * Below-the-fold CSS is requested when the first game mode approaches the
 * viewport, or once the browser is idle. No overlays or hidden text.
 */
export function HomeDeferredAssets() {
  useEffect(() => {
    let active = true;
    let requested = false;
    let idleToken: number | undefined;
    const load = () => {
      if (!active || requested) return;
      requested = true;
      void import("./home-below-fold.css");
    };
    const target = document.querySelector("#modos");
    const observer =
      target && typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            (entries) => {
              if (entries.some((entry) => entry.isIntersecting)) {
                load();
                observer?.disconnect();
              }
            },
            { rootMargin: "700px 0px" },
          )
        : null;
    if (target && observer) observer.observe(target);
    else load();

    const schedule = window.setTimeout(() => {
      if (typeof window.requestIdleCallback === "function")
        idleToken = window.requestIdleCallback(load, { timeout: 1500 });
      else load();
    }, 3000);

    return () => {
      active = false;
      observer?.disconnect();
      window.clearTimeout(schedule);
      if (idleToken !== undefined) window.cancelIdleCallback?.(idleToken);
    };
  }, []);

  return null;
}
