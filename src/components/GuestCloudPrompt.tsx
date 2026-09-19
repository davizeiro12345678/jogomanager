import { Link } from "@tanstack/react-router";
import { Check, Cloud, ShieldCheck } from "lucide-react";

import { useSignedIn } from "@/hooks/useCareer";

export function GuestCloudPrompt({ next, compact = false }: { next: string; compact?: boolean }) {
  const signedIn = useSignedIn();
  if (signedIn !== false) return null;

  return (
    <aside
      className={`border border-primary/35 bg-primary/10 ${compact ? "rounded-lg p-3" : "rounded-xl p-4"}`}
      aria-label="Salvar carreira na nuvem"
    >
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
          <Cloud size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-base uppercase">Seu clube já está criado. Proteja esta carreira.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Falta apenas entrar com Google para guardar o progresso na nuvem e continuar em qualquer aparelho.
          </p>
          <ul className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-3">
            <li className="flex items-center gap-1"><Check size={13} className="text-primary" /> Clube preservado</li>
            <li className="flex items-center gap-1"><Check size={13} className="text-primary" /> Partidas e títulos</li>
            <li className="flex items-center gap-1"><Check size={13} className="text-primary" /> Compras vinculadas</li>
          </ul>
          <Link
            to="/auth"
            search={{ next }}
            className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 font-display text-xs uppercase text-primary-foreground"
          >
            <ShieldCheck size={15} aria-hidden="true" />
            Salvar com Google
          </Link>
        </div>
      </div>
    </aside>
  );
}