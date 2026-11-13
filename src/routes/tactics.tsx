import { loadGamePageHead } from "@/lib/load-game-page-head";

import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/tactics")({
  ssr: false,
  head: () => loadGamePageHead("/tactics"),
  component: lazyRouteComponent(() => import("@/pages/tactics"), "TacticsPage"),
});
