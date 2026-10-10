import { createFileRoute, Link } from "@tanstack/react-router";

import { ArticleShell, Section } from "@/components/ArticleShell";
import { articleLd, breadcrumbLd, canonical, seoMeta } from "@/lib/seo";

const PATH = "/guias";
const TITLE = "Guia de manager de futebol: como começar | JogoManager";
const DESC =
  "Comece uma carreira no Pro Football Manager 3D com um plano claro: escolha o clube, monte a escalação, ajuste as táticas e organize as decisões entre rodadas.";

export const Route = createFileRoute("/guias")({
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH, type: "article", keywords: [] }),
    links: canonical(PATH),
    scripts: [
      articleLd({
        headline: "Guia de manager de futebol: como começar",
        description: DESC,
        path: PATH,
      }),
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Guia do treinador", path: PATH },
      ]),
    ],
  }),
  component: GuidesPage,
});

const FAQ = [
  {
    q: "Qual é a melhor formação para começar?",
    a: "Não existe uma formação que funcione para todos os clubes. Escolha entre as quatro opções do jogo olhando primeiro para as posições e os jogadores que você já tem.",
  },
  {
    q: "O que revisar entre uma rodada e outra?",
    a: "Confira condição física, lesões, suspensões, moral, alternativas no banco, relatório da partida e situação financeira antes de confirmar a próxima decisão.",
  },
  {
    q: "Preciso contratar logo no começo?",
    a: "Não. Primeiro identifique uma lacuna real na escalação e no banco. O guia de elenco explica como avaliar olheiros, custo inicial e salário semanal antes de negociar.",
  },
  {
    q: "Uma vitória prova que a tática está certa?",
    a: "Não por si só. Leia também como as chances foram criadas e concedidas, e compare mais de uma partida antes de mudar ou confirmar o plano.",
  },
] as const;

