import { createFileRoute, Link } from "@tanstack/react-router";

import { PublicLinks } from "@/components/PublicLinks";
import { articleLd, breadcrumbLd, canonical, seoMeta } from "@/lib/seo";

const PATH = "/guias";
const TITLE = "Guias de manager de futebol: como começar bem | Pro Football Manager 3D";
const DESC =
  "Guias em português para quem quer virar manager de futebol: escolher o clube, montar a escalação, definir a tática e vencer a primeira temporada.";

export const Route = createFileRoute("/guias")({
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH, type: "article" }),
    links: canonical(PATH),
    scripts: [
      articleLd({ headline: "Guias de manager de futebol", description: DESC, path: PATH }),
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Guias", path: PATH },
      ]),
    ],
  }),
  component: GuidesPage,
});

const GUIDES = [
  {
    title: "Como escolher seu primeiro clube",
    body: "Times com força acima de 85 cobram título imediato; entre 70 e 78 você tem paciência da diretoria para construir um projeto. Se é sua primeira carreira, comece num clube de meio de tabela do Brasileirão: o orçamento é razoável e a cobrança é justa.",
  },
  {
    title: "Escalação: o básico que ganha jogo",
    body: "Nunca escale jogador com condição abaixo de 70 — ele cai de rendimento no segundo tempo. Respeite as posições: um atacante improvisado na zaga custa gols. Deixe pelo menos um goleiro e dois defensores no banco.",
  },
  {
    title: "Tática: mentalidade, pressão e ritmo",
    body: "Contra times mais fortes, use bloco baixo e mentalidade defensiva; contra times inferiores, pressão alta e mentalidade ofensiva. O ritmo alto cansa mais rápido: use no início e recue no segundo tempo para segurar o resultado.",
  },
  {
    title: "Dinheiro: salários antes de contratações",
    body: "Cada contratação soma salário semanal. Antes de comprar, veja quanto sobra do orçamento depois da folha e do custo da comissão técnica. Renovar contrato de quem está prestes a acabar é mais barato que substituir o jogador.",
  },
  {
    title: "Treino e lesões",
    body: "Treino de intensidade alta melhora atributos, mas aumenta o risco de lesão e a fadiga acumulada. Alterne semanas de foco físico com semanas de recuperação, especialmente perto de clássicos.",
  },
  {
    title: "Diretoria e torcida",
    body: "A pressão sobe com derrotas seguidas e com a distância do objetivo da temporada. Sequências de vitórias e bom desempenho em clássicos recuperam a aprovação rápido — e evitam a demissão.",
  },
];

function GuidesPage() {
  return (
    <div className="pitch-bg min-h-screen px-4 py-14">
      <div className="mx-auto max-w-3xl">
        <p className="font-display text-xs uppercase tracking-[0.4em] text-primary">Guias</p>
        <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">
          Guias de manager de futebol
        </h1>
        <p className="mt-4 text-muted-foreground">
          Tudo que você precisa para comandar um clube: escolha do time, escalação, tática,
          finanças e relação com a diretoria. Depois de ler, é só assumir um clube e jogar direto
          no navegador.
        </p>

        <div className="mt-10 space-y-8">
          {GUIDES.map((g) => (
            <article key={g.title}>
              <h2 className="font-display text-2xl">{g.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{g.body}</p>
            </article>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap gap-3">
          <Link
            to="/new"
            className="rounded-lg bg-primary px-6 py-3 font-display text-sm uppercase tracking-widest text-primary-foreground transition hover:brightness-110"
          >
            Assumir um clube
          </Link>
          <Link
            to="/dicas-de-gestao"
            className="rounded-lg border border-border px-6 py-3 font-display text-sm uppercase tracking-widest transition hover:bg-secondary"
          >
            Dicas de gestão
          </Link>
          <Link
            to="/ligas-de-futebol"
            className="rounded-lg border border-border px-6 py-3 font-display text-sm uppercase tracking-widest transition hover:bg-secondary"
          >
            Ligas disponíveis
          </Link>
        </div>

        <PublicLinks exclude="/guias" />
      </div>
    </div>
  );
}
