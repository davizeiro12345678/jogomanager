export function RoutePending() {
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
