import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { LEAGUES } from "@/game/data/leagues";
import { Crest } from "@/components/game/Crest";
import { Flag } from "@/components/game/Flag";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Manager 3D — Seja o técnico e assista a partida em 3D" },
      {
        name: "description",
        content:
          "Escale o time, defina a tática e acompanhe a partida ao vivo em 3D. Clubes e elencos reais do Brasileirão, Premier League, La Liga e Serie A.",
      },
      { property: "og:title", content: "Manager 3D — Futebol de gestão com partida 3D ao vivo" },
      {
        property: "og:description",
        content: "Comande um clube real, dê ordens em tempo real e veja o jogo acontecer em 3D.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, []);

  return (
    <div className="pitch-bg min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <p className="font-display text-xs uppercase tracking-[0.4em] text-primary">
          Temporada 2026
        </p>
        <h1 className="mt-3 max-w-3xl font-display text-5xl leading-[1.05] sm:text-7xl">
          Você é o manager.
          <br />O jogo acontece em 3D.
        </h1>
        <p className="mt-5 max-w-xl text-lg text-muted-foreground">
          Escolha um clube real, monte a escalação, defina a tática e assista aos 90 minutos ao
          vivo num estádio 3D — dando ordens enquanto a bola rola.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to={signedIn ? "/club" : "/auth"}
            className="rounded-lg bg-primary px-6 py-3 font-display text-sm uppercase tracking-widest text-primary-foreground transition hover:brightness-110"
          >
            {signedIn ? "Continuar carreira" : "Começar carreira"}
          </Link>
          <Link
            to="/new"
            className="rounded-lg border border-border px-6 py-3 font-display text-sm uppercase tracking-widest text-foreground transition hover:bg-secondary"
          >
            Escolher clube
          </Link>
        </div>

        <section className="mt-16">
          <h2 className="font-display text-2xl uppercase tracking-wide">Ligas disponíveis</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {LEAGUES.map((l) => (
              <div
                key={l.id}
                className="rounded-xl border border-border/60 bg-card/70 p-4 backdrop-blur"
              >
                <p className="font-display text-lg">
                  <Flag league={l.id} size={20} /> {l.name}
                </p>
                <p className="text-xs text-muted-foreground">{l.clubs.length} clubes</p>
                <div className="mt-3 flex -space-x-2">
                  {l.clubs.slice(0, 6).map((c) => (
                    <Crest key={c.id} club={c} size={28} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
