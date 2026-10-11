import { createFileRoute, redirect } from "@tanstack/react-router";

// Merged into /dicas-de-gestao to avoid duplicate content competing in search.
export const Route = createFileRoute("/gestao-financeira")({
  beforeLoad: () => {
    throw redirect({ href: "/dicas-de-gestao", statusCode: 301 });
  },
});
