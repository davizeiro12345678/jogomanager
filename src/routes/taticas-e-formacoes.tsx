import { createFileRoute, redirect } from "@tanstack/react-router";
import { PUBLIC_PAGE_REDIRECTS } from "@/lib/public-page-redirects";

// Merged into /melhores-formacoes to avoid duplicate content competing in search.
export const Route = createFileRoute("/taticas-e-formacoes")({
  beforeLoad: () => {
    throw redirect({ href: PUBLIC_PAGE_REDIRECTS["/taticas-e-formacoes"], statusCode: 301 });
  },
});
