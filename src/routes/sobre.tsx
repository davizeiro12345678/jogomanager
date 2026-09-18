import { createFileRoute, Link } from "@tanstack/react-router";

import { PublicLinks } from "@/components/PublicLinks";
import { CREATOR } from "@/content/changelog";
import { articleLd, breadcrumbLd, canonical, seoMeta } from "@/lib/seo";

const PATH = "/sobre";
const TITLE =
  "Sobre o Pro Football Manager 3D: Jogo de Futebol Manager Online: o jogo de técnico no navegador";
const DESC =
  "Sobre o Pro Football Manager 3D: um jogo de manager de futebol online, gratuito e com partidas em 3D, feito para quem ama futebol.";

export const Route = createFileRoute("/sobre")({
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH, type: "article" }),
    links: canonical(PATH),
    scripts: [
      articleLd({ headline: "Sobre o Pro Football Manager 3D", description: DESC, path: PATH }),
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Sobre", path: PATH },
      ]),
    ],
  }),
  component: SobrePage,
});

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
    body: "O estádio, o gramado, as arquibancadas e os jogadores são gerados pelo próprio jogo, com clima, horário e desgaste do campo. A qualidade se ajusta sozinha ao aparelho, então roda bem tanto no computador quanto no celular.",
  },
  {
    title: "Grátis e sem obrigação de pagar",
    body: "Dá para jogar uma carreira inteira sem gastar nada. As compras da loja são só atalhos: moedas, relatórios de olheiro, impulsos de treino e temas visuais. Nada disso é necessário para ganhar títulos.",
  },
  {
    title: "Seu progresso fica salvo",
    body: "Com conta, a carreira é guardada na nuvem e volta em qualquer aparelho. Sem internet, o jogo continua funcionando no próprio navegador e sincroniza assim que a conexão volta.",
  },
  {
    title: "Em português, com 39 idiomas",
    body: "O jogo nasceu em português do Brasil, com clubes e competições brasileiras, e pode ser jogado em dezenas de outros idiomas. Nomes, escudos e uniformes podem ser editados por você no modo editor.",
  },
];

const FACTS = [
  { label: "Ligas", value: "20+" },
  { label: "Clubes", value: "500+" },
  { label: "Idiomas", value: "39" },
  { label: "Preço", value: "Grátis" },
];

function SobrePage() {
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
            <strong className="text-foreground">{CREATOR.name}</strong> — {CREATOR.role.toLowerCase()}
            . Bastidores, novidades e vídeos das partidas saem no canal do YouTube.
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

        <PublicLinks exclude={PATH} />
      </div>
    </div>
  );
}
