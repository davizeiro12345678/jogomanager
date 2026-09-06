import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { CLUBS, LEAGUES } from "@/game/data/leagues";
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

const HUB = [
  {
    to: "/new",
    title: "Nova carreira",
    text: "Crie seu treinador e escolha um clube entre mais de mil times reais.",
  },
  {
    to: "/partida-rapida",
    title: "Partida rápida",
    text: "Um jogo avulso em 3D contra o computador, com narração ao vivo.",
  },
  {
    to: "/multiplayer",
    title: "Multiplayer 1x1",
    text: "Crie uma sala, mande o código e jogue contra um amigo em tempo real.",
  },
  {
    to: "/clube/novo",
    title: "Criar meu clube",
    text: "Escudo, cores, estádio e elenco do zero — o clube é seu.",
  },
  {
    to: "/melhores-formacoes",
    title: "Melhores formações",
    text: "Quando usar 4-3-3, 4-4-2, 3-5-2 e o que cada esquema cobra.",
  },
  {
    to: "/jogar-offline",
    title: "Jogar offline",
    text: "Instale como aplicativo e continue jogando sem internet.",
  },
] as const;

function Landing() {
  const [hasCareer, setHasCareer] = useState(false);
  const [resume, setResume] = useState<{ club: string; season: number; round: number } | null>(null);

  useEffect(() => {
    let alive = true;
    const local = readLocalCareer();
    if (local) {
      setHasCareer(true);
      const club = CLUBS[local.clubId];
      setResume({
        club: club?.name ?? local.clubId,
        season: local.season ?? 1,
        round: (local.round ?? 0) + 1,
      });
    }
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

        {resume ? (
          <Link
            to="/dashboard"
            className="mt-8 flex max-w-xl items-center gap-4 rounded-2xl border border-primary/40 bg-primary/10 p-4 transition hover:bg-primary/15"
          >
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary/20 font-display text-xl text-primary">
              ▶
            </span>
            <span>
              <span className="block font-display text-lg">Continuar de onde parou</span>
              <span className="block text-sm text-muted-foreground">
                {resume.club} · temporada {resume.season}, rodada {resume.round}
              </span>
            </span>
          </Link>
        ) : null}

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to={hasCareer ? "/dashboard" : "/new"}
            className="rounded-lg bg-primary px-6 py-3 font-display text-sm uppercase tracking-widest text-primary-foreground transition hover:brightness-110"
          >
            {hasCareer ? "Continuar carreira" : "Jogar agora"}
          </Link>
          <Link
            to="/partida-rapida"
            className="rounded-lg border border-border px-6 py-3 font-display text-sm uppercase tracking-widest text-foreground transition hover:bg-secondary"
          >
            Partida rápida
          </Link>
          <Link
            to="/multiplayer"
            className="rounded-lg border border-border px-6 py-3 font-display text-sm uppercase tracking-widest text-foreground transition hover:bg-secondary"
          >
            Multiplayer 1x1
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

        <section className="mt-12">
          <h2 className="sr-only">Por onde começar</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {HUB.map((c) => (
              <Link
                key={c.to}
                to={c.to}
                className="group rounded-2xl border border-border/60 bg-card/70 p-5 backdrop-blur transition hover:border-primary/50 hover:bg-card"
              >
                <p className="font-display text-lg group-hover:text-primary">{c.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{c.text}</p>
              </Link>
            ))}
          </div>
        </section>

        <nav className="mt-10 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
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
            to="/guia-de-scouting"
            className="underline-offset-4 hover:text-foreground hover:underline"
          >
            Guia de scouting
          </Link>
          <Link
            to="/gestao-financeira"
            className="underline-offset-4 hover:text-foreground hover:underline"
          >
            Gestão financeira
          </Link>
          <Link
            to="/glossario-do-futebol"
            className="underline-offset-4 hover:text-foreground hover:underline"
          >
            Glossário
          </Link>
          <Link
            to="/comparativo-jogos-manager"
            className="underline-offset-4 hover:text-foreground hover:underline"
          >
            Comparativo de jogos
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
