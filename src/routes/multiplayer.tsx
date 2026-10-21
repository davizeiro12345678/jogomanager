import { createFileRoute } from "@tanstack/react-router";

import { gamePageHead } from "@/lib/game-page-metadata";

import { MultiplayerPage } from "@/pages/multiplayer";

export const Route = createFileRoute("/multiplayer")({
  ssr: false,
  head: () => gamePageHead("/multiplayer"),
  component: MultiplayerPage,
});
