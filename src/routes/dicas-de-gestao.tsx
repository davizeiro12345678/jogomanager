import { createFileRoute, Link } from "@tanstack/react-router";

import { ArticleShell, Section } from "@/components/ArticleShell";
import { LeagueDataInsights } from "@/components/LeagueDataInsights";
import { getLeagueDigests } from "@/lib/real-football.functions";
import { articleLd, breadcrumbLd, canonical, seoMeta } from "@/lib/seo";

const PATH = "/dicas-de-gestao";
const TITLE = "Gestão de clube com números de 12 ligas: mando, empates, folha e caixa | Pro Football Manager 3D";
const DESC =
  "Quanto vale o mando de campo, quando rodar titulares, quanto da receita pode ir para salários: decisões de diretoria baseadas em dados reais de 12 campeonatos.";

export const Route = createFileRoute("/dicas-de-gestao")({
  loader: async () => ({ leagues: await getLeagueDigests().catch(() => []) }),
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH, type: "article" }),
    links: canonical(PATH),
    scripts: [
      articleLd({
        headline: "Dicas de gestão do clube com dados reais",
        description: DESC,
        path: PATH,
      }),
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Dicas de gestão", path: PATH },
      ]),
    ],
  }),
  component: TipsPage,
});

const FAQ = [
  {
    q: "Quantos jogadores devo ter no elenco?",
    a: "Entre 22 e 26. Em ligas com muitas lesões registradas, fique perto de 26; abaixo de 22, duas lesões já comprometem a escalação.",
  },
  {
    q: "Devo jogar igual em casa e fora?",
    a: "Não. Na maioria das ligas os mandantes vencem bem mais que os visitantes. Use a tabela desta página para saber quanto pesa o mando na sua liga.",
  },
  {
    q: "Vale a pena treinar sempre em intensidade alta?",
    a: "Não. O ganho de atributos vem junto com fadiga e lesão. Alterne semanas fortes com semanas de recuperação, principalmente na reta final.",
  },
  {
    q: "Quando a diretoria demite o treinador?",
    a: "Quando uma sequência de derrotas se soma à distância da meta da temporada. Vitórias seguidas recuperam a confiança rapidamente.",
  },
] as const;

function TipsPage() {
  const { leagues } = Route.useLoaderData();
  return (
    <ArticleShell
      kicker="Gestão"
      title="Dicas de gestão do clube, com dados reais de cada liga"
      intro="Regras práticas para não ser demitido na décima rodada, ajustadas ao que os números das ligas reais mostram: quanto pesa jogar em casa, quantos jogos terminam empatados e quantos gols cada campeonato produz."
      path={PATH}
      readMinutes={9}
      level="Intermediário"
      updated="outubro de 2026"
      toc={[
        { id: "elenco", title: "Elenco: tamanho e equilíbrio" },
        { id: "mando", title: "Mando de campo e rodízio" },
        { id: "contratos", title: "Contratos e valorização" },
        { id: "vestiario", title: "Vestiário e moral" },
        { id: "caixa", title: "Caixa e metas da diretoria" },
        { id: "folha", title: "Folha salarial e orçamento" },
        { id: "vender", title: "Receitas e quando vender um titular" },
        { id: "dados-gestao", title: "O que fazer em cada liga" },
      ]}
      faq={FAQ}
    >
      <Section id="elenco" title="Elenco: tamanho e equilíbrio">
        <p>
          Comece contando jogadores por posição, não somando notas. O mínimo saudável é dois por
          posição; três só onde a função cansa mais, como laterais e volantes. Um elenco entre 22 e
          26 atletas aguenta lesões sem estourar a folha salarial.
        </p>
        <p>
          Contrate pela carência. Um lateral 74 rende mais que um atacante 80 quando você já tem
          três atacantes. Jovens de 18 a 21 anos com potencial alto valorizam rápido: dê minutos a
          eles contra adversários mais fracos.
        </p>
      </Section>
      <Section id="mando" title="Mando de campo e rodízio">
        <p>
          Nas ligas reais desta página, os mandantes vencem bem mais que os visitantes. Por isso o
          rodízio inteligente usa o calendário: força máxima em casa e mais rodízio fora,
          principalmente em semanas com dois jogos.
        </p>
        <p>
          Onde a taxa de empates é alta, um ponto fora de casa vale muito. Leve no banco um atacante
          de área para os últimos 20 minutos de jogos travados, em vez de um meia criativo.
        </p>
      </Section>
      <Section id="contratos" title="Contratos e valorização">
        <p>
          Renove com dois anos de antecedência: no último ano o jogador exige muito mais ou sai de
          graça. Venda quem passou dos 30 com valor de mercado alto, porque é o pico do lucro. Ao
          renovar um titular, suba a cláusula de rescisão.
        </p>
      </Section>
      <Section id="vestiario" title="Vestiário e moral">
        <p>
          Moral baixa derruba o rendimento em campo. Dê minutos a quem está insatisfeito antes de
          ele pedir para sair. Uma comissão técnica boa acelera a recuperação de lesões e costuma
          render mais que um reserva caro.
        </p>
      </Section>
      <Section id="caixa" title="Caixa e metas da diretoria">
        <p>
          Não gaste todo o orçamento na primeira janela: guarde reserva para repor lesões no meio da
          temporada. Cumpra a meta da diretoria antes de sonhar com título; sobreviver ao primeiro
          ano é o que libera orçamento no segundo. Uma oferta muito acima do valor por um titular
          pode pagar dois reforços.
        </p>
      </Section>
      <Section id="folha" title="Folha salarial e orçamento">
        <p>
          Mantenha a folha entre 50% e 65% da receita. Acima disso, qualquer eliminação precoce em
          copa vira prejuízo. O maior salário do elenco não deve passar de duas vezes e meia a média
          dos titulares. Divida a verba de transferências em três: metade para o reforço principal,
          um terço para a posição mais carente e o restante como reserva para lesões na segunda
          metade da temporada.
        </p>
      </Section>
      <Section id="vender" title="Receitas e quando vender um titular">
        <p>
          Bilheteria cresce com boas campanhas e ingressos bem precificados; premiação de copa é o
          bônus mais rápido para clube pequeno; venda de jovem formado em casa é lucro quase
          integral. Venda um titular quando a proposta passa de 1,5 vez o valor de mercado, quando
          ele tem 30+ anos ou quando existe substituto pronto na base. Fora disso, segure —
          reconstruir o ataque custa mais do que o caixa recebido.
        </p>
      </Section>
      <LeagueDataInsights leagues={leagues} mode="gestao" />
      <p className="mt-8">
        Quer escolher onde comprar? Veja o{" "}
        <Link to="/guia-de-scouting" className="text-primary underline">
          guia de scouting com dados das ligas
        </Link>{" "}
        ou confira a{" "}
        <Link to="/tabelas" className="text-primary underline">
          classificação completa de cada campeonato
        </Link>
        .
      </p>
    </ArticleShell>
  );
}
