import { loadGamePageHead } from "@/lib/load-game-page-head";

import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/training")({
  ssr: false,
  head: () => loadGamePageHead("/training"),
  component: lazyRouteComponent(() => import("@/pages/training"), "TrainingPage"),
});
