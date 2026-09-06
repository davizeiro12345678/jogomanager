import { createFileRoute } from "@tanstack/react-router";

import { ArticleShell, Section } from "@/components/ArticleShell";
import { articleLd, breadcrumbLd, canonical, seoMeta } from "@/lib/seo";

const PATH = "/jogar-offline";
const TITLE = "Como jogar offline: carreira e partidas sem internet";
const DESC =
  "O jogo funciona sem internet: instale como aplicativo, jogue a carreira e as partidas offline e a sincronização acontece sozinha quando a conexão voltar.";

export const Route = createFileRoute("/jogar-offline")({
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH, type: "article" }),
    links: canonical(PATH),
    scripts: [
      articleLd({ headline: "Como jogar offline", description: DESC, path: PATH }),
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Jogar offline", path: PATH },
      ]),
    ],
  }),
  component: OfflinePage,
});

function OfflinePage() {
  return (
    <ArticleShell
      kicker="Offline"
      title="Jogue no avião, no metrô ou sem sinal"
      intro="A carreira inteira roda no seu aparelho. Sem internet você continua treinando, negociando e jogando partidas em 3D — nada se perde."
      path={PATH}
    >
      <Section title="Instale como aplicativo">
        <p>
          No celular, abra o menu do navegador e escolha “Adicionar à tela de início”. No
          computador, clique no ícone de instalação na barra de endereço. O jogo passa a abrir em
          tela cheia, com ícone próprio, e as telas já visitadas ficam guardadas.
        </p>
      </Section>
      <Section title="O que funciona sem conexão">
        <p>
          Carreira, treinos, táticas, mercado, temporada automática e todas as partidas em 3D contra
          o computador. Os escudos, camisas e elencos já carregados continuam disponíveis.
        </p>
      </Section>
      <Section title="O que precisa de internet">
        <p>
          Chat global, loja, assistente de inteligência artificial e o multiplayer 1x1. Quando você
          está offline, essas telas avisam claramente em vez de travar.
        </p>
      </Section>
      <Section title="Como o salvamento funciona">
        <p>
          Tudo é gravado no aparelho na hora, com histórico das últimas versões. Se você tem conta,
          as alterações feitas sem sinal entram numa fila e sobem sozinhas quando a conexão volta —
          o selo no topo mostra “salvo no aparelho” ou “sincronizado”. Se a nuvem tiver uma versão
          mais recente (outro aparelho), você escolhe qual manter.
        </p>
      </Section>
    </ArticleShell>
  );
}
