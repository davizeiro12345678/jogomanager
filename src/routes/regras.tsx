import { createFileRoute } from "@tanstack/react-router";

import { ArticleShell, Section } from "@/components/ArticleShell";
import { articleLd, breadcrumbLd, canonical, seoMeta } from "@/lib/seo";

const PATH = "/regras";
const TITLE = "Regras do futebol e a simulação do jogo | JogoManager";
const DESC =
  "Entenda impedimento, faltas, cartões, pênaltis e substituições. Veja o que o JogoManager simula e consulte a IFAB para a regra oficial do futebol.";

export const Route = createFileRoute("/regras")({
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH, type: "article" }),
    links: canonical(PATH),
    scripts: [
      articleLd({
        headline: "Regras do futebol e a simulação do jogo",
        description: DESC,
        path: PATH,
      }),
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Regras", path: PATH },
      ]),
    ],
  }),
  component: RulesPage,
});

function RulesPage() {
  return (
    <ArticleShell
      kicker="Regras"
      title="Regras do futebol: conceitos básicos e o que a simulação mostra"
      intro="Este guia resume situações comuns de uma partida e separa o que aparece no JogoManager da aplicação completa das Leis do Jogo. A simulação simplifica decisões de arbitragem; para uma regra oficial ou atualizada, consulte a IFAB."
      path={PATH}
      readMinutes={8}
      level="Iniciante"
      updated="outubro de 2026"
      toc={[
        { id: "tempo", title: "Tempo de jogo e acréscimos" },
        { id: "impedimento", title: "Impedimento" },
        { id: "faltas", title: "Faltas e bolas paradas" },
        { id: "cartoes", title: "Cartões e expulsões" },
        { id: "penaltis", title: "Pênaltis" },
        { id: "substituicoes", title: "Substituições" },
        { id: "limites", title: "O que a simulação não substitui" },
      ]}
      faq={[
        {
          q: "O jogo segue as regras oficiais da IFAB?",
          a: "O jogo modela situações como impedimentos, faltas, cartões e substituições, mas não reproduz integralmente as Leis do Jogo nem todos os procedimentos de arbitragem. Consulte a IFAB para uma decisão oficial.",
        },
        {
          q: "Quantas substituições posso fazer?",
          a: "A interface da partida permite até cinco substituições. Depois de usar as cinco, o controle fica indisponível.",
        },
        {
          q: "Como funcionam os cartões ao longo da temporada?",
          a: "Na simulação, dois amarelos na partida resultam em expulsão. Amarelos também contam na carreira e podem gerar suspensão conforme os limites do jogo.",
        },
        {
          q: "O jogo tem VAR?",
          a: "Não. A simulação atual não apresenta revisão de lances por VAR. Os eventos e o placar mostram as decisões produzidas pelo modelo da partida.",
        },
      ]}
    >
      <Section id="tempo" title="1. Tempo de jogo e acréscimos">
        <p>
          A partida é dividida em dois tempos com intervalo. O relógio do jogo também pode mostrar
          acréscimos; por isso, acompanhe o tempo exibido antes de decidir se acelera, pausa ou
          encerra a partida.
        </p>
      </Section>
      <Section id="impedimento" title="2. Impedimento">
        <p>
          A posição de impedimento é avaliada no momento em que um companheiro toca ou joga a bola:
          estar adiantado, por si só, não basta; o jogador também precisa participar ativamente do
          lance segundo a regra. A definição completa inclui situações e exceções que não cabem em
          uma única frase.
        </p>
        <p>
          O simulador registra lances de impedimento a partir do posicionamento e do passe. Use os
          eventos como leitura do jogo, sem assumir que a simulação cobre cada interpretação de
          arbitragem prevista nas Leis do Jogo.
        </p>
      </Section>
      <Section id="faltas" title="3. Faltas e bolas paradas">
        <p>
          Contato ilegal, mão na bola e outras infrações podem gerar uma falta e uma bola parada. A
          decisão concreta depende da situação e da avaliação do árbitro; o simulador representa
          esse tipo de evento de forma simplificada.
        </p>
        <p>
          Escanteios também aparecem nas estatísticas da partida. Leia o evento e a situação antes
          de atribuir o resultado a um único atributo do jogador.
        </p>
      </Section>
      <Section id="cartoes" title="4. Cartões e expulsões">
        <p>
          O amarelo registra uma advertência; dois amarelos para o mesmo jogador na partida podem
          resultar em expulsão. A carreira também acompanha cartões acumulados para aplicar as
          suspensões previstas no próprio jogo.
        </p>
        <p>
          Confira quem recebeu cartão antes de avançar a rodada e prepare uma alternativa para a
          posição caso o atleta fique suspenso.
        </p>
      </Section>
      <Section id="penaltis" title="5. Pênaltis">
        <p>
          Uma infração punível dentro da área pode levar a uma cobrança de pênalti segundo as Leis
          do Jogo. A simulação inclui cobranças e defesas, mas não cobre todas as circunstâncias e
          procedimentos possíveis de uma partida oficial.
        </p>
      </Section>
      <Section id="substituicoes" title="6. Substituições">
        <p>
          A tela da partida permite usar até cinco substituições e mostra quantas ainda restam.
          Avalie a função do jogador que sai e a posição de quem entra para não deixar uma lacuna na
          escalação. As regras de substituição em competições oficiais podem depender do regulamento
          da competição.
        </p>
      </Section>
      <Section id="limites" title="A simulação não substitui o regulamento oficial">
        <p>
          O JogoManager é um jogo de gestão e simulação. Ele simplifica a arbitragem e não usa VAR
          para rever lances. Uma partida oficial também segue o regulamento da competição, que pode
          definir detalhes adicionais para substituições, desempates, prorrogação e pênaltis.
        </p>
        <p>
          Para estudar a regra completa, consulte a publicação atual das{" "}
          <a
            href="https://www.theifab.com/laws-of-the-game-documents/"
            target="_blank"
            rel="noreferrer"
            className="text-primary underline"
          >
            Leis do Jogo da IFAB
          </a>
          . A página oficial oferece edições em vários idiomas, incluindo português brasileiro.
        </p>
      </Section>
    </ArticleShell>
  );
}
