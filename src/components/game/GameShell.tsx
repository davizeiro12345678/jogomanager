import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import { CLUBS } from "@/game/data/leagues";
import { useSignedIn } from "@/hooks/useCareer";
import { Crest } from "./Crest";
import type { CareerState } from "@/game/types";

const TABS = [
  { to: "/dashboard", label: "Painel" },
  { to: "/club", label: "Central" },
  { to: "/squad", label: "Elenco" },
  { to: "/tactics", label: "Táticas" },
  { to: "/league", label: "Liga" },
  { to: "/transfers", label: "Mercado" },
  { to: "/scouting", label: "Olheiros" },
  { to: "/finances", label: "Finanças" },
  { to: "/board", label: "Diretoria" },
  { to: "/stats", label: "Stats" },
  { to: "/news", label: "Notícias" },
  { to: "/history", label: "História" },
] as const;


export function GameShell({
  career,
  children,
}: {
  career: CareerState | null;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const signedIn = useSignedIn();
  const club = career ? CLUBS[career.clubId] : undefined;


  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-card/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 lg:flex-row lg:items-center lg:gap-4">
          <div className="flex items-center gap-3">
            {club ? <Crest club={club} size={34} /> : null}
            <div className="leading-tight">
              <p className="font-display text-lg tracking-wide">{club?.name ?? "Manager 3D"}</p>
              <p className="text-xs text-muted-foreground">
                {career
                  ? `Temporada ${career.season} · Rodada ${career.round} · €${career.finances.budget.toFixed(1)}M`
                  : "Carreira"}
              </p>
            </div>
          </div>
          <nav className="-mx-1 flex items-center gap-1 overflow-x-auto lg:ml-auto lg:mx-0">

            {TABS.map((t) => (
              <Link
                key={t.to}
                to={t.to}
                className="rounded-md px-3 py-1.5 font-display text-sm uppercase tracking-wider text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground [&.active]:bg-secondary [&.active]:text-foreground"
              >
                {t.label}
              </Link>
            ))}
            {signedIn ? (
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  navigate({ to: "/" });
                }}
                className="ml-2 rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                Sair
              </button>
            ) : (
              <Link
                to="/auth"
                className="ml-2 shrink-0 rounded-md border border-primary/50 px-3 py-1.5 text-xs text-primary hover:bg-primary/10"
              >
                Salvar na nuvem
              </Link>
            )}
          </nav>
        </div>
      </header>
      {signedIn === false && (
        <div className="border-b border-border/50 bg-secondary/40">
          <p className="mx-auto max-w-6xl px-4 py-2 text-xs text-muted-foreground">
            Você está jogando como convidado — o progresso fica salvo neste navegador.{" "}
            <Link to="/auth" className="text-primary underline underline-offset-2">
              Crie uma conta grátis
            </Link>{" "}
            para jogar em outros aparelhos.
          </p>
        </div>
      )}
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}

