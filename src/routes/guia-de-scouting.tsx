import { createFileRoute } from "@tanstack/react-router";

import { ArticleShell, Section } from "@/components/ArticleShell";
import { articleLd, breadcrumbLd, canonical, seoMeta } from "@/lib/seo";

const PATH = "/guia-de-scouting";
const TITLE = "Guia de scouting: como achar jovens craques antes dos rivais · Pro Football Manager 3D: Jogo de Futebol Manager Online";
const DESC =
  "Monte seu elenco, defina táticas e assista aos 90 minutos em 3D. Jogo de manager de futebol online e grátis com clubes reais de 30+ ligas.";

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
    >
      <Section title="1. Potencial vale mais que nota atual">
        <p>
          Um jogador de 19 anos com nota 68 e potencial 85 vale muito mais que um de 28 anos com 76
          fixos. Priorize a diferença entre o que ele é hoje e o que pode virar.
        </p>
      </Section>
      <Section title="2. A janela de idade">
        <p>
          16 a 21 anos: compra barata, evolução rápida, risco alto. 22 a 26: pico de rendimento e
          preço máximo. 27 a 30: útil para brigar por título agora. 31+: só como líder de vestiário
          e por salário baixo.
        </p>
      </Section>
      <Section title="3. Contrate por carência, não por vitrine">
        <p>
          Antes de abrir o mercado, conte quantos jogadores você tem por posição. Duas opções por
          posição é o mínimo saudável; três é luxo que pesa na folha.
        </p>
      </Section>
      <Section title="4. Sinais de bom negócio">
        <p>
          Contrato acabando em um ano, clube em crise financeira, jogador reserva em time grande e
          atleta voltando de lesão longa são as quatro situações em que o preço cai bem abaixo do
          valor real.
        </p>
      </Section>
      <Section title="5. Erros clássicos de olheiro">
        <p>
          Comprar sete jogadores na mesma janela (o time perde entrosamento), pagar salário acima da
          escala do elenco (destrói a moral dos titulares) e ignorar a condição física ao contratar
          em cima da estreia.
        </p>
      </Section>
    </ArticleShell>
  );
}
