import { Await, getRouteApi, Link } from "@tanstack/react-router";
import { HomeLeaguePulse } from "@/components/home/HomeLeaguePulse";
import { Suspense, lazy, useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  Check,
  ChevronRight,
  Gamepad2,
  Menu,
  Play,
  Shield,
  Trophy,
  X,
} from "lucide-react";
import { SiteFooter } from "@/components/SiteFooter";
import { GameModeCards } from "@/features/home/components/GameModeCards";
import { DiscordLink } from "@/components/DiscordLink";
import heroMobileAvif from "@/assets/hero-stadium.jpg?format=avif&w=390;450&aspect=1:2&fit=cover&position=centre&quality=44&as=srcset";
import heroAvif from "@/assets/hero-stadium.jpg?format=avif&w=640;1024;1080;1600&quality=52&as=srcset";
import heroWebp from "@/assets/hero-stadium.jpg?format=webp&w=640;1024;1080;1600&quality=62&as=srcset";
import heroFallback from "@/assets/hero-stadium.jpg?format=jpg&w=1024&quality=58&as=url";
import "./home.css";

// Defer lengthy editorial sections without creating an extra chunk for the tiny league pulse.
const HomeDetails = lazy(() => import("./HomeDetails").then((m) => ({ default: m.HomeDetails })));
const TacticalPreview = lazy(() =>
  import("@/features/home/components/TacticalPreview").then((m) => ({
    default: m.TacticalPreview,
  })),
);
const SYSTEMS = [
  {
    id: "tactics",
    label: "Tática",
    title: "O plano é seu. O campo responde.",
    text: "Ajuste as linhas, encontre espaço e mude a pressão durante o jogo. Uma substituição pode mudar a sua tarde.",
    detail: "Formação · mentalidade · pressão · substituições",
    to: "/melhores-formacoes",
  },
  {
    id: "squad",
    label: "Elenco",
    title: "Um time vai além de onze nomes.",
    text: "Observe a condição dos atletas, desenvolva os jovens e negocie reforços que fazem sentido para o seu clube.",
    detail: "Scouting · treino · contratos · vestiário",
    to: "/planejamento-de-elenco",
  },
  {
    id: "career",
    label: "Carreira",
    title: "Toda temporada deixa uma história.",
    text: "Encare a diretoria, responda à imprensa e conquiste a confiança da torcida. Suas escolhas acompanham o treinador.",
    detail: "Entrevistas · relações · calendário · finanças",
    to: "/guias",
  },
] as const;
export function FootballHome() {
  const { leagues } = getRouteApi("/").useLoaderData();
  const [menu, setMenu] = useState(false);
  const [system, setSystem] = useState(0);
  const [resume, setResume] = useState<{ club: string; season: number; round: number } | null>(
    null,
  );
  useEffect(() => {
    let active = true;
    // Returning players alone need the catalogue to resolve their club name.
    void import("@/lib/careerStorage")
      .then(async ({ readLocalCareer }) => {
        const save = readLocalCareer();
        if (!save || !active) return;
        const [{ CLUBS }, { readMyClub }, { readCustom }] = await Promise.all([
          import("@/game/data/leagues"),
          import("@/lib/my-club-storage"),
          import("@/lib/custom-data-storage"),
        ]);
        if (active) {
          const created = readMyClub();
          setResume({
            club:
              (created?.id === save.clubId ? created.name : undefined) ??
              readCustom().clubs[save.clubId]?.name ??
              CLUBS[save.clubId]?.name ??
              save.clubId,
            season: save.season ?? 1,
            round: (save.round ?? 0) + 1,
          });
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!menu) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [menu]);
  const active = SYSTEMS[system]!;
  return (
    <main className="football-home">
      <a href="#home-content" className="home-skip">
        Ir para o conteúdo
      </a>
      <header className="home-nav">
        <Link to="/" className="home-brand">
          <span className="home-brand-mark">
            <Gamepad2 size={21} />
          </span>
          <span>
            PRO FOOTBALL
            <span className="home-brand-sub">
              MANAGER <b>3D</b>
            </span>
          </span>
        </Link>
        <nav aria-label="Navegação principal" className="home-desktop-nav">
          <a href="#modos">Modos de jogo</a>
          <Link to="/carreiras">Minhas carreiras</Link>
          <Link to="/guias">Guias</Link>
          <DiscordLink>Comunidade</DiscordLink>
          <Link to="/auth">Entrar</Link>
        </nav>
        <Link to={resume ? "/dashboard" : "/new"} className="home-button home-nav-cta">
          {resume ? "Continuar carreira" : "Começar a jogar"}
          <ArrowRight size={16} />
        </Link>
        <button
          className="home-menu-button"
          type="button"
          aria-label={menu ? "Fechar menu" : "Abrir menu"}
          aria-expanded={menu}
          aria-controls="home-mobile-menu"
          onClick={() => setMenu(!menu)}
        >
          {menu ? <X /> : <Menu />}
        </button>
        {menu ? (
          <nav id="home-mobile-menu" className="home-mobile-menu" aria-label="Navegação no celular">
            <a href="#modos" onClick={() => setMenu(false)}>
              Modos de jogo
            </a>
            <Link to="/carreiras" onClick={() => setMenu(false)}>
              Minhas carreiras
            </Link>
            <Link to="/guias" onClick={() => setMenu(false)}>
              Guias do treinador
            </Link>
            <DiscordLink>Comunidade</DiscordLink>
            <Link to="/auth">Entrar na conta</Link>
          </nav>
        ) : null}
      </header>
      <section id="home-content" className="home-hero" aria-labelledby="home-title">
        <picture>
          <source
            media="(max-width: 640px)"
            type="image/avif"
            srcSet={heroMobileAvif}
            sizes="100vw"
          />
          <source type="image/avif" srcSet={heroAvif} sizes="100vw" />
          <source type="image/webp" srcSet={heroWebp} sizes="100vw" />
          <img
            className="home-hero-image"
            src={heroFallback}
            alt="Treinador à beira do gramado em um estádio iluminado"
            width={1600}
            height={912}
            fetchPriority="high"
            decoding="sync"
          />
        </picture>
        <div className="home-hero-shade" aria-hidden="true" />
        <div className="home-hero-content">
          <p className="home-kicker">
            <span />
            FUTEBOL. DECISÕES. HISTÓRIAS.
          </p>
          <h1 id="home-title">
            <span className="sr-only">Pro Football Manager 3D: jogo de gestão de futebol. </span>
            SEU CLUBE.
            <br />
            <em>SUA HISTÓRIA.</em>
          </h1>
          <p className="home-hero-copy">
            Do primeiro treino ao último apito, você está no comando. Monte o time, viva a temporada
            e veja suas decisões ganharem vida em 3D.
          </p>
          <div className="home-hero-actions">
            <Link to={resume ? "/dashboard" : "/new"} className="home-button">
              {resume ? "Continuar minha carreira" : "Criar minha carreira"}
              <ArrowRight size={19} />
            </Link>
            <Link to="/partida-rapida" className="home-button home-button-secondary">
              <Play size={16} />
              Experimentar uma partida
            </Link>
          </div>
          <p className="home-hero-note">
            <Check size={14} />
            Grátis para começar<span>·</span>Direto no navegador<span>·</span>Sem cadastro inicial
          </p>
          <dl className="home-hero-stats" aria-label="Registros verificados do banco de dados">
            <div>
              <dt>Clubes cadastrados na base</dt>
              <dd>38.854</dd>
            </div>
            <div>
              <dt>Futebolistas únicos na base</dt>
              <dd>196.235</dd>
            </div>
            <div>
              <dt>Competições de liga catalogadas</dt>
              <dd>1.389</dd>
            </div>
          </dl>
          <p className="home-hero-note">
            Contagens verificadas no banco em 27/10/2026. São registros catalogados, não uma
            promessa de que todos estejam jogáveis ou carregados nesta sessão.
          </p>
          {resume ? (
            <Link to="/dashboard" className="home-resume">
              <span>SEU PRÓXIMO CAPÍTULO</span>
              <strong>{resume.club}</strong>
              <small>
                Temporada {resume.season} · rodada {resume.round}
              </small>
              <ChevronRight size={20} />
            </Link>
          ) : null}
        </div>
        <div className="home-hero-foot">
          <span>PRO FOOTBALL MANAGER 3D</span>
          <a href="#modos">
            Encontre seu jogo
            <ArrowDown size={15} />
          </a>
          <span>DA PRANCHETA AO GRAMADO</span>
        </div>
      </section>
      <div className="home-promises" aria-label="Experiência do jogo">
        <span>
          <Trophy />
          Uma carreira para construir
        </span>
        <span>
          <Gamepad2 />
          Partidas em 3D para acompanhar
        </span>
        <span>
          <Shield />
          Progresso salvo neste aparelho
        </span>
      </div>
      <div className="home-body">
        <Suspense fallback={null}>
          <Await promise={leagues}>{(resolved) => <HomeLeaguePulse leagues={resolved} />}</Await>
        </Suspense>
        <section id="modos" className="home-section" aria-labelledby="home-modes-title">
          <div className="home-section-heading">
            <div>
              <p className="home-kicker">ESCOLHA COMO ENTRAR EM CAMPO</p>
              <h2 id="home-modes-title">Hoje, o jogo é seu.</h2>
            </div>
            <p>
              Uma partida para testar uma ideia.
              <br />
              Uma carreira para fazer história.
            </p>
          </div>
          <GameModeCards />
        </section>
        <section className="home-manager-section home-section" aria-labelledby="home-manager-title">
          <div className="home-manager-copy">
            <p className="home-kicker">PENSE COMO TREINADOR</p>
            <h2 id="home-manager-title">
              O futebol começa
              <br />
              antes da bola rolar.
            </h2>
            <div className="home-system-buttons" role="group" aria-label="Explorar gestão">
              {SYSTEMS.map((item, i) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={system === i}
                  onClick={() => setSystem(i)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="home-system-detail" aria-live="polite">
              <h3>{active.title}</h3>
              <p>{active.text}</p>
              <small>{active.detail}</small>
              <Link to={active.to}>
                Conhecer as decisões
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
          <Suspense
            fallback={
              <div
                className="mx-auto aspect-[4/5] w-full max-w-[375px] rounded-xl border border-white/10 bg-[#111e18]"
                aria-hidden="true"
              />
            }
          >
            <TacticalPreview />
          </Suspense>
        </section>
        <section className="home-first-season" aria-labelledby="home-first-title">
          <p className="home-kicker">SEU PRIMEIRO DIA NO CLUBE</p>
          <h2 id="home-first-title">Quatro passos até o vestiário.</h2>
          <ol>
            {[
              ["01", "Crie sua identidade", "Nome, origem e a sua aparência."],
              ["02", "Defina seu perfil", "Personalidade e habilidades."],
              ["03", "Escolha seu desafio", "Um favorito ou um clube para reconstruir."],
              ["04", "Entre em campo", "Prepare o elenco e comece a temporada."],
            ].map(([n, title, text]) => (
              <li key={n}>
                <span>{n}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
          <Link to="/new" className="home-button">
            Começar minha história
            <ArrowRight size={18} />
          </Link>
        </section>
        <div className="home-guide-content">
          <Suspense fallback={null}>
            <HomeDetails />
          </Suspense>
        </div>
        <nav className="home-more-modes" aria-label="Outras formas de jogar">
          <span>Jogue do seu jeito</span>
          <Link to="/clube/novo">
            Criar meu próprio clube <ArrowRight size={15} />
          </Link>
          <Link to="/jogar-offline">
            Jogar offline <ArrowRight size={15} />
          </Link>
          <Link to="/visual">
            Ajustar gráficos e câmeras <ArrowRight size={15} />
          </Link>
        </nav>
        <section className="home-final-cta">
          <div>
            <p className="home-kicker">O VESTIÁRIO ESTÁ ESPERANDO</p>
            <h2>
              A próxima decisão
              <br />é sua.
            </h2>
          </div>
          <div>
            <Link to={resume ? "/dashboard" : "/new"} className="home-button">
              {resume ? "Voltar ao meu clube" : "Assumir meu primeiro clube"}
              <ArrowRight size={19} />
            </Link>
            <p>
              Você pode começar como convidado.
              <br />
              <Link to="/auth">Entre na conta</Link> quando quiser usar a nuvem.
            </p>
          </div>
        </section>
        <SiteFooter path="/" />
      </div>
    </main>
  );
}
