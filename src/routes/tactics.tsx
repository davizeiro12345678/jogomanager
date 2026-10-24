import { loadGamePageHead } from "@/lib/load-game-page-head";

import { createFileRoute } from "@tanstack/react-router";

import { TacticsPage } from "@/pages/tactics";

export const Route = createFileRoute("/tactics")({
  ssr: false,
  head: () => loadGamePageHead("/tactics"),
  component: TacticsPage,
});
