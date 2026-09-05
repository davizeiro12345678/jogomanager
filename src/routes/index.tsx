import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { LEAGUES } from "@/game/data/leagues";
import { Crest } from "@/components/game/Crest";
import { readLocalCareer } from "@/lib/careerStorage";
import { Flag } from "@/components/game/Flag";
import { canonical, gameLd, seoMeta } from "@/lib/seo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      ...seoMeta({
        title: "Pro Football Manager 3D — Jogo de manager de futebol grátis em 3D",
        description:
          "Comande um clube real, monte o elenco, defina a tática e assista aos 90 minutos em 3D. Brasileirão, Premier League, LaLiga, Serie A e mais de 30 ligas. Grátis no navegador.",
        path: "/",
      }),
      {
        name: "google-site-verification",
        content: "aiZIOSixTEt1PZq_nu3R9bRBcvc0Xxv139cyiLgnJyA",
      },
    ],
    links: canonical("/"),
    scripts: [gameLd()],
  }),
  component: Landing,
});

function Landing() {
  const [hasCareer, setHasCareer] = useState(false);

  useEffect(() => {
    let alive = true;
    if (readLocalCareer()) setHasCareer(true);
    supabase.auth.getSession().then(({ data }) => {
      if (alive && data.session) setHasCareer(true);
    });
    return () => {
      alive = false;
    };
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
          vivo num estádio 3D — dando ordens enquanto a bola rola. Sem cadastro: é só jogar.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to={hasCareer ? "/dashboard" : "/new"}
            className="rounded-lg bg-primary px-6 py-3 font-display text-sm uppercase tracking-widest text-primary-foreground transition hover:brightness-110"
          >
            {hasCareer ? "Continuar carreira" : "Jogar agora"}
          </Link>
          <Link
            to="/new"
            className="rounded-lg border border-border px-6 py-3 font-display text-sm uppercase tracking-widest text-foreground transition hover:bg-secondary"
          >
            Escolher clube
          </Link>
          <Link
            to="/auth"
            className="rounded-lg px-6 py-3 font-display text-sm uppercase tracking-widest text-muted-foreground transition hover:text-foreground"
          >
            Entrar (opcional)
          </Link>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          O e-mail é opcional — serve só para salvar a carreira na nuvem e jogar em outros
          aparelhos.
        </p>
        <nav className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <Link to="/guias" className="underline-offset-4 hover:text-foreground hover:underline">
            Guias para iniciantes
          </Link>
          <Link
            to="/ligas-de-futebol"
            className="underline-offset-4 hover:text-foreground hover:underline"
          >
            Todas as ligas
          </Link>
          <Link
            to="/dicas-de-gestao"
            className="underline-offset-4 hover:text-foreground hover:underline"
          >
            Dicas de gestão
          </Link>
          <Link to="/cadastro" className="underline-offset-4 hover:text-foreground hover:underline">
            Cadastrar meus clubes e jogadores
          </Link>
        </nav>



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
