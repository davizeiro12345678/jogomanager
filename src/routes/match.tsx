import { gamePageHead } from "@/lib/game-page-metadata";

import { createFileRoute } from "@tanstack/react-router";

import { MatchPage } from "@/pages/match";

export const Route = createFileRoute("/match")({
  ssr: false,
  head: () => gamePageHead("/match"),
  component: MatchPage,
});
