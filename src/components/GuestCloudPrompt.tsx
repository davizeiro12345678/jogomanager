import { Link } from "@tanstack/react-router";
import { Cloud, ShieldCheck } from "lucide-react";

import { useSignedIn } from "@/hooks/useCareer";

export function GuestCloudPrompt({ next, compact = false }: { next: string; compact?: boolean }) {
  const signedIn = useSignedIn();
  if (signedIn !== false) return null;

  return (
    <aside
      className={`border border-primary/30 bg-primary/8 ${compact ? "rounded-lg px-3 py-2.5" : "rounded-xl p-4"}`}
      aria-label="Salvar carreira na nuvem"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
          <Cloud size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm uppercase sm:text-base">Salve sua carreira na nuvem</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Entre com Google para continuar em qualquer aparelho e preservar partidas, títulos e
            compras.
          </p>
        </div>
        <Link
          to="/auth"
          search={{ next }}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-4 font-display text-xs uppercase text-primary-foreground"
        >
          <ShieldCheck size={15} aria-hidden="true" />
          Salvar com Google
        </Link>
      </div>
    </aside>
  );
}
