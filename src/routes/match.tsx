import { loadGamePageHead } from "@/lib/load-game-page-head";

import { createFileRoute } from "@tanstack/react-router";

import { MatchPage } from "@/pages/match";

export const Route = createFileRoute("/match")({
  ssr: false,
  head: () => loadGamePageHead("/match"),
  component: MatchPage,
});
