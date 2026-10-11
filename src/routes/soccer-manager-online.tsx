import { createFileRoute, redirect } from "@tanstack/react-router";

// Merged into /jogo-de-manager-de-futebol to avoid duplicate content competing in search.
export const Route = createFileRoute("/soccer-manager-online")({
  beforeLoad: () => {
    throw redirect({ href: "/jogo-de-manager-de-futebol", statusCode: 301 });
  },
});
