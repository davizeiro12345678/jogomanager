import { createFileRoute, Link } from "@tanstack/react-router";

import { PublicLinks } from "@/components/PublicLinks";
import { articleLd, breadcrumbLd, canonical, seoMeta } from "@/lib/seo";

const PATH = "/mercado-de-transferencias";
const TITLE = "Mercado de transferências: como contratar bem | Pro Football Manager 3D: Jogo de Futebol Manager Online";
const DESC =
  "Monte seu elenco, defina táticas e assista aos 90 minutos em 3D. Jogo de manager de futebol online e grátis com clubes reais de 30+ ligas.";

export const Route = createFileRoute("/mercado-de-transferencias")({
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH, type: "article" }),
    links: canonical(PATH),
    scripts: [
      articleLd({ headline: "Mercado de transferências: como contratar bem", description: DESC, path: PATH }),
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Mercado de transferências", path: PATH },
      ]),
    ],
  }),
  component: Page,
});

const RULES = [
  ["Orçamento não é o limite real", "O limite é o que sobra depois da folha semanal. Uma contratação barata com salário alto quebra o clube mais rápido que uma cara com salário baixo."],
  ["Contrate por posição carente", "Um lateral 74 vale mais que um atacante 80 se você já tem três atacantes. Olhe o buraco do elenco, não a nota."],
  ["Jovem com potencial alto é investimento", "Entre 18 e 21 anos, com minutos em partidas fáceis, o jogador valoriza rápido e pode financiar duas contratações depois."],
  ["Empréstimo resolve temporada, não projeto", "Serve para tapar lesão ou suspensão sem comprometer a folha, mas o jogador volta e você fica com o mesmo elenco."],
  ["Cláusula de rescisão corta a negociação", "Quando existe, o clube não pode recusar. Vale checar antes de tentar uma proposta longa."],
  ["Venda no pico", "Acima dos 30 anos com valor alto é a hora de negociar: o valor cai a cada temporada e o salário continua pesando."],
  ["Clubes interessados são oportunidade", "Propostas por jogadores seus aparecem no mercado com valor, salário e prazo. Recusar tudo pode gerar insatisfação no vestiário."],
];

function Page() {
  return (
    <div className="pitch-bg min-h-screen px-4 py-14">
      <article className="mx-auto max-w-3xl">
        <p className="font-display text-xs uppercase tracking-[0.4em] text-primary">Mercado</p>
        <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">
          Mercado de transferências: como contratar bem
        </h1>
        <p className="mt-4 text-muted-foreground">
          Contratar é a decisão que mais muda uma temporada — e a que mais quebra carreiras. Sete
          regras que valem para qualquer clube.
        </p>

        <div className="mt-8 space-y-5">
          {RULES.map(([t, d]) => (
            <section key={t}>
              <h2 className="font-display text-xl">{t}</h2>
              <p className="mt-1 text-muted-foreground">{d}</p>
            </section>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            to="/new"
            className="rounded-lg bg-primary px-6 py-3 font-display text-sm uppercase tracking-widest text-primary-foreground"
          >
            Começar carreira
          </Link>
          <Link
            to="/dicas-de-gestao"
            className="rounded-lg border border-border px-6 py-3 font-display text-sm uppercase tracking-widest"
          >
            Mais dicas de gestão
          </Link>
        </div>

        <PublicLinks exclude={PATH} />
      </article>
    </div>
  );
}
