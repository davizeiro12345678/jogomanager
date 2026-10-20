import { gamePageHead } from "@/lib/game-page-metadata";

import { createFileRoute } from "@tanstack/react-router";

import { TacticsPage } from "@/pages/tactics";

export const Route = createFileRoute("/tactics")({
  ssr: false,
  head: () => gamePageHead("/tactics"),
  component: TacticsPage,
});
