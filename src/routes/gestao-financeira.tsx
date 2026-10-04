import { createFileRoute } from "@tanstack/react-router";

import { ArticleShell, Section } from "@/components/ArticleShell";
import { articleLd, breadcrumbLd, canonical, seoMeta } from "@/lib/seo";

const PATH = "/gestao-financeira";
const TITLE = "Gestão financeira do clube | Pro Football Manager 3D";
const DESC =
  "Aprenda a controlar folha salarial, orçamento de transferências e receitas para não quebrar o clube no Pro Football Manager 3D.";

export const Route = createFileRoute("/gestao-financeira")({
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH, type: "article" }),
    links: canonical(PATH),
    scripts: [
      articleLd({ headline: "Gestão financeira no futebol", description: DESC, path: PATH }),
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Gestão financeira", path: PATH },
      ]),
    ],
  }),
  component: FinancePage,
});

function FinancePage() {
  return (
    <ArticleShell
      kicker="Finanças"
      title="Gestão financeira: como não quebrar o clube"
      intro="Time bom com caixa no vermelho vira liquidação no meio da temporada. Estas são as contas que todo treinador precisa acompanhar."
      path={PATH}
      readMinutes={5}
      level="Intermediário"
      updated="setembro de 2026"
      toc={[
        { id: "folha", title: "A regra da folha salarial" },
        { id: "orcamento", title: "Orçamento de transferências" },
        { id: "receitas", title: "Receitas que você controla" },
        { id: "vender", title: "Quando vender um titular" },
      ]}
      faq={[
        {
          q: "Qual o limite saudável da folha salarial?",
          a: "Entre 50% e 65% da receita do clube. Acima disso, qualquer eliminação precoce em copa vira prejuízo.",
        },
        {
          q: "Posso gastar todo o orçamento de transferências?",
          a: "Não convém. Guarde cerca de um sexto como reserva para repor lesões na segunda metade da temporada.",
        },
        {
          q: "Qual a receita mais rápida para um clube pequeno?",
          a: "Premiação de copa, seguida da venda de um jovem formado em casa, que é lucro quase integral.",
        },
      ]}
    >
      <Section id="folha" title="A regra da folha salarial">
        <p>
          Mantenha a folha entre 50% e 65% da receita. Acima disso, qualquer eliminação precoce em
          copa vira prejuízo. O maior salário do elenco não deve passar de duas vezes e meia a média
          dos titulares.
        </p>
      </Section>
      <Section id="orcamento" title="Orçamento de transferências">
        <p>
          Divida a verba em três: metade para o reforço principal, um terço para tapar a posição
          mais carente e o restante como reserva de emergência para lesões na segunda metade da
          temporada.
        </p>
      </Section>
      <Section id="receitas" title="Receitas que você controla">
        <p>
          Bilheteria cresce com boas campanhas e ingressos bem precificados; premiação de copa é o
          bônus mais rápido para clube pequeno; venda de jovem formado em casa é lucro quase
          integral, sem custo de compra.
        </p>
      </Section>
      <Section id="vender" title="Quando vender um titular">
        <p>
          Venda quando a proposta passa de 1,5 vez o valor de mercado, quando o jogador tem 30+ anos
          ou quando existe um substituto pronto na base. Fora disso, segure — reconstruir ataque
          custa mais caro do que o caixa recebido.
        </p>
      </Section>
    </ArticleShell>
  );
}
