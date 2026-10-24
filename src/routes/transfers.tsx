import { loadGamePageHead } from "@/lib/load-game-page-head";

import { createFileRoute } from "@tanstack/react-router";

import { TransfersPage } from "@/pages/transfers";

export const Route = createFileRoute("/transfers")({
  ssr: false,
  head: () => loadGamePageHead("/transfers"),
  component: TransfersPage,
});
