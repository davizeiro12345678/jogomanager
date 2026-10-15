import { createFileRoute, Link } from "@tanstack/react-router";

import { ArticleShell, Section } from "@/components/ArticleShell";
import { articleLd, breadcrumbLd, canonical, seoMeta } from "@/lib/seo";

const PATH = "/analise-de-partida-de-futebol";
const TITLE = "Como ler estatísticas de uma partida | JogoManager";
const DESC =
  "Interprete posse, chutes, xG e passes no JogoManager. Aprenda a transformar um dado do jogo em uma hipótese tática clara para a próxima partida.";

export const Route = createFileRoute("/analise-de-partida-de-futebol")({
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH, type: "article", keywords: [] }),
    links: canonical(PATH),
    scripts: [
      articleLd({
        headline: "Como analisar uma partida pelas estatísticas",
        description: DESC,
        path: PATH,
      }),
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Guias", path: "/guias" },
        { name: "Análise de partida", path: PATH },
      ]),
    ],
  }),
  component: MatchAnalysisPage,
});

const FAQ = [
  {
    q: "Ter mais posse significa que o time jogou melhor?",
    a: "Não necessariamente. Posse mostra quanto tempo a equipe controlou a bola, mas não informa sozinha se avançou, criou chances ou protegeu a própria área.",
  },
  {
    q: "O xG prevê quantos gols minha equipe fará?",
    a: "Não. No JogoManager, xG é uma estimativa produzida pelo simulador para as chances da partida. Use para comparar o volume e a qualidade estimada das oportunidades, sem tratar o número como placar garantido.",
  },
  {
    q: "Devo mudar a formação depois de uma derrota?",
    a: "Só se os lances e os números apontarem para um problema que a mudança pode resolver. Registre a hipótese e altere uma parte do plano por vez para entender o efeito.",
  },
  {
    q: "Qual estatística devo olhar primeiro?",
    a: "Comece pela pergunta da partida. Para entender a criação, compare chutes, chutes no gol e xG; para avaliar circulação, observe passes e acerto de passe junto dos eventos.",
  },
] as const;

const METRICS = [
  {
    name: "Posse",
    shows: "A parcela de tempo em que cada equipe teve a bola durante a simulação.",
    limit: "Não mede por si só território, perigo ou controle do resultado.",
  },
  {
    name: "Chutes e no gol",
    shows: "O volume de finalizações e quantas exigiram uma defesa ou acertaram a meta.",
    limit:
      "Um chute no gol ainda pode ser uma chance fácil para o goleiro; compare com xG e eventos.",
  },
  {
    name: "xG",
    shows: "A soma estimada das oportunidades de gol calculada pelo simulador.",
    limit:
      "É uma medida do modelo do jogo, não uma promessa de gols nem uma previsão do próximo placar.",
  },
  {
    name: "Passes e acerto de passe",
    shows: "Tentativas, passes completos e a porcentagem de acerto da equipe.",
    limit:
      "Um percentual alto pode coexistir com pouca progressão; leia também os lances e as chances criadas.",
  },
  {
    name: "Escanteios, faltas e cartões",
    shows: "Parte do contexto de pressão, disputas e disciplina que ocorreu na partida.",
    limit: "São sinais para investigar, não uma explicação automática para a vitória ou derrota.",
  },
] as const;

const DIAGNOSES = [
  {
    signal: "Muita posse e poucas chances",
    question: "A equipe consegue levar a bola a uma zona de finalização ou apenas troca passes?",
    test: "Revise largura e ritmo como hipóteses separadas. Observe se uma delas abre uma opção de passe ou acelera a chegada ao ataque.",
  },
  {
    signal: "Muitos chutes, pouco xG",
    question: "As finalizações surgem de posições pouco favoráveis ou sob pressão?",
    test: "Confira os eventos e o apoio ao atacante antes de aumentar ainda mais o volume de chutes.",
  },
  {
    signal: "xG alto, poucos gols",
    question: "A equipe criou oportunidades que podem se repetir ou foi uma única partida atípica?",
    test: "Compare mais jogos em contextos parecidos antes de trocar titulares, formação e instruções ao mesmo tempo.",
  },
  {
    signal: "Bom acerto de passe e poucos ataques",
    question: "Os passes completados estão levando a equipe para a frente?",
    test: "Veja onde os eventos terminam e teste uma alteração de ritmo ou amplitude, mantendo o restante do plano.",
  },
  {
    signal: "Muitas faltas ou cartões",
    question: "Em quais lances e minutos a disciplina se tornou um problema?",
    test: "Leia a linha do tempo e confira jogadores advertidos. Não atribua todos os cartões a um único ajuste sem observar os lances.",
  },
] as const;

