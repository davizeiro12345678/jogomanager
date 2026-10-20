import { gamePageHead } from "@/lib/game-page-metadata";

import { createFileRoute } from "@tanstack/react-router";

import { FinancesPage } from "@/pages/finances";

export const Route = createFileRoute("/finances")({
  ssr: false,
  head: () => gamePageHead("/finances"),
  component: FinancesPage,
});
