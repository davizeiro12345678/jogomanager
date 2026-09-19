import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { CLUBS, LEAGUES } from "@/game/data/leagues";
import { Crest } from "@/components/game/Crest";
import { readLocalCareer } from "@/lib/careerStorage";
import { Flag } from "@/components/game/Flag";
import { SiteFooter } from "@/components/SiteFooter";
import { canonical, gameLd, seoMeta, SITE_TITLE, SITE_DESCRIPTION } from "@/lib/seo";
import heroAvif from "@/assets/hero-stadium.jpg?format=avif&w=640;1024;1600&quality=52&as=srcset";
import heroWebp from "@/assets/hero-stadium.jpg?format=webp&w=640;1024;1600&quality=62&as=srcset";
import heroFallback from "@/assets/hero-stadium.jpg?format=jpg&w=1024&quality=58&as=url";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      ...seoMeta({
        title: SITE_TITLE,
        description: SITE_DESCRIPTION,
        path: "/",
        ogTitle: "Pro Football Manager 3D | Seja o Treinador do Seu Próprio Clube",
        ogDescription:
          "Assuma o controle tático, dispute campeonatos reais em 3D imersivo, gerencie finanças e construa um elenco campeão.",
      }),
      {
        name: "google-site-verification",
        content: "jQnHkMGkHJbJedGaIYWIRl14nynSHLVLLvHfzLfpTXg",
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

/**
 * Faixa de escudos: apenas uma amostra (duplicada para o loop contínuo).
 * Renderizar todos os clubes custava centenas de SVGs no primeiro paint.
 */
const MARQUEE_SAMPLE = LEAGUES.slice(0, 12).flatMap((l) => l.clubs.slice(0, 2));
const MARQUEE_CLUBS = [...MARQUEE_SAMPLE, ...MARQUEE_SAMPLE];

function Landing() {
  const [hasCareer, setHasCareer] = useState(false);
  const [resume, setResume] = useState<{ club: string; season: number; round: number } | null>(
    null,
  );

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
      {/* ---------- herói em tela cheia ---------- */}
      <header className="relative isolate overflow-hidden">
        <picture>
          <source type="image/avif" srcSet={heroAvif} sizes="100vw" />
          <source type="image/webp" srcSet={heroWebp} sizes="100vw" />
          <img
            src={heroFallback}
            alt="Manager na beira do campo observando a partida em um estádio 3D lotado à noite"
            width={1600}
            height={912}
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 -z-20 h-full w-full object-cover object-center opacity-45"
          />
        </picture>
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(120%_80%_at_50%_0%,transparent_10%,hsl(var(--background)/0.7)_55%,hsl(var(--background))_100%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 left-1/2 -z-10 h-80 w-[44rem] -translate-x-1/2 rounded-full bg-primary/25 blur-[130px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[30rem] opacity-[0.06] [background-image:repeating-linear-gradient(90deg,transparent_0_44px,hsl(var(--foreground))_44px_45px)] [mask-image:linear-gradient(to_bottom,black,transparent)]"
        />

        <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-14 pt-20 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:pt-28">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-display text-[0.65rem] uppercase tracking-[0.35em] text-primary">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              Temporada 2026
            </p>
            <h1 className="mt-4 max-w-3xl font-display text-5xl leading-[1.02] sm:text-7xl">
              Você é o manager.
              <br />
              <span className="text-gradient">O jogo acontece em 3D.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              Escolha um clube real, monte a escalação, defina a tática e assista aos 90 minutos ao
              vivo num estádio 3D — dando ordens enquanto a bola rola. Comece sem cadastro e salve
              na nuvem quando quiser continuar em outro aparelho.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to={hasCareer ? "/dashboard" : "/new"}
                className="glow-primary flex-1 rounded-xl bg-primary px-7 py-4 text-center font-display text-sm uppercase tracking-widest text-primary-foreground transition hover:brightness-110 sm:flex-none"
              >
                {hasCareer ? "Continuar carreira" : "Jogar agora"}
              </Link>
              <Link
                to="/partida-rapida"
                className="flex-1 rounded-xl border border-border bg-background/40 px-7 py-4 text-center font-display text-sm uppercase tracking-widest text-foreground backdrop-blur transition hover:bg-secondary sm:flex-none"
              >
                Partida rápida
              </Link>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Seu progresso fica neste aparelho até você salvar na nuvem.{" "}
              <Link to="/auth" className="font-medium text-primary underline underline-offset-4 hover:text-foreground">
                Salvar com Google
              </Link>{" "}
              leva um clique.
            </p>

            <dl className="mt-9 grid grid-cols-2 gap-4 sm:flex sm:flex-wrap sm:gap-x-10">
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
          </div>

          {/* placar de vitrine: mostra o clima de jogo ao vivo já na primeira tela */}
          <div aria-hidden="true" className="hidden lg:block">
            <div className="glass-panel rounded-3xl border border-border/60 p-5 shadow-2xl shadow-primary/10">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                <span className="flex items-center gap-1.5 text-primary">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" /> ao vivo
                </span>
                <span>72&apos;</span>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                {LEAGUES[0]?.clubs[0] ? <Crest club={LEAGUES[0].clubs[0]} size={44} /> : null}
                <span className="font-display text-4xl tabular-nums">
                  2 <span className="text-muted-foreground">:</span> 1
                </span>
                {LEAGUES[0]?.clubs[1] ? <Crest club={LEAGUES[0].clubs[1]} size={44} /> : null}
              </div>
              <div className="mt-5 space-y-3">
                {[
                  ["Posse", 58],
                  ["Finalizações", 71],
                  ["Passes certos", 84],
                ].map(([label, pct]) => (
                  <div key={label as string}>
                    <div className="flex justify-between text-[11px] uppercase tracking-widest text-muted-foreground">
                      <span>{label}</span>
                      <span className="tabular-nums text-foreground">{pct}%</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-foreground/10">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${pct as number}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex gap-1.5">
                {["V", "V", "E", "V", "D"].map((r, i) => (
                  <span
                    key={i}
                    className={`grid h-7 flex-1 place-items-center rounded-md font-display text-xs ${
                      r === "V"
                        ? "bg-primary/25 text-primary"
                        : r === "E"
                          ? "bg-foreground/10 text-muted-foreground"
                          : "bg-destructive/20 text-destructive"
                    }`}
                  >
                    {r}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="relative mx-auto max-w-6xl px-4 pb-16">
        {/* faixa de escudos: mostra de cara que os clubes são reais */}
        <div
          aria-hidden="true"
          className="mt-8 -mx-4 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]"
        >
          <div className="flex w-max gap-3 px-4 motion-safe:animate-[marquee_38s_linear_infinite]">
            {MARQUEE_CLUBS.map((c, i) => (
              <span
                key={`${c.id}-${i}`}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border/50 surface-card backdrop-blur"
              >
                <Crest club={c} size={26} />
              </span>
            ))}
          </div>
        </div>

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

        <section className="mt-12">
          <h2 className="sr-only">Por onde começar</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {HUB.map((c) => (
              <Link
                key={c.to}
                to={c.to}
                className="group relative overflow-hidden rounded-2xl border border-border/60 surface-card p-5 backdrop-blur transition hover:-translate-y-0.5 hover:border-primary/50 hover:bg-card hover:shadow-lg"
              >
                <p className="font-display text-lg group-hover:text-primary">{c.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{c.text}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-14">
          <h2 className="font-display text-2xl uppercase tracking-wide">Como funciona</h2>
          <ol className="mt-4 grid gap-4 sm:grid-cols-3">
            {[
              [
                "01",
                "Escolha o clube",
                "Mais de mil times reais de 30+ ligas — ou crie o seu do zero.",
              ],
              [
                "02",
                "Monte o time",
                "Escalação, formação, mentalidade, pressão e mercado de transferências.",
              ],
              [
                "03",
                "Assista em 3D",
                "90 minutos ao vivo com narração, substituições e ordens no meio do jogo.",
              ],
            ].map(([n, t, d]) => (
              <li
                key={n}
                className="surface-card hover-lift rounded-2xl border border-border/60 p-5"
              >
                <span className="font-display text-3xl text-primary/50">{n}</span>
                <p className="mt-2 font-display text-lg">{t}</p>
                <p className="mt-1 text-sm text-muted-foreground">{d}</p>
              </li>
            ))}
          </ol>
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
                className="rounded-xl border border-border/60 surface-card p-4 backdrop-blur"
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

        {/* Texto de contexto: dá corpo à página e casa com o que os buscadores leem. */}
        <section className="mt-16 max-w-3xl">
          <h2 className="font-display text-2xl uppercase tracking-wide">
            O que é o Pro Football Manager 3D
          </h2>
          <div className="mt-4 space-y-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
            <p>
              O <strong className="text-foreground">Pro Football Manager 3D</strong> é um jogo de
              manager de futebol online e gratuito que roda direto no navegador, sem instalar nada.
              Você assume o comando de um clube real, monta o elenco, define a formação e a postura
              tática, cuida do orçamento e assiste a cada partida em 3D, com narração, torcida e
              placar ao vivo.
            </p>
            <p>
              Cada temporada tem liga por pontos corridos, copa em mata-mata, janela de
              transferências, folha salarial, pressão da diretoria e humor da torcida. Ganhar
              títulos abre portas em clubes maiores; sequências ruins podem custar o emprego. O
              calendário avança rodada a rodada, com treinos, lesões, suspensões, renovações de
              contrato e a evolução dos jovens da base.
            </p>
            <p>
              Durante os 90 minutos você continua no comando: troca o esquema, muda a marcação,
              manda subir a linha, faz substituições e vê o efeito na posse, nas finalizações e na
              pressão do adversário. O estádio, o gramado, as arquibancadas e os jogadores são
              gerados pelo próprio jogo, com clima, horário e desgaste do campo — e a qualidade
              gráfica se ajusta sozinha ao aparelho, então roda bem no computador e no celular.
            </p>
            <p>
              As regras seguem as{" "}
              <a
                href="https://www.theifab.com/laws-of-the-game-documents/"
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="underline underline-offset-4 hover:text-foreground"
              >
                Regras do Jogo da IFAB
              </a>
              , e os formatos das competições reproduzem os calendários oficiais publicados por
              entidades como a{" "}
              <a
                href="https://www.cbf.com.br/futebol-brasileiro/competicoes"
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="underline underline-offset-4 hover:text-foreground"
              >
                CBF
              </a>
              . Escudos, elencos e tabelas vêm de bases esportivas abertas, revisadas antes de
              entrar no jogo.
            </p>
            <p>
              Dá para jogar uma carreira inteira sem gastar nada: a loja vende só conveniência —
              moedas, relatórios de olheiro, impulsos de treino e temas visuais — e nada disso muda
              o resultado das partidas.{" "}
              <Link to="/guias" className="underline underline-offset-4 hover:text-foreground">
                Comece pelos guias
              </Link>{" "}
              se for a sua primeira carreira, ou vá direto para a{" "}
              <Link
                to="/partida-rapida"
                className="underline underline-offset-4 hover:text-foreground"
              >
                partida rápida
              </Link>
              .
            </p>
          </div>
        </section>

        <SiteFooter path="/" />
      </div>
    </div>
  );
}
