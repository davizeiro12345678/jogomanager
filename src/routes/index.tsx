import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { CLUBS, LEAGUES } from "@/game/data/leagues";
import { Crest } from "@/components/game/Crest";
import { readLocalCareer } from "@/lib/careerStorage";
import { Flag } from "@/components/game/Flag";
import { canonical, gameLd, seoMeta } from "@/lib/seo";
import heroStadium from "@/assets/hero-stadium.jpg";

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
      <div className="relative mx-auto max-w-6xl px-4 py-16">
        {/* brilho de refletor atrás do título */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 left-1/4 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]"
        />
        {/* linhas do gramado ao fundo, bem discretas */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] opacity-[0.07] [background-image:repeating-linear-gradient(90deg,transparent_0_44px,hsl(var(--foreground))_44px_45px)] [mask-image:linear-gradient(to_bottom,black,transparent)]"
        />
        <p className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-display text-[0.65rem] uppercase tracking-[0.35em] text-primary">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
          Temporada 2026
        </p>
        <h1 className="mt-3 max-w-3xl font-display text-5xl leading-[1.05] sm:text-7xl">
          Você é o manager.
          <br />
          <span className="bg-gradient-to-r from-primary to-foreground bg-clip-text text-transparent">
            O jogo acontece em 3D.
          </span>
        </h1>
        <p className="mt-5 max-w-xl text-lg text-muted-foreground">
          Escolha um clube real, monte a escalação, defina a tática e assista aos 90 minutos ao
          vivo num estádio 3D — dando ordens enquanto a bola rola. Sem cadastro: é só jogar.
        </p>

        <dl className="mt-8 grid grid-cols-2 gap-4 sm:flex sm:flex-wrap sm:gap-x-10">
          {[
            [`${Object.keys(CLUBS).length}+`, "clubes reais"],
            [`${LEAGUES.length}`, "ligas e copas"],
            ["90'", "em 3D ao vivo"],
            ["0", "custo para jogar"],
          ].map(([v, k]) => (
            <div key={k}>
              <dt className="font-display text-3xl text-primary">{v}</dt>
              <dd className="text-xs uppercase tracking-widest text-muted-foreground">{k}</dd>
            </div>
          ))}
        </dl>

        {/* faixa de escudos: mostra de cara que os clubes são reais */}
        <div
          aria-hidden="true"
          className="mt-8 -mx-4 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]"
        >
          <div className="flex w-max gap-3 px-4 motion-safe:animate-[marquee_38s_linear_infinite]">
            {[...LEAGUES.flatMap((l) => l.clubs.slice(0, 5)), ...LEAGUES.flatMap((l) => l.clubs.slice(0, 5))].map(
              (c, i) => (
                <span
                  key={`${c.id}-${i}`}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border/50 bg-card/60 backdrop-blur"
                >
                  <Crest club={c} size={26} />
                </span>
              ),
            )}
          </div>
        </div>

        <figure className="mt-10 overflow-hidden rounded-3xl border border-border/60 shadow-2xl shadow-primary/10">
          <img
            src={heroStadium}
            alt="Manager na beira do campo observando a partida em um estádio 3D lotado à noite"
            width={1600}
            height={912}
            className="h-auto w-full"
          />
        </figure>

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
            className="flex-1 rounded-lg bg-primary px-6 py-3 text-center font-display text-sm uppercase tracking-widest text-primary-foreground transition hover:brightness-110 sm:flex-none"
          >
            {hasCareer ? "Continuar carreira" : "Jogar agora"}
          </Link>
          <Link
            to="/partida-rapida"
            className="flex-1 rounded-lg border border-border px-6 py-3 text-center font-display text-sm uppercase tracking-widest text-foreground transition hover:bg-secondary sm:flex-none"
          >
            Partida rápida
          </Link>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Sem cadastro para jogar.{" "}
          <Link to="/auth" className="underline underline-offset-4 hover:text-foreground">
            Entrar
          </Link>{" "}
          só serve para salvar a carreira na nuvem.
        </p>


        <section className="mt-12">
          <h2 className="sr-only">Por onde começar</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {HUB.map((c) => (
              <Link
                key={c.to}
                to={c.to}
                className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/70 p-5 backdrop-blur transition hover:-translate-y-0.5 hover:border-primary/50 hover:bg-card hover:shadow-lg"
              >
                <p className="font-display text-lg group-hover:text-primary">{c.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{c.text}</p>
              </Link>
            ))}
          </div>
        </section>

        <nav className="mt-10 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground sm:text-sm">
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
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-2xl uppercase tracking-wide">Ligas disponíveis</h2>
            <Link
              to="/ligas-de-futebol"
              className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Ver todas as {LEAGUES.length} ligas
            </Link>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {LEAGUES.slice(0, 8).map((l) => (
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
