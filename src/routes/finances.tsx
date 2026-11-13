import { loadGamePageHead } from "@/lib/load-game-page-head";

import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/finances")({
  ssr: false,
  head: () => loadGamePageHead("/finances"),
  component: lazyRouteComponent(() => import("@/pages/finances"), "FinancesPage"),
});
