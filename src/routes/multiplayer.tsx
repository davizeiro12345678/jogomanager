import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

import { loadGamePageHead } from "@/lib/load-game-page-head";


export const Route = createFileRoute("/multiplayer")({
  ssr: false,
  head: () => loadGamePageHead("/multiplayer"),
  // Defer the browser-only graph: do not eagerly link 3D/physics into SSR.
  component: lazyRouteComponent(() => import("@/pages/multiplayer"), "MultiplayerPage"),
});
