import { createFileRoute } from "@tanstack/react-router";

import { ArticleShell, Section } from "@/components/ArticleShell";
import { articleLd, breadcrumbLd, canonical, seoMeta } from "@/lib/seo";

const PATH = "/regras";
const TITLE = "Regras do futebol explicadas | Pro Football Manager 3D";
const DESC =
  "As regras do futebol em linguagem simples — tempo de jogo, impedimento, faltas, cartões, pênaltis, substituições e VAR — e como cada uma delas é aplicada dentro das partidas em 3D do jogo.";

export const Route = createFileRoute("/regras")({
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH, type: "article" }),
    links: canonical(PATH),
    scripts: [
      articleLd({ headline: "Regras do futebol", description: DESC, path: PATH }),
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
      title="Regras do futebol e como elas valem dentro do jogo"
      intro="Tempo, impedimento, faltas, cartões, pênaltis e substituições explicados sem juridiquês — e como o simulador aplica cada regra durante os 90 minutos em 3D."
      path={PATH}
      readMinutes={7}
      level="Iniciante"
      updated="setembro de 2026"
      toc={[
        { id: "tempo", title: "Tempo de jogo e acréscimos" },
        { id: "impedimento", title: "Impedimento" },
        { id: "faltas", title: "Faltas e bolas paradas" },
        { id: "cartoes", title: "Cartões e expulsões" },
        { id: "penaltis", title: "Pênaltis" },
        { id: "substituicoes", title: "Substituições e lesões" },
        { id: "classificacao", title: "Pontos, saldo e classificação" },
        { id: "var", title: "Arbitragem e VAR" },
      ]}
      faq={[
        {
          q: "O jogo segue as regras oficiais da IFAB?",
          a: "Sim, nas regras que afetam o resultado: dois tempos de 45 minutos, impedimento, faltas, cartões, pênaltis, substituições e critérios de classificação. Detalhes burocráticos de arbitragem não são simulados.",
        },
        {
          q: "Quantas substituições posso fazer?",
          a: "Cinco por partida, como no futebol atual. Uma vez trocado, o jogador não volta na mesma partida.",
        },
        {
          q: "Como funcionam os cartões ao longo da temporada?",
          a: "Cartão vermelho tira o jogador da partida e o suspende da próxima. Amarelos acumulam durante o campeonato e geram suspensão automática.",
        },
        {
          q: "O empate é decidido no critério de desempate?",
          a: "Na liga, sim: pontos, depois vitórias, depois saldo de gols e gols marcados. Em mata-mata, a partida vai para prorrogação e pênaltis.",
        },
      ]}
    >
      <Section id="tempo" title="1. Tempo de jogo e acréscimos">
        <p>
          A partida tem dois tempos de 45 minutos e intervalo. O árbitro acrescenta o tempo perdido
          com gols, substituições, lesões e atendimentos. No jogo, o relógio corre de forma contínua
          e o acréscimo aparece no placar, então uma decisão tomada aos 88 ainda dá tempo de mudar o
          resultado.
        </p>
      </Section>
      <Section id="impedimento" title="2. Impedimento">
        <p>
          Um atacante está impedido quando, no momento em que o companheiro toca a bola, ele está
          mais perto da linha de fundo adversária do que o penúltimo defensor. Não há impedimento em
          lateral, escanteio ou tiro de meta, nem quando o jogador está no próprio campo.
        </p>
        <p>
          Na simulação, a linha defensiva do time adversário sobe e desce em conjunto. Se você pedir
          marcação alta, seu adversário rasga as costas da defesa com mais frequência; se pedir
          linha baixa, cai o número de impedimentos e sobe o número de finalizações de fora.
        </p>
      </Section>
      <Section id="faltas" title="3. Faltas e bolas paradas">
        <p>
          Carrinho por trás, empurrão, segurar o adversário e jogar a mão na bola são faltas. A
          cobrança é direta quando o contato é claro e indireta em infrações técnicas. Perto da
          área, a falta vira uma das melhores chances de gol do jogo.
        </p>
        <p>
          Escanteios, laterais e faltas na entrada da área são simulados com base na altura, no
          cabeceio e na qualidade de cobrança dos seus jogadores — por isso um zagueiro alto muda o
          rendimento em bola parada.
        </p>
      </Section>
      <Section id="cartoes" title="4. Cartões e expulsões">
        <p>
          O amarelo pune falta dura, reclamação e perda de tempo. O vermelho vem por falta violenta,
          impedir gol claro com a mão ou dois amarelos. Com um jogador a menos, o time recua, perde
          posse e leva mais chutes.
        </p>
        <p>
          Uma tática muito agressiva aumenta o número de faltas e, com isso, o risco de expulsão.
          Esse é o custo real de pedir marcação forte o jogo inteiro.
        </p>
      </Section>
      <Section id="penaltis" title="5. Pênaltis">
        <p>
          Falta dentro da área ou mão na bola dentro da área é pênalti. O cobrador escolhido depende
          da sua escalação: finalização e frieza pesam na conversão, e o goleiro adversário tem
          chance real de defesa.
        </p>
      </Section>
      <Section id="substituicoes" title="6. Substituições e lesões">
        <p>
          São cinco substituições por partida. Trocar cedo um jogador desgastado evita lesão; trocar
          tarde custa rendimento nos minutos finais. Lesões durante o jogo forçam uma substituição e
          tiram o atleta das próximas rodadas conforme a gravidade.
        </p>
      </Section>
      <Section id="classificacao" title="7. Pontos, saldo e classificação">
        <p>
          Vitória vale 3 pontos, empate 1 e derrota nenhum. Em caso de igualdade, a ordem é número
          de vitórias, saldo de gols e gols marcados. As últimas colocações caem para a divisão de
          baixo e as primeiras sobem ou vão para competições continentais.
        </p>
      </Section>
      <Section id="var" title="8. Arbitragem e VAR">
        <p>
          O árbitro decide em campo e pode ser chamado a revisar gol, pênalti, expulsão e erro de
          identidade. No jogo, isso aparece como lances marcantes revistos antes da validação do
          gol: o placar só muda depois da confirmação.
        </p>
      </Section>
    </ArticleShell>
  );
}
