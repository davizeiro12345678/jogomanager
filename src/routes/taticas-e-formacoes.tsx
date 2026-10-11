import { createFileRoute, redirect } from "@tanstack/react-router";

// Merged into /melhores-formacoes to avoid duplicate content competing in search.
export const Route = createFileRoute("/taticas-e-formacoes")({
  beforeLoad: () => {
    throw redirect({ href: "/melhores-formacoes", statusCode: 301 });
  },
});
