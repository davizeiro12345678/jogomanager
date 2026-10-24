import { loadGamePageHead } from "@/lib/load-game-page-head";

import { createFileRoute } from "@tanstack/react-router";

import { FinancesPage } from "@/pages/finances";

export const Route = createFileRoute("/finances")({
  ssr: false,
  head: () => loadGamePageHead("/finances"),
  component: FinancesPage,
});
