import { createFileRoute } from "@tanstack/react-router";

import { ArticleShell, Section } from "@/components/ArticleShell";
import { articleLd, breadcrumbLd, canonical, seoMeta } from "@/lib/seo";

const PATH = "/guia-de-scouting";
const TITLE =
  "Scouting no futebol: como achar jovens craques baratos | Pro Football Manager 3D";
const DESC =
  "Como funciona o trabalho de olheiro: ler potencial e nota atual, escolher a faixa de idade certa, contratar por carência do elenco e reconhecer os quatro sinais de jogador barato.";

export const Route = createFileRoute("/guia-de-scouting")({
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
  return (
    <ArticleShell
      kicker="Scouting"
      title="Guia de scouting: encontrar craques antes dos rivais"
      intro="Um clube pequeno não vence comprando pronto: vence comprando cedo. Este guia mostra como ler um relatório de olheiro e onde procurar."
      path={PATH}
      readMinutes={5}
      level="Intermediário"
      updated="setembro de 2026"
      toc={[
        { id: "potencial", title: "Potencial vale mais que nota atual" },
        { id: "idade", title: "A janela de idade" },
        { id: "carencia", title: "Contrate por carência, não por vitrine" },
        { id: "sinais", title: "Sinais de bom negócio" },
        { id: "erros", title: "Erros clássicos de olheiro" },
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
    </ArticleShell>
  );
}
