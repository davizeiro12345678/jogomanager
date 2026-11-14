import { loadGamePageHead } from "@/lib/load-game-page-head";

import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/finances")({
  ssr: false,
  head: () => loadGamePageHead("/finances"),
  // Keep the browser's module graph out of the SSR Worker build.
  component: import.meta.env.SSR
    ? () => null
    : lazyRouteComponent(() => import("@/pages/finances"), "FinancesPage"),
});
