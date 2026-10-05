import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
  Users,
  X,
} from "lucide-react";
import { SiteFooter } from "@/components/SiteFooter";
import { DiscordLink } from "@/components/CommunityInvite";
import { HomeDetails } from "./HomeDetails";
import heroAvif from "@/assets/hero-stadium.jpg?format=avif&w=640;1024;1600&quality=52&as=srcset";
import heroWebp from "@/assets/hero-stadium.jpg?format=webp&w=640;1024;1600&quality=62&as=srcset";
import heroFallback from "@/assets/hero-stadium.jpg?format=jpg&w=1024&quality=58&as=url";
import "./home.css";

const SYSTEMS = [
  {
    id: "tactics",
    label: "Tática",
    title: "O plano é seu. O campo responde.",
    text: "Ajuste as linhas, encontre espaço e mude a pressão durante o jogo. Uma substituição pode mudar a sua tarde.",
    detail: "Formação · mentalidade · pressão · substituições",
    to: "/taticas-e-formacoes",
  },
  {
    id: "squad",
    label: "Elenco",
    title: "Um time vai além de onze nomes.",
    text: "Observe a condição dos atletas, desenvolva os jovens e negocie reforços que fazem sentido para o seu clube.",
    detail: "Scouting · treino · contratos · vestiário",
    to: "/guia-de-scouting",
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
const FORMATIONS = {
  "4-3-3": [
    [50, 87],
    [15, 68],
    [38, 72],
    [62, 72],
    [85, 68],
    [50, 52],
    [30, 40],
    [70, 40],
    [17, 20],
    [50, 14],
    [83, 20],
  ],
  "4-4-2": [
    [50, 87],
    [15, 69],
    [38, 73],
    [62, 73],
    [85, 69],
    [16, 42],
    [38, 48],
    [62, 48],
    [84, 42],
    [36, 19],
    [64, 19],
  ],
  "3-5-2": [
    [50, 87],
    [26, 70],
    [50, 75],
    [74, 70],
    [10, 40],
    [35, 47],
    [50, 53],
    [65, 47],
    [90, 40],
    [36, 19],
    [64, 19],
  ],
} as const;
type Formation = keyof typeof FORMATIONS;

/** A lightweight SVG teaches the interaction; the actual 3D engine loads
 * through the game routes only. No league catalogue, simulation or Canvas. */
function TacticalPreview() {
  const [formation, setFormation] = useState<Formation>("4-3-3");
  return (
    <div className="home-tactics" aria-label="Prévia das formações">
      <div className="home-tactics-top">
        <span>PRANCHETA DO TREINADOR</span>
        <span>PRÉVIA</span>
      </div>
      <svg viewBox="0 0 240 300" role="img" aria-label={`Onze jogadores na formação ${formation}`}>
        <defs>
          <pattern id="home-mow" width="240" height="50" patternUnits="userSpaceOnUse">
            <rect width="240" height="25" fill="#17382c" />
            <rect y="25" width="240" height="25" fill="#1a3e30" />
          </pattern>
        </defs>
        <rect x="8" y="8" width="224" height="284" rx="5" fill="url(#home-mow)" />
        <g fill="none" stroke="#b6d2bd" strokeOpacity=".35" strokeWidth="1.2">
          <rect x="19" y="18" width="202" height="264" />
          <path d="M19 150h202M69 18v42h102V18M69 282v-42h102v42M97 18v15h46V18M97 282v-15h46v15" />
          <circle cx="120" cy="150" r="28" />
          <circle cx="120" cy="150" r="2" fill="#b6d2bd" />
        </g>
        {FORMATIONS[formation].map(([x, y], i) => (
          <g
            key={i}
            className="home-player"
            style={{ transform: `translate(${x * 2 + 20}px,${y * 2.64 + 18}px)` }}
          >
            <circle
              r="12"
              fill={i === 0 ? "#d9b967" : "#b4ec6b"}
              stroke="#081510"
              strokeWidth="3"
            />
            <text
              y="3.5"
              textAnchor="middle"
              fontSize="10"
              fontFamily="sans-serif"
              fontWeight="700"
              fill="#102416"
            >
              {i + 1}
            </text>
          </g>
        ))}
      </svg>
      <div className="home-formation-buttons" role="group" aria-label="Experimentar formação">
        {(Object.keys(FORMATIONS) as Formation[]).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={formation === f}
            onClick={() => setFormation(f)}
          >
            {f}
          </button>
        ))}
      </div>
      <p className="home-tactics-caption">Mude o desenho. Imagine a próxima jogada.</p>
    </div>
  );
}

