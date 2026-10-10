import { createFileRoute, Link } from "@tanstack/react-router";

import { ArticleShell, Section } from "@/components/ArticleShell";
import { articleLd, breadcrumbLd, canonical, seoMeta } from "@/lib/seo";

const PATH = "/comparativo-jogos-manager";
const TITLE = "Como escolher um jogo de manager de futebol";
const DESC =
  "Compare simulação, carreira, partidas, modo offline, multiplayer, celular e custos para escolher um jogo de manager de futebol. Veja onde o Pro Football Manager 3D se encaixa.";

export const Route = createFileRoute("/comparativo-jogos-manager")({
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH, type: "article", keywords: [] }),
    links: canonical(PATH),
    scripts: [
      articleLd({
        headline: "Como escolher um jogo de manager de futebol",
        description: DESC,
        path: PATH,
      }),
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Como escolher um jogo de manager", path: PATH },
      ]),
    ],
  }),
  component: ComparePage,
});

const CHECKS = [
  {
    criterion: "Decisões de gestão",
    question: "O jogo permite escolher escalação, tática e substituições?",
    why: "Verifique quais decisões você toma antes e durante a partida. Uma boa apresentação não substitui controles claros para montar a equipe.",
  },
  {
    criterion: "Ciclo de carreira",
    question: "O que muda entre uma partida e a próxima?",
    why: "Veja como calendário, elenco, contratos, treinos, orçamento e objetivos do clube se conectam ao longo da temporada.",
  },
  {
    criterion: "Forma de assistir",
    question: "Há texto, campo 2D ou partida em 3D?",
    why: "Escolha a apresentação que combina com seu tempo e preferência. Compare também se é possível acelerar, assistir ou simular o jogo.",
  },
  {
    criterion: "Modo de jogo",
    question: "Você quer jogar sozinho, contra amigos ou em uma liga online?",
    why: "Carreira individual, confronto direto e competição persistente com outros usuários são experiências diferentes. Confirme quais modos existem e se exigem conexão.",
  },
  {
    criterion: "Acesso e continuidade",
    question: "Onde o jogo funciona e como o progresso é salvo?",
    why: "Confira suporte ao seu aparelho, requisitos de instalação, sincronização entre dispositivos e o que continua disponível sem internet.",
  },
  {
    criterion: "Preço e compras",
    question: "O que é gratuito e o que custa à parte?",
    why: "Leia a descrição da loja, identifique compras opcionais e recorrentes e avalie o jogo pelo conteúdo que você realmente pretende usar.",
  },
] as const;

const FAQ = [
  {
    q: "Um jogo de manager no navegador é sempre mais simples?",
    a: "Não. A plataforma não revela sozinha a profundidade do jogo. Confira quais sistemas de carreira, elenco, tática e competição estão presentes e experimente o fluxo disponível.",
  },
  {
    q: "Partida em 3D significa uma simulação melhor?",
    a: "Não necessariamente. O 3D descreve a apresentação visual. Para avaliar a gestão, observe as decisões disponíveis, as regras da partida e como os resultados afetam a temporada.",
  },
  {
    q: "Como comparar jogos gratuitos?",
    a: "Confira o que pode ser jogado sem pagar, quais compras são opcionais e se há limites ou recursos recorrentes. Não compare apenas o preço inicial.",
  },
  {
    q: "Qual é a forma mais rápida de saber se vou gostar?",
    a: "Faça uma partida curta, teste os controles e depois examine uma carreira. Assim você avalia tanto a apresentação do jogo quanto as decisões entre rodadas.",
  },
] as const;

