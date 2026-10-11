import { createFileRoute, redirect } from "@tanstack/react-router";

// Merged into /tabelas to avoid duplicate content competing in search.
export const Route = createFileRoute("/ligas-de-futebol")({
  beforeLoad: () => {
    throw redirect({ href: "/tabelas", statusCode: 301 });
  },
});
