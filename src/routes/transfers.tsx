import { gamePageHead } from "@/lib/game-page-metadata";

import { createFileRoute } from "@tanstack/react-router";

import { TransfersPage } from "@/pages/transfers";

export const Route = createFileRoute("/transfers")({
  ssr: false,
  head: () => gamePageHead("/transfers"),
  component: TransfersPage,
});