function ComparePage() {
  return (
    <ArticleShell
      kicker="Guia de escolha"
      title="Como escolher um jogo de manager de futebol"
      intro="Não existe um formato ideal para todo mundo. Compare o tipo de gestão, a apresentação das partidas, os modos disponíveis e as condições de acesso antes de investir tempo em uma temporada. Este guia oferece critérios práticos e descreve o Pro Football Manager 3D com base nos recursos disponíveis no próprio jogo."
      path={PATH}
      readMinutes={8}
      level="Iniciante"
      updated="outubro de 2026"
      toc={[
        { id: "prioridade", title: "Defina o que você quer jogar" },
        { id: "criterios", title: "Compare seis critérios" },
        { id: "simulacao", title: "Separe visual e profundidade" },
        { id: "avaliar", title: "Teste antes de começar uma carreira" },
        { id: "jogomanager", title: "Onde o Pro Football Manager 3D se encaixa" },
      ]}
      faq={FAQ}
    >
      <Section id="prioridade" title="Defina o que você quer jogar">
        <p>
          Antes de comparar nomes ou imagens, escolha a experiência que procura. Você pode querer
          uma carreira longa com decisões entre rodadas, partidas rápidas para conhecer as equipes,
          confronto direto com outra pessoa ou uma competição online. Também vale definir quanto
          tempo quer dedicar por sessão e se pretende jogar principalmente no computador ou no
          celular.
        </p>
        <p>
          Anote duas prioridades e uma condição indispensável. Por exemplo: gerir uma temporada,
          assistir a partidas em vez de receber apenas o placar e poder continuar sem conexão. Essa
          lista torna a comparação mais objetiva e ajuda a descartar recursos que parecem atraentes,
          mas não fazem diferença para o seu jeito de jogar.
        </p>
      </Section>

      <Section id="criterios" title="Compare seis critérios antes de escolher">
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">
              Critérios para comparar jogos de manager de futebol
            </caption>
            <thead>
              <tr>
                <th scope="col" className="p-3">
                  Critério
                </th>
                <th scope="col" className="p-3">
                  Pergunta para fazer
                </th>
                <th scope="col" className="p-3">
                  O que observar
                </th>
              </tr>
            </thead>
            <tbody>
              {CHECKS.map((item) => (
                <tr key={item.criterion} className="border-t border-border">
                  <th scope="row" className="p-3 align-top">
                    {item.criterion}
                  </th>
                  <td className="p-3 align-top">{item.question}</td>
                  <td className="p-3 align-top text-muted-foreground">{item.why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Procure respostas nas telas de demonstração, na página oficial e nas regras do jogo. Se
          uma característica não estiver explicada, trate-a como algo a confirmar, não como um
          recurso garantido. Isso é especialmente importante para salvamento em nuvem, jogo offline
          e compras opcionais.
        </p>
      </Section>

      <Section id="simulacao" title="Separe apresentação visual de profundidade da simulação">
        <p>
          Uma partida em 3D ajuda a acompanhar lances e a reconhecer a formação em campo, mas não
          responde sozinha se a gestão é profunda. Para isso, examine o que você pode decidir: quem
          escala, quais instruções táticas existem, como as substituições funcionam e quais dados
          ajudam a revisar o desempenho depois do apito final.
        </p>
        <p>
          Faça o mesmo para a carreira. Verifique se calendário, condição dos jogadores, orçamento,
          contratos e objetivos influenciam suas escolhas. Um ciclo de temporada fica mais legível
          quando o jogo mostra por que uma decisão importa e permite observar seu efeito nas rodadas
          seguintes. Compare os sistemas que você realmente usará, em vez de contar recursos pelo
          nome.
        </p>
      </Section>

      <Section id="avaliar" title="Teste antes de começar uma carreira longa">
        <ol className="list-decimal space-y-2 pl-5">
          <li>Abra uma partida curta e confira controles, legibilidade e ritmo.</li>
          <li>Observe como escalação, formação e substituições aparecem durante o jogo.</li>
          <li>
            Entre em uma carreira e localize calendário, elenco, orçamento e próximo compromisso.
          </li>
          <li>Leia as opções de salvamento, sincronização e funcionamento sem internet.</li>
          <li>Consulte a loja e separe os recursos gratuitos das compras opcionais.</li>
          <li>
            Repita o teste no aparelho em que pretende jogar e ajuste a qualidade visual se
            necessário.
          </li>
        </ol>
        <p>
          No Pro Football Manager 3D, uma{" "}
          <Link to="/partida-rapida" className="text-primary underline">
            partida rápida
          </Link>{" "}
          permite conhecer a apresentação em 3D. Para entender a sequência de decisões, consulte o{" "}
          <Link to="/guias" className="text-primary underline">
            guia para começar uma carreira
          </Link>
          .
        </p>
      </Section>

      <Section id="jogomanager" title="Onde o Pro Football Manager 3D se encaixa">
        <p>
          O Pro Football Manager 3D é um manager de futebol que roda no navegador e oferece
          carreira, escolhas de escalação e tática, mercado, partidas em 3D e uma opção de jogar
          offline após os dados necessários estarem disponíveis no aparelho. Alguns recursos que
          dependem de serviço, como chat, loja, assistente e multiplayer, precisam de conexão.
        </p>
        <p>
          A experiência pode ser experimentada em uma partida rápida antes de assumir uma temporada.
          Se o planejamento do elenco for sua prioridade, veja como funcionam os{" "}
          <Link to="/planejamento-de-elenco" className="text-primary underline">
            relatórios de scouting, transferências e custos
          </Link>
          . Para os detalhes de disponibilidade e sincronização, leia o guia de{" "}
          <Link to="/jogar-offline" className="text-primary underline">
            jogo offline
          </Link>
          .
        </p>
      </Section>
    </ArticleShell>
  );
}