export function FootballHome() {
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
        const [{ CLUBS }, { applyWorld }] = await Promise.all([
          import("@/game/data/leagues"),
          import("@/lib/world"),
        ]);
        if (active) {
          applyWorld();
          setResume({
            club: CLUBS[save.clubId]?.name ?? save.clubId,
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
          <source type="image/avif" srcSet={heroAvif} sizes="100vw" />
          <source type="image/webp" srcSet={heroWebp} sizes="100vw" />
          <img
            className="home-hero-image"
            src={heroFallback}
            alt="Treinador à beira do gramado em um estádio iluminado"
            width={1600}
            height={912}
            fetchPriority="high"
            decoding="async"
          />
        </picture>
        <div className="home-hero-shade" aria-hidden="true" />
        <div className="home-hero-content">
          <p className="home-kicker">
            <span />
            FUTEBOL. DECISÕES. HISTÓRIAS.
          </p>
          <h1 id="home-title">
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
          <dl className="home-hero-stats" aria-label="O jogo em números">
            <div>
              <dt>Clubes</dt>
              <dd>4.500+</dd>
            </div>
            <div>
              <dt>Jogadores reais</dt>
              <dd>26 mil</dd>
            </div>
            <div>
              <dt>Ligas</dt>
              <dd>600+</dd>
            </div>
          </dl>
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
          <div className="home-mode-grid">
            <Link to="/new" className="home-mode home-mode-career">
              <div className="home-mode-art" aria-hidden="true">
                <span>01</span>
                <Trophy size={86} />
              </div>
              <p className="home-kicker">O SEU PROJETO</p>
              <h3>Modo carreira</h3>
              <p>
                Escolha o clube, crie o treinador e conduza a próxima temporada. Elenco, tática,
                finanças e a torcida esperam por você.
              </p>
              <span className="home-mode-link">
                Assumir um clube
                <ArrowRight size={19} />
              </span>
            </Link>
            <Link to="/partida-rapida" className="home-mode">
              <div className="home-mode-art home-mode-art-match" aria-hidden="true">
                <span>02</span>
                <Gamepad2 size={76} />
              </div>
              <p className="home-kicker">O PRIMEIRO APITO</p>
              <h3>Partida rápida</h3>
              <p>
                Escolha dois times e vá para o estádio. Conheça os controles, as câmeras e o ritmo
                do jogo antes da sua carreira.
              </p>
              <span className="home-mode-link">
                Jogar uma partida
                <ArrowRight size={19} />
              </span>
            </Link>
            <Link to="/multiplayer" className="home-mode">
              <div className="home-mode-art home-mode-art-friends" aria-hidden="true">
                <span>03</span>
                <Users size={76} />
              </div>
              <p className="home-kicker">A RIVALIDADE CONTINUA</p>
              <h3>Com amigos</h3>
              <p>
                Abra uma sala, compartilhe o código e combine o próximo confronto. Cada treinador
                com o seu plano de jogo.
              </p>
              <span className="home-mode-link">
                Abrir multiplayer
                <ArrowRight size={19} />
              </span>
            </Link>
          </div>
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
          <TacticalPreview />
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
          <HomeDetails />
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
