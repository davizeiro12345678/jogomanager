import { gamePageHead } from "@/lib/game-page-metadata";

import { createFileRoute } from "@tanstack/react-router";

import { ClubHub } from "@/pages/club";

export const Route = createFileRoute("/club")({
  ssr: false,
  head: () => gamePageHead("/club"),
  component: ClubHub,
});
