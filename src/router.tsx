import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

function RoutePending() {
  return (
    <main
      className="mx-auto max-w-7xl space-y-5 px-4 py-8"
      role="status"
      aria-label="Carregando página"
    >
      <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
      <div className="h-24 w-full animate-pulse rounded-xl bg-muted/70" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-48 animate-pulse rounded-xl bg-muted/50" />
        <div className="h-48 animate-pulse rounded-xl bg-muted/50" />
      </div>
      <span className="sr-only">Carregando página</span>
    </main>
  );
}

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultPendingComponent: RoutePending,
    defaultPendingMs: 300,
  });

  return router;
};
