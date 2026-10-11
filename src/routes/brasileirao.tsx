import { createFileRoute, redirect } from "@tanstack/react-router";

// Merged into /tabelas/brasileirao-serie-a to avoid duplicate content competing in search.
export const Route = createFileRoute("/brasileirao")({
  beforeLoad: () => {
    throw redirect({ href: "/tabelas/brasileirao-serie-a", statusCode: 301 });
  },
});