function MatchAnalysisPage() {
  return (
    <ArticleShell
      kicker="Leitura de jogo"
      title="Como analisar uma partida pelas estatísticas"
      intro="O placar responde quem venceu; o relatório ajuda a entender como a partida se desenvolveu. Este roteiro explica os números mostrados durante o jogo no JogoManager e como usá-los para testar uma decisão tática sem tirar conclusões de um único resultado."
      path={PATH}
      readMinutes={8}
      level="Intermediário"
      updated="outubro de 2026"
      toc={[
        { id: "pergunta", title: "Comece pela pergunta, não pelo placar" },
        { id: "metricas", title: "O que cada estatística mostra" },
        { id: "diagnostico", title: "Passe do sinal para um teste" },
        { id: "comparar", title: "Compare partidas com contexto" },
        { id: "rotina", title: "Leve a análise para a próxima rodada" },
      ]}
      faq={FAQ}
    >
      <Section id="pergunta" title="Comece pela pergunta, não pelo placar">
        <p>
          Antes de abrir as estatísticas, escolha o que quer entender: por que a equipe criou pouco,
          por onde sofreu perigo ou se conseguiu levar a bola até o ataque. A pergunta define quais
          indicadores importam. Sem ela, é fácil destacar o número mais alto e ignorar o problema da
          partida.
        </p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            <strong>Resultado:</strong> registre o placar e o adversário, sem usá-los como única
            medida de desempenho.
          </li>
          <li>
            <strong>Processo:</strong> compare posse, chutes, chutes no gol, xG e passes completos.
          </li>
          <li>
            <strong>Contexto:</strong> releia os eventos, a formação, a condição do elenco e os
            cartões antes de decidir o que mudar.
          </li>
        </ol>
        <p>
          O painel de estatísticas pode ser aberto durante a partida. Os números descrevem a
          simulação do JogoManager; não são dados de rastreamento de uma partida real.
        </p>
      </Section>

      <Section id="metricas" title="O que cada estatística mostra — e o que não mostra">
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Significado e limites das estatísticas da partida</caption>
            <thead>
              <tr>
                <th scope="col" className="p-3">
                  Indicador
                </th>
                <th scope="col" className="p-3">
                  Ajuda a observar
                </th>
                <th scope="col" className="p-3">
                  Não conclua apenas isso
                </th>
              </tr>
            </thead>
            <tbody>
              {METRICS.map((metric) => (
                <tr key={metric.name} className="border-t border-border align-top">
                  <th scope="row" className="p-3">
                    {metric.name}
                  </th>
                  <td className="p-3 text-muted-foreground">{metric.shows}</td>
                  <td className="p-3 text-muted-foreground">{metric.limit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Para avaliar a criação, leia chutes, finalizações no gol e xG juntos. Para avaliar a
          circulação, compare passes completos e o número de oportunidades. Nenhum desses grupos
          substitui a leitura dos eventos e do momento em que cada lance aconteceu.
        </p>
      </Section>

      <Section id="diagnostico" title="Passe do sinal para um teste tático">
        <p>
          Uma estatística útil leva a uma pergunta verificável. A tabela sugere um próximo teste,
          não uma resposta universal: a mesma equipe pode precisar de outro ajuste contra um
          adversário ou em uma situação diferente.
        </p>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">
              Exemplos de diagnóstico de partida e próximos testes
            </caption>
            <thead>
              <tr>
                <th scope="col" className="p-3">
                  Sinal
                </th>
                <th scope="col" className="p-3">
                  Pergunta de diagnóstico
                </th>
                <th scope="col" className="p-3">
                  Próximo teste
                </th>
              </tr>
            </thead>
            <tbody>
              {DIAGNOSES.map((row) => (
                <tr key={row.signal} className="border-t border-border align-top">
                  <th scope="row" className="p-3">
                    {row.signal}
                  </th>
                  <td className="p-3 text-muted-foreground">{row.question}</td>
                  <td className="p-3 text-muted-foreground">{row.test}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Se a dificuldade estiver no desenho do time, compare as funções de cada esquema no guia de{" "}
          <Link to="/taticas-e-formacoes" className="text-primary underline">
            táticas e formações
          </Link>
          . Se estiver preparando o próximo jogo, siga a{" "}
          <Link to="/guias" className="text-primary underline">
            rotina de carreira
          </Link>
          .
        </p>
      </Section>

      <Section id="comparar" title="Compare partidas com contexto">
        <p>
          Anote formação, mentalidade, pressão, amplitude e ritmo junto dos números que está
          comparando. Registre também o adversário, o mando e qualquer expulsão ou lesão. Uma
          partida com dez jogadores ou contra uma equipe mais forte não é uma comparação direta com
          uma escalação completa contra outro adversário.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Escolha um indicador que corresponda à pergunta que você quer responder.</li>
          <li>Compare jogos de contexto parecido sempre que possível.</li>
          <li>Mude uma instrução por vez e deixe a formação estável durante o teste.</li>
          <li>Observe se o padrão aparece novamente antes de transformar a exceção em regra.</li>
        </ul>
        <p>
          xG e posse são úteis como partes de uma leitura, não como notas finais. Uma diferença
          pequena pode refletir variação da partida; a repetição de um problema em jogos comparáveis
          dá uma base melhor para revisar seu plano.
        </p>
      </Section>

      <Section id="rotina" title="Leve a análise para a próxima rodada">
        <p>
          Feche cada revisão com uma frase curta: “Quero testar X porque observei Y; vou comparar Z
          no próximo jogo”. Por exemplo: “Vou abrir a amplitude porque a equipe teve posse, mas
          criou poucas oportunidades; vou observar se chegam mais passes ao último terço”. Essa nota
          ajuda a separar a hipótese do resultado final.
        </p>
        <p>
          Você pode praticar essa leitura em uma{" "}
          <Link to="/partida-rapida" className="text-primary underline">
            partida rápida
          </Link>
          . Na carreira, depois de cada rodada, confira disponibilidade e banco com o guia de{" "}
          <Link to="/guias" className="text-primary underline">
            gestão entre partidas
          </Link>
          .
        </p>
      </Section>
    </ArticleShell>
  );
}
