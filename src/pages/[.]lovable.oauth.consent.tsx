import { Link } from "@tanstack/react-router";

import { getRouteApi } from "@tanstack/react-router";
import { useState } from "react";
const Route = getRouteApi("/.lovable/oauth/consent");

export function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientName = details?.client?.name ?? "um aplicativo";

  async function decide(approve: boolean) {
    setBusy(true);
    const { supabase } = await import("@/integrations/supabase/client");
    const { data, error } = approve
      ? await supabase.auth.oauth.approveAuthorization(authorization_id)
      : await supabase.auth.oauth.denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const result = data as { redirect_url?: string; redirect_to?: string } | null;
    const target = result?.redirect_url ?? result?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("O servidor de autorização não retornou um redirecionamento.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main className="pitch-bg flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-card/85 p-6 backdrop-blur-xl">
        <Link to="/" className="font-display text-xs uppercase tracking-[0.3em] text-primary">
          Manager 3D
        </Link>
        <h1 className="mt-2 font-display text-2xl">Conectar {clientName} à sua conta</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Isso permite que {clientName} use o Manager 3D como você — ler e atualizar sua carreira de
          técnico enquanto você estiver conectado.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Isso não ignora as permissões e políticas de dados do jogo.
        </p>
        {error && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="mt-5 flex gap-2">
          <button
            disabled={busy}
            onClick={() => decide(true)}
            className="flex-1 rounded-lg bg-primary px-4 py-2.5 font-display text-sm uppercase tracking-widest text-primary-foreground transition hover:brightness-110 disabled:opacity-60"
          >
            Aprovar
          </button>
          <button
            disabled={busy}
            onClick={() => decide(false)}
            className="flex-1 rounded-lg border border-border px-4 py-2.5 font-display text-sm uppercase tracking-widest text-foreground transition hover:bg-secondary disabled:opacity-60"
          >
            Cancelar
          </button>
        </div>
      </div>
    </main>
  );
}
