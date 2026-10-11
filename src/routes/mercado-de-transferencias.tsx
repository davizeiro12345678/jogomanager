import { createFileRoute, Link } from "@tanstack/react-router";

import { ArticleShell, Section, type GuideFaq, type GuideTocItem } from "@/components/ArticleShell";
import { articleLd, breadcrumbLd, canonical, seoMeta } from "@/lib/seo";

const PATH = "/mercado-de-transferencias";
const TITLE = "Guia de transferências | Pro Football Manager 3D";
const DESC =
  "Como contratar bem no mercado de transferências: orçamento, salários, contratos e o momento certo de comprar e vender jogadores.";

export const Route = createFileRoute("/mercado-de-transferencias")({
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH, type: "article" }),
    links: canonical(PATH),
    scripts: [
      articleLd({
        headline: "Mercado de transferências: como contratar bem",
        description: DESC,
        path: PATH,
      }),
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Mercado de transferências", path: PATH },
      ]),
    ],
  }),
  component: Page,
});

const RULES = [
  {
    id: "folha",
    title: "Orçamento não é o limite real",
    text: "O limite é o que sobra depois da folha semanal. Uma contratação barata com salário alto quebra o clube mais rápido que uma cara com salário baixo.",
  },
  {
    id: "posicao",
    title: "Contrate por posição carente",
    text: "Um lateral 74 vale mais que um atacante 80 se você já tem três atacantes. Olhe o buraco do elenco, não a nota.",
  },
  {
    id: "jovens",
    title: "Jovem com potencial alto é investimento",
    text: "Entre 18 e 21 anos, com minutos em partidas fáceis, o jogador valoriza rápido e pode financiar duas contratações depois.",
  },
  {
    id: "emprestimo",
    title: "Empréstimo resolve temporada, não projeto",
    text: "Serve para tapar lesão ou suspensão sem comprometer a folha, mas o jogador volta e você fica com o mesmo elenco.",
  },
  {
    id: "clausula",
    title: "Cláusula de rescisão corta a negociação",
    text: "Quando existe, o clube não pode recusar. Vale checar antes de tentar uma proposta longa.",
  },
  {
    id: "venda",
    title: "Venda no pico",
    text: "Acima dos 30 anos com valor alto é a hora de negociar: o valor cai a cada temporada e o salário continua pesando.",
  },
  {
    id: "propostas",
    title: "Clubes interessados são oportunidade",
    text: "Propostas por jogadores seus aparecem no mercado com valor, salário e prazo. Recusar tudo pode gerar insatisfação no vestiário.",
  },
] as const;

const TOC: readonly GuideTocItem[] = RULES.map((r) => ({ id: r.id, title: r.title }));

const FAQ: readonly GuideFaq[] = [
  {
    q: "Quanto da receita pode ir para salários?",
    a: "Como regra prática, mantenha a folha semanal abaixo de 60% da receita semanal. Acima disso, qualquer sequência ruim vira problema de caixa.",
  },
  {
    q: "Vale a pena contratar no meio da temporada?",
    a: "Sim, para tapar lesão em posição carente. Fora isso, esperar a janela seguinte costuma render um preço melhor.",
  },
  {
    q: "Como sei se um jovem vale o investimento?",
    a: "Peça relatório de scouting: potencial estimado acima da nota atual e idade até 21 anos são o sinal de que ele valoriza jogando.",
  },
];

function Page() {
  return (
    <ArticleShell
      kicker="Mercado"
      title="Mercado de transferências: como contratar bem"
      intro="Contratar é a decisão que mais muda uma temporada — e a que mais quebra carreiras. Sete regras que valem para qualquer clube, do interior à elite europeia."
      path={PATH}
      readMinutes={12}
      level="Intermediário"
      updated="outubro de 2026"
      toc={TOC}
      faq={FAQ}
    >
      {RULES.map((r) => (
        <Section key={r.id} id={r.id} title={r.title}>
          <p>{r.text}</p>
        </Section>
      ))}
      <Section id="janela" title="Plano de janela em 4 etapas">
        <ul className="list-disc space-y-2 pl-5">
          <li><strong className="text-foreground">Diagnóstico (antes de abrir a janela)</strong>: liste as posições com menos de dois jogadores aptos e os titulares acima de 31 anos. É ali que nasce a lista de compras.</li>
          <li><strong className="text-foreground">Lista curta</strong>: três alvos por posição, um caro, um médio e um jovem. Se o principal falhar, você não negocia desesperado no último dia.</li>
          <li><strong className="text-foreground">Venda antes de comprar</strong>: um reserva caro vendido libera salário e verba ao mesmo tempo.</li>
          <li><strong className="text-foreground">Reserva de emergência</strong>: guarde cerca de um sexto do orçamento para repor lesões na segunda metade da temporada.</li>
        </ul>
      </Section>
      <Section id="erros" title="Cinco erros que quebram clubes no mercado">
        <ul className="list-disc space-y-2 pl-5">
          <li>Contratar pelo overall sem olhar a posição — um meia a mais não resolve a lateral vazia.</li>
          <li>Dar salário de estrela a quem vai ser reserva; o vestiário cobra a conta.</li>
          <li>Comprar três jogadores para a mesma vaga e deixar todos insatisfeitos.</li>
          <li>Vender o artilheiro no meio da temporada sem substituto pronto.</li>
          <li>Ignorar a idade: atacante de 33 anos perde valor a cada mês, jovem de 19 ganha.</li>
        </ul>
      </Section>
      <Section id="mundo-real" title="O que o mercado real ensina">
        <p>
          Os grandes clubes alternam ciclos: compram jovens promissores, valorizam e vendem no pico para financiar a próxima geração. Nas <Link to="/tabelas" className="text-primary underline">páginas das ligas</Link> você encontra as promessas de até 23 anos que já estão entre os artilheiros e garçons — exatamente o perfil que vale mirar no modo carreira antes que o preço dispare.
        </p>
      </Section>
    </ArticleShell>
  );
}
