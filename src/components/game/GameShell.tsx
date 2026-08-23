import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import { CLUBS } from "@/game/data/leagues";
import { Crest } from "./Crest";
import type { CareerState } from "@/game/types";

const TABS = [
  { to: "/club", label: "Central" },
  { to: "/squad", label: "Elenco" },
  { to: "/tactics", label: "Táticas" },
  { to: "/league", label: "Liga" },
] as const;

export function GameShell({
  career,
  children,
}: {
  career: CareerState | null;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const club = career ? CLUBS[career.clubId] : undefined;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-card/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            {club ? <Crest club={club} size={34} /> : null}
            <div className="leading-tight">
              <p className="font-display text-lg tracking-wide">{club?.name ?? "Manager 3D"}</p>
              <p className="text-xs text-muted-foreground">
                {career ? `Rodada ${career.round} · ${career.managerName}` : "Carreira"}
              </p>
            </div>
          </div>
          <nav className="ml-auto flex items-center gap-1">
            {TABS.map((t) => (
              <Link
                key={t.to}
                to={t.to}
                className="rounded-md px-3 py-1.5 font-display text-sm uppercase tracking-wider text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground [&.active]:bg-secondary [&.active]:text-foreground"
              >
                {t.label}
              </Link>
            ))}
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/" });
              }}
              className="ml-2 rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              Sair
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
