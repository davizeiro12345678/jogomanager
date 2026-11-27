import { loadGamePageHead } from "@/lib/load-game-page-head";

import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/training")({
  ssr: false,
  head: () => loadGamePageHead("/training"),
  // A browser-only screen must not enter the Cloudflare server module graph.
  component: import.meta.env.SSR
    ? () => null
    : lazyRouteComponent(() => import("@/pages/training"), "TrainingPage"),
});
