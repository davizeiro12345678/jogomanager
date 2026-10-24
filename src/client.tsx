import { StartClient } from "@tanstack/react-start/client";
import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { isLightweightCssPath } from "@/lib/public-content-routes";

const hydrate = () =>
  startTransition(() => {
    hydrateRoot(
      document,
      <StrictMode>
        <StartClient />
      </StrictMode>,
    );
  });

// These routes already contain their full SSR page. Yield one paint before
// hydration competes with its text and critical image. Hidden tabs hydrate
// immediately because their animation frames may be suspended by the browser.
if (isLightweightCssPath(location.pathname) && !document.hidden)
  requestAnimationFrame(() => requestAnimationFrame(hydrate));
else hydrate();
