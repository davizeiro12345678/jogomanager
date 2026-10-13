import { createFileRoute, redirect } from "@tanstack/react-router";
import { PUBLIC_PAGE_REDIRECTS } from "@/lib/public-page-redirects";

// Merged into /tabelas/brasileirao-serie-a to avoid duplicate content competing in search.
export const Route = createFileRoute("/brasileirao")({
  beforeLoad: () => {
    throw redirect({ href: PUBLIC_PAGE_REDIRECTS["/brasileirao"], statusCode: 301 });
  },
});
