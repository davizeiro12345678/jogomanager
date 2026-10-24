import { Link } from "@tanstack/react-router";

import { PublicLinks } from "@/components/PublicLinks";

import { CREATOR } from "@/content/creator";

import { CommunityInvite } from "@/components/CommunityInvite";

import SHIPPED_CATALOG from "@/game/data/catalog-summary.generated.json";
import { LANGS } from "@/i18n/locale-catalog";
import { SOBRE_PATH as PATH } from "@/lib/public-route-paths";

const BLOCKS = [
  {
    title: "O que é o jogo",
    body: "Um jogo de técnico de futebol que roda direto no navegador, sem instalar nada. Você assume um clube, escolhe a escalação e a tática, negocia contratações e acompanha cada partida em 3D, com narração, torcida e placar ao vivo.",
  },
  {
    title: "A carreira de técnico",
    body: "Cada temporada tem liga, copa, orçamento, salários, pressão da diretoria e humor da torcida. Ganhar títulos abre portas em clubes maiores; sequências ruins podem custar o emprego. O calendário avança dia a dia, com treinos, lesões e transferências.",
  },
  {
    title: "Partidas em 3D",
    body: "O estádio, o gramado, as arquibancadas e os jogadores são gerados pelo próprio jogo, com clima, horário e desgaste do campo. As preferências gráficas permitem ajustar a apresentação; a fluidez depende do aparelho e do navegador.",
  },
  {
    title: "Grátis e sem obrigação de pagar",
    body: "Dá para jogar uma carreira inteira sem gastar nada. Produtos opcionais e seus efeitos são descritos na loja. Ofertas de vantagem competitiva indisponíveis ficam bloqueadas; compras não são necessárias para ganhar títulos.",
  },
  {
    title: "Seu progresso fica salvo",
    body: "Com conta, a carreira é guardada na nuvem e volta em qualquer aparelho. Sem internet, o jogo continua funcionando no próprio navegador e sincroniza assim que a conexão volta.",
  },
  {
    title: "Em português, com opções de idioma",
    body: "O jogo nasceu em português do Brasil, com clubes e competições brasileiras, e pode ser jogado em dezenas de outros idiomas. Nomes, escudos e uniformes podem ser editados por você no modo editor.",
  },
];

const PUBLIC_CLUB_COUNT = SHIPPED_CATALOG.playableClubs;

const FACTS = [
  { label: "Competições incluídas", value: String(SHIPPED_CATALOG.competitions) },
  { label: "Clubes únicos incluídos", value: String(PUBLIC_CLUB_COUNT) },
  { label: "Opções de idioma", value: String(LANGS.length) },
  { label: "Preço", value: "Grátis" },
];

export function SobrePage() {
  return (
    <div className="pitch-bg min-h-screen px-4 py-14">
      <div className="mx-auto max-w-3xl">
        <p className="font-display text-xs uppercase tracking-[0.4em] text-primary">Sobre</p>
        <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">
          Sobre o Pro Football Manager 3D
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          Um jogo de técnico de futebol feito para ser aberto e jogado na hora: escolha o clube,
          monte o time e viva a temporada inteira com as partidas acontecendo em 3D na sua frente.
        </p>

        <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {FACTS.map((f) => (
            <div
              key={f.label}
              className="rounded-xl border border-border/60 surface-card px-4 py-3 text-center"
            >
              <dt className="text-xs uppercase tracking-widest text-muted-foreground">{f.label}</dt>
              <dd className="font-display text-2xl text-primary">{f.value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-10 space-y-8">
          {BLOCKS.map((b) => (
            <article key={b.title}>
              <h2 className="font-display text-2xl">{b.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{b.body}</p>
            </article>
          ))}
        </div>

        <section className="mt-12 rounded-2xl border border-border/60 surface-card p-6">
          <h2 className="font-display text-2xl">Quem faz o jogo</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            O Pro Football Manager 3D é criado e mantido por{" "}
            <strong className="text-foreground">{CREATOR.name}</strong> —{" "}
            {CREATOR.role.toLowerCase()}. Bastidores, novidades e vídeos das partidas saem no canal
            do YouTube.
          </p>
          <p className="mt-3 flex flex-wrap gap-3 text-sm">
            <a
              href={CREATOR.youtube}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 font-display text-xs uppercase tracking-widest transition hover:bg-secondary"
            >
              Canal {CREATOR.youtubeLabel}
            </a>
            <Link
              to="/criador"
              className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 font-display text-xs uppercase tracking-widest transition hover:bg-secondary"
            >
              Sobre o criador
            </Link>
          </p>
        </section>

        <div className="mt-12 flex flex-wrap gap-3">
          <Link
            to="/new"
            className="rounded-lg bg-primary px-6 py-3 font-display text-sm uppercase tracking-widest text-primary-foreground transition hover:brightness-110"
          >
            Começar carreira
          </Link>
          <Link
            to="/guias"
            className="rounded-lg border border-border px-6 py-3 font-display text-sm uppercase tracking-widest transition hover:bg-secondary"
          >
            Ler os guias
          </Link>
          <Link
            to="/perguntas-frequentes"
            className="rounded-lg border border-border px-6 py-3 font-display text-sm uppercase tracking-widest transition hover:bg-secondary"
          >
            Perguntas frequentes
          </Link>
        </div>

        <section className="mt-10 rounded-xl border border-border/60 surface-card p-6">
          <h2 className="font-display text-2xl">Do primeiro teste ao seu projeto de clube</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Experimente uma partida rápida para conhecer o jogo. Na carreira, comece com uma
            escalação equilibrada, confira o orçamento antes de contratar e mantenha uma cópia
            exportada do progresso. Os guias ajudam a aprofundar cada decisão; a comunidade é um
            espaço para compartilhar o que você aprendeu.
          </p>
        </section>
        <section className="mt-12 space-y-4" aria-labelledby="sobre-escolher-modo">
          <h2 id="sobre-escolher-modo" className="font-display text-2xl">
            Qual modo combina com o seu objetivo?
          </h2>
          <section aria-labelledby="sobre-carreira">
            <h3 id="sobre-carreira" className="font-display text-xl">
              Quero construir uma equipe por várias temporadas
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Comece pela carreira de treinador: compare elenco, calendário e orçamento; defina
              metas e reveja as decisões depois das partidas. O catálogo de clubes e campeonatos
              pode mudar conforme a versão e os dados disponíveis.{" "}
              <Link to="/guias" className="text-primary underline">
                Entenda a carreira
              </Link>
              .
            </p>
          </section>
          <section aria-labelledby="sobre-partida">
            <h3 id="sobre-partida" className="font-display text-xl">
              Quero experimentar o simulador primeiro
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Na{" "}
              <Link to="/partida-rapida" className="text-primary underline">
                partida rápida
              </Link>
              , teste esquemas e observe os movimentos em campo antes de iniciar uma temporada
              longa. Para avaliar desempenho, compare no mesmo aparelho e nas mesmas configurações
              gráficas.
            </p>
          </section>
          <section aria-labelledby="sobre-catalogo">
            <h3 id="sobre-catalogo" className="font-display text-xl">
              Onde conferir os dados realmente disponíveis?
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Consulte as{" "}
              <Link to="/tabelas" className="text-primary underline">
                tabelas e ligas
              </Link>{" "}
              e a seleção de clube dentro do jogo. Um registro no banco de dados não significa
              necessariamente que a equipe esteja jogável com elenco completo em todos os modos.
            </p>
          </section>
        </section>
        <CommunityInvite />
        <PublicLinks exclude={PATH} />
      </div>
    </div>
  );
}
