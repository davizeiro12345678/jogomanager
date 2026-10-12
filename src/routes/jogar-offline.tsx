import { createFileRoute } from "@tanstack/react-router";

import { ArticleShell, Section } from "@/components/ArticleShell";
import { articleLd, breadcrumbLd, canonical, seoMeta } from "@/lib/seo";

const PATH = "/jogar-offline";
const TITLE = "Jogue o manager de futebol sem internet e sincronize depois | Pro Football Manager 3D";
const DESC =
  "Sua carreira fica salva no aparelho, as partidas rodam offline e o progresso sobe para a nuvem quando a conexão volta — sem perder temporadas.";

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
      <Section id="checklist" title="Checklist antes de ficar sem sinal">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Abra o jogo uma vez com internet e entre na carreira: assim escudos, camisas e elencos
            ficam guardados no aparelho.
          </li>
          <li>
            Visite as telas que vai usar (elenco, táticas, mercado) para que fiquem disponíveis
            offline.
          </li>
          <li>
            Se tiver conta, confirme o selo “sincronizado” no topo antes de sair — garante uma cópia
            na nuvem.
          </li>
          <li>Em viagens longas, use o modo de gráficos mais leve para economizar bateria.</li>
        </ul>
      </Section>
      <Section id="seguranca" title="Não perca seu progresso">
        <p>
          Uma carreira de convidado fica só no navegador deste aparelho. Limpar os dados do
          navegador apaga o save. Para jogar com tranquilidade, entre na sua conta antes de ficar
          offline: assim existe uma cópia na nuvem para recuperar em outro aparelho.
        </p>
      </Section>
    </ArticleShell>
  );
}
