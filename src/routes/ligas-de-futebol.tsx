import { createFileRoute, redirect } from "@tanstack/react-router";
import { PUBLIC_PAGE_REDIRECTS } from "@/lib/public-page-redirects";

// Merged into /tabelas to avoid duplicate content competing in search.
export const Route = createFileRoute("/ligas-de-futebol")({
  beforeLoad: () => {
    throw redirect({ href: PUBLIC_PAGE_REDIRECTS["/ligas-de-futebol"], statusCode: 301 });
  },
});
