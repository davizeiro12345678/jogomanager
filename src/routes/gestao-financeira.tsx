import { createFileRoute, redirect } from "@tanstack/react-router";
import { PUBLIC_PAGE_REDIRECTS } from "@/lib/public-page-redirects";

// Merged into /dicas-de-gestao to avoid duplicate content competing in search.
export const Route = createFileRoute("/gestao-financeira")({
  beforeLoad: () => {
    throw redirect({ href: PUBLIC_PAGE_REDIRECTS["/gestao-financeira"], statusCode: 301 });
  },
});
