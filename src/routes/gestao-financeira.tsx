import { createFileRoute } from "@tanstack/react-router";

import { ArticleShell, Section } from "@/components/ArticleShell";
import { articleLd, breadcrumbLd, canonical, seoMeta } from "@/lib/seo";

const PATH = "/gestao-financeira";
const TITLE = "Gestão financeira no futebol: folha, orçamento e lucro no mercado";
const DESC =
  "Como equilibrar as contas do clube: folha salarial saudável, orçamento por temporada, receita de bilheteria e venda de jogadores sem enfraquecer o time.";

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
    >
      <Section title="A regra da folha salarial">
        <p>
          Mantenha a folha entre 50% e 65% da receita. Acima disso, qualquer eliminação precoce em
          copa vira prejuízo. O maior salário do elenco não deve passar de duas vezes e meia a média
          dos titulares.
        </p>
      </Section>
      <Section title="Orçamento de transferências">
        <p>
          Divida a verba em três: metade para o reforço principal, um terço para tapar a posição
          mais carente e o restante como reserva de emergência para lesões na segunda metade da
          temporada.
        </p>
      </Section>
      <Section title="Receitas que você controla">
        <p>
          Bilheteria cresce com boas campanhas e ingressos bem precificados; premiação de copa é o
          bônus mais rápido para clube pequeno; venda de jovem formado em casa é lucro quase
          integral, sem custo de compra.
        </p>
      </Section>
      <Section title="Quando vender um titular">
        <p>
          Venda quando a proposta passa de 1,5 vez o valor de mercado, quando o jogador tem 30+ anos
          ou quando existe um substituto pronto na base. Fora disso, segure — reconstruir ataque
          custa mais caro do que o caixa recebido.
        </p>
      </Section>
    </ArticleShell>
  );
}
