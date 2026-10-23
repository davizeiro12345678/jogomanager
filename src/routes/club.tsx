import { loadGamePageHead } from "@/lib/load-game-page-head";

import { createFileRoute } from "@tanstack/react-router";

import { ClubHub } from "@/pages/club";

export const Route = createFileRoute("/club")({
  ssr: false,
  head: () => loadGamePageHead("/club"),
  component: ClubHub,
});