function GuidesPage() {
  return (
    <ArticleShell
      kicker="Guia prático"
      title="Comece sua carreira de manager com um plano claro"
      intro="Este guia percorre o fluxo de uma carreira no Pro Football Manager 3D: escolher um desafio, entender o elenco inicial, preparar o primeiro jogo e rever as decisões a cada rodada. As orientações usam os controles e informações que existem no jogo, sem prometer resultados automáticos."
      path={PATH}
      readMinutes={9}
      level="Iniciante"
      updated="outubro de 2026"
      toc={[
        { id: "escolha-clube", title: "Escolha um desafio que combine com você" },
        { id: "diagnostico", title: "Faça um diagnóstico antes de escalar" },
        { id: "plano-jogo", title: "Monte um plano de jogo executável" },
        { id: "entre-rodadas", title: "Use uma rotina entre as rodadas" },
        { id: "decisoes", title: "Corrija um problema por vez" },
        { id: "primeiras-rodadas", title: "Checklist das primeiras rodadas" },
        { id: "modo-jogador", title: "Prefere acompanhar um atleta?" },
      ]}
      faq={FAQ}
    >
      <Section id="escolha-clube" title="Escolha um desafio que combine com você">
        <p>
          Antes de assumir um clube, pense no tipo de temporada que quer jogar. Um elenco forte
          permite disputar objetivos imediatos; um time com menos recursos pede mais cuidado com
          prioridades, reservas e evolução ao longo do calendário. Não escolha apenas pelo nome do
          clube: confira a competição, o elenco disponível, o orçamento inicial e o objetivo da
          diretoria.
        </p>
        <p>
          Defina uma meta de trabalho que você possa acompanhar, como fortalecer uma posição com
          poucas opções ou aprender a ajustar a equipe durante as partidas. Essa meta ajuda a
          decidir o que merece atenção primeiro e evita trocar jogadores, formação e instruções ao
          mesmo tempo.
        </p>
        <p>
          Quando estiver pronto para assumir, comece uma carreira em{" "}
          <Link to="/new" className="text-primary underline">
            escolher clube
          </Link>
          . Se ainda estiver conhecendo a apresentação das partidas, teste antes uma{" "}
          <Link to="/partida-rapida" className="text-primary underline">
            partida rápida
          </Link>
          .
        </p>
      </Section>

      <Section id="diagnostico" title="Faça um diagnóstico antes de escalar">
        <p>
          Comece pela formação do elenco, não por uma lista de contratações. Separe titulares e
          alternativas por posição, confira quem está lesionado ou suspenso e observe condição
          física e moral. Isso mostra se o problema está na qualidade de uma função, na falta de
          cobertura ou apenas na disponibilidade para a próxima partida.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Olhe a função:</strong> compare os jogadores que podem cumprir o papel pedido
            pela formação, em vez de escolher apenas pelo overall.
          </li>
          <li>
            <strong>Confira as alternativas:</strong> veja quem pode substituir cada titular sem
            desmontar outra posição.
          </li>
          <li>
            <strong>Leia a disponibilidade:</strong> condição, lesões e suspensões ajudam a decidir
            quem começa e quem fica no banco.
          </li>
          <li>
            <strong>Registre uma necessidade concreta:</strong> por exemplo, falta de cobertura para
            um lateral ou pouca criação no meio. Essa hipótese vai orientar o plano e o mercado.
          </li>
        </ul>
        <p>
          Um diagnóstico simples também dá um ponto de comparação. Depois de algumas rodadas, revise
          se a lacuna continua aparecendo ou se foi causada por uma lesão temporária ou por uma
          escolha tática.
        </p>
      </Section>

      <Section id="plano-jogo" title="Monte um plano de jogo que o elenco consiga executar">
        <p>
          O jogo oferece quatro esquemas: 4-3-3, 4-4-2, 3-5-2 e 4-2-3-1. Cada um pede uma
          distribuição diferente de funções. Escolha a estrutura que aproveita os jogadores
          disponíveis e confira se há substitutos para as posições mais exigentes do seu plano.
        </p>
        <p>
          Depois, ajuste mentalidade, pressão, amplitude e ritmo. Faça uma pergunta antes de cada
          mudança: que comportamento quero alterar? Se a equipe não encontra o atacante, observe as
          opções de apoio; se concede espaço pelos lados, confira a cobertura daquele setor. Uma
          alteração por vez facilita perceber o que mudou.
        </p>
        <p>
          No intervalo e após a partida, use o relatório e as estatísticas para conferir se a
          leitura inicial fez sentido. Não use só o placar como diagnóstico: uma vitória pode
          esconder um problema recorrente, e uma derrota isolada pode não justificar abandonar um
          plano que está criando boas chances.
        </p>
        <p>
          Para comparar as opções com mais detalhe, consulte o guia de{" "}
          <Link to="/taticas-e-formacoes" className="text-primary underline">
            táticas e formações
          </Link>
          .
        </p>
      </Section>

      <Section id="entre-rodadas" title="Use uma rotina entre as rodadas">
        <p>
          Uma rotina curta evita que decisões urgentes sejam tomadas sem contexto. Depois de cada
          jogo, revise disponibilidade e desempenho; antes do próximo, confirme escalação, banco,
          foco de treino e caixa. À medida que a temporada avança, observe se os mesmos problemas
          aparecem em partidas diferentes.
        </p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>Leia o resultado, os eventos e as estatísticas da última partida.</li>
          <li>Confira lesões, suspensões, condição física e moral do grupo.</li>
          <li>Reveja o foco de treino de acordo com a necessidade observada.</li>
          <li>
            Prepare titulares e banco para o próximo adversário e para as posições disponíveis.
          </li>
          <li>Confira orçamento, folha semanal e compromissos antes de assumir novos custos.</li>
        </ol>
        <p>
          Treino, condição e moral são informações diferentes. Use os relatórios da carreira para
          acompanhar o que mudou e evite interpretar um único indicador como garantia de desempenho
          em campo.
        </p>
      </Section>

      <Section id="decisoes" title="Corrija um problema por vez">
        <p>
          Quando a equipe atravessa uma sequência ruim, liste o que você observou antes de agir:
          chances concedidas por um setor, falta de apoio ao ataque, jogadores indisponíveis ou
          custo de elenco difícil de sustentar. Escolha a causa mais provável, faça uma mudança
          relacionada a ela e compare com as partidas seguintes.
        </p>
        <p>
          Nem todo problema pede uma contratação. Uma lesão pode pedir rotação; pouca cobertura no
          banco pode pedir reforço; uma equipe que não progride pode pedir ajuste de amplitude ou
          ritmo. Se a lacuna for estrutural, use os relatórios de scouting e compare o custo total
          antes de negociar no{" "}
          <Link to="/planejamento-de-elenco" className="text-primary underline">
            guia de planejamento do elenco
          </Link>
          .
        </p>
      </Section>

      <Section id="primeiras-rodadas" title="Checklist das primeiras rodadas">
        <ul className="list-disc space-y-2 pl-5">
          <li>Li o objetivo da diretoria e conheço o orçamento do clube.</li>
          <li>Sei quais posições têm titular e alternativa disponíveis.</li>
          <li>Escolhi uma formação compatível com as funções do elenco.</li>
          <li>Tenho uma hipótese específica para testar na próxima partida.</li>
          <li>Revisei condição, lesões, suspensões, moral e banco antes de avançar.</li>
          <li>
            Se pretendo contratar, comparei a necessidade com o custo inicial e a folha semanal.
          </li>
        </ul>
        <p>
          Se quiser entender como a carreira pode continuar sem conexão, veja as instruções sobre
          jogar{" "}
          <Link to="/jogar-offline" className="text-primary underline">
            offline e manter seus dados
          </Link>
          .
        </p>
      </Section>

      <Section id="modo-jogador" title="Prefere acompanhar a trajetória de um atleta?">
        <p>
          A carreira de treinador acompanha as decisões do clube inteiro. Se a sua ideia é criar um
          jogador, escolher a posição, treinar semana a semana e decidir lances importantes, conheça
          o modo de{" "}
          <Link to="/modo-carreira-de-jogador" className="text-primary underline">
            carreira de jogador de futebol
          </Link>
          . Os dois modos guardam trajetórias separadas.
        </p>
      </Section>
    </ArticleShell>
  );
}
