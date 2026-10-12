import { createFileRoute, Link } from "@tanstack/react-router";

import { ArticleShell, Section } from "@/components/ArticleShell";
import { LeagueDataInsights } from "@/components/LeagueDataInsights";
import { getLeagueDigests } from "@/lib/real-football.functions";
import { articleLd, breadcrumbLd, canonical, seoMeta } from "@/lib/seo";

const PATH = "/guia-de-scouting";
const TITLE = "Scouting com dados reais: como achar craques baratos antes dos rivais | Pro Football Manager 3D";
const DESC =
  "Potencial x nota atual, curva de idade, carência por setor e ligas subvalorizadas: o método de olheiro aplicado a 200 mil atletas de 12 ligas reais.";

export const Route = createFileRoute("/guia-de-scouting")({
  loader: async () => ({ leagues: await getLeagueDigests().catch(() => []) }),
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH, type: "article" }),
    links: canonical(PATH),
    scripts: [
      articleLd({ headline: "Guia de scouting", description: DESC, path: PATH }),
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Guia de scouting", path: PATH },
      ]),
    ],
  }),
  component: ScoutingPage,
});

function ScoutingPage() {
  const { leagues } = Route.useLoaderData();
  return (
    <ArticleShell
      kicker="Scouting"
      title="Guia de scouting: encontrar craques antes dos rivais"
      intro="Um clube pequeno não vence comprando pronto: vence comprando cedo. Este guia mostra como ler um relatório de olheiro e onde procurar."
      path={PATH}
      readMinutes={9}
      level="Intermediário"
      updated="outubro de 2026"
      toc={[
        { id: "potencial", title: "Potencial vale mais que nota atual" },
        { id: "idade", title: "A janela de idade" },
        { id: "carencia", title: "Contrate por carência, não por vitrine" },
        { id: "sinais", title: "Sinais de bom negócio" },
        { id: "erros", title: "Erros clássicos de olheiro" },
        { id: "dados-scouting", title: "Onde procurar em cada liga" },
      ]}
      faq={[
        {
          q: "Prefiro um jovem promissor ou um veterano pronto?",
          a: "Jovem quando o objetivo é crescer ao longo de temporadas; veterano quando a meta é subir de divisão ou brigar por título agora.",
        },
        {
          q: "Quantos reforços por janela?",
          a: "Entre dois e quatro. Mais que isso quebra o entrosamento e derruba o rendimento nas primeiras rodadas.",
        },
        {
          q: "Onde acho jogadores baratos?",
          a: "Contratos acabando, clubes em crise, reservas de times grandes e atletas voltando de lesão longa.",
        },
      ]}
    >
      <Section id="potencial" title="1. Potencial vale mais que nota atual">
        <p>
          Um jogador de 19 anos com nota 68 e potencial 85 vale muito mais que um de 28 anos com 76
          fixos. Priorize a diferença entre o que ele é hoje e o que pode virar.
        </p>
      </Section>
      <Section id="idade" title="2. A janela de idade">
        <p>
          16 a 21 anos: compra barata, evolução rápida, risco alto. 22 a 26: pico de rendimento e
          preço máximo. 27 a 30: útil para brigar por título agora. 31+: só como líder de vestiário
          e por salário baixo.
        </p>
      </Section>
      <Section id="carencia" title="3. Contrate por carência, não por vitrine">
        <p>
          Antes de abrir o mercado, conte quantos jogadores você tem por posição. Duas opções por
          posição é o mínimo saudável; três é luxo que pesa na folha.
        </p>
      </Section>
      <Section id="sinais" title="4. Sinais de bom negócio">
        <p>
          Contrato acabando em um ano, clube em crise financeira, jogador reserva em time grande e
          atleta voltando de lesão longa são as quatro situações em que o preço cai bem abaixo do
          valor real.
        </p>
      </Section>
      <Section id="erros" title="5. Erros clássicos de olheiro">
        <p>
          Comprar sete jogadores na mesma janela (o time perde entrosamento), pagar salário acima da
          escala do elenco (destrói a moral dos titulares) e ignorar a condição física ao contratar
          em cima da estreia.
        </p>
      </Section>
      <Section id="metodo" title="6. Um método em quatro passos">
        <p>
          Primeiro, liste as posições com menos de dois jogadores. Segundo, olhe os clubes da metade
          de baixo da tabela com saldo de gols melhor que a posição: são elencos melhores que o
          momento e costumam vender abaixo do valor. Terceiro, filtre por idade conforme a meta da
          temporada. Quarto, confira lesões recentes antes de pagar.
        </p>
      </Section>
      <LeagueDataInsights leagues={leagues} mode="scouting" />
      <p className="mt-8">
        Depois de contratar, organize o elenco com as{" "}
        <Link to="/dicas-de-gestao" className="text-primary underline">
          dicas de gestão por liga
        </Link>{" "}
        e acompanhe as{" "}
        <Link to="/tabelas" className="text-primary underline">
          tabelas atualizadas
        </Link>
        .
      </p>
    </ArticleShell>
  );
}
