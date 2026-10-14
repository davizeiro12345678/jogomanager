import { createFileRoute, redirect } from "@tanstack/react-router";
import { PUBLIC_PAGE_REDIRECTS } from "@/lib/public-page-redirects";

// Merged into /jogo-de-manager-de-futebol to avoid duplicate content competing in search.
export const Route = createFileRoute("/soccer-manager-online")({
  beforeLoad: () => {
    throw redirect({ href: PUBLIC_PAGE_REDIRECTS["/soccer-manager-online"], statusCode: 301 });
  },
});
