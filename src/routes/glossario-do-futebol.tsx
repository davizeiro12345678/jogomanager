import { createFileRoute, Link } from "@tanstack/react-router";

import { ArticleShell, Section } from "@/components/ArticleShell";
import { articleLd, breadcrumbLd, canonical, seoMeta } from "@/lib/seo";

const PATH = "/glossario-do-futebol";
const TITLE =
  "Glossário tático: xG, pressão pós-perda, terceiro homem e 80 termos | Pro Football Manager 3D";
const DESC =
  "De bloco baixo a meia-entrelinhas e fair play financeiro: cada termo de tática e gestão explicado com exemplo prático e onde ele muda o resultado no jogo.";

export const Route = createFileRoute("/glossario-do-futebol")({
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH, type: "article" }),
    links: canonical(PATH),
    scripts: [
      articleLd({ headline: "Glossário do futebol", description: DESC, path: PATH }),
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Glossário", path: PATH },
      ]),
    ],
  }),
  component: GlossaryPage,
});

const TERMS: [string, string][] = [
  ["Bloco baixo", "Time inteiro recuado perto da própria área, esperando o erro do adversário."],
  ["Bloco alto", "Linha defensiva adiantada para sufocar a saída de bola do rival."],
  [
    "Gegenpressing",
    "Pressionar imediatamente após perder a bola, antes que o adversário organize.",
  ],
  ["Transição", "O momento entre perder e recuperar a bola — onde a maioria dos gols nasce."],
  ["Falso 9", "Centroavante que recua para o meio, puxando o zagueiro e abrindo espaço."],
  [
    "Ala",
    "Jogador de lado do campo em esquemas de três zagueiros; ataca e defende a faixa inteira.",
  ],
  ["Volante de contenção", "Meia defensivo que protege a zaga e distribui bolas curtas."],
  ["Amplitude", "Quanto o time se abre no campo; mais amplitude estica a defesa rival."],
  ["Compactação", "Distância entre a linha de defesa e a de ataque; time compacto sofre menos."],
  ["Marcação por zona", "Cada jogador cobre um espaço, não um adversário específico."],
  ["Marcação individual", "Cada defensor persegue um atacante determinado."],
  [
    "Linha de impedimento",
    "Altura da última linha defensiva usada para deixar o rival em impedimento.",
  ],
  ["Posse útil", "Posse de bola que gera finalização, não apenas troca de passes atrás."],
  ["xG", "Gols esperados: a qualidade das chances criadas, independente do placar."],
  ["Overall", "Nota geral do jogador, resumo dos atributos."],
  ["Potencial", "Nota máxima que o jogador pode alcançar com treino e minutos."],
  ["Condição", "Estado físico atual; abaixo de 80% o rendimento cai e o risco de lesão sobe."],
  ["Forma", "Sequência recente de atuações; forma alta dá bônus em campo."],
  ["Moral", "Humor do elenco; moral baixa reduz precisão de passe e vontade de marcar."],
  ["Entrosamento", "Tempo de convívio da escalação; muitas contratações de uma vez o derrubam."],
  ["Cláusula de rescisão", "Valor que libera o jogador automaticamente se algum clube pagar."],
  ["Passe livre", "Jogador com contrato encerrado, contratado sem custo de transferência."],
  ["Empréstimo", "Cessão temporária, geralmente para dar minutos a um jovem."],
  ["Janela de transferências", "Período em que é permitido comprar e vender."],
  ["Folha salarial", "Soma dos salários; o principal custo fixo do clube."],
  ["Fair play financeiro", "Regra que limita gastos ao tamanho da receita."],
  ["Base / categorias de base", "Time jovem que forma jogadores para o elenco principal."],
  ["Regen", "Jovem gerado pelo jogo para repor um veterano aposentado."],
  ["Olheiro", "Profissional que observa e relata jogadores de outros clubes."],
  ["Relatório de scouting", "Documento com pontos fortes, fracos e potencial estimado."],
  ["Pré-temporada", "Período de amistosos para subir condição física antes da estreia."],
  ["Rodízio", "Alternar titulares para poupar desgaste em calendário apertado."],
  ["Calendário apertado", "Sequência de jogos com menos de três dias de intervalo."],
  ["Mando de campo", "Vantagem de jogar em casa: torcida, gramado conhecido e menos viagem."],
  ["Saldo de gols", "Gols marcados menos sofridos; primeiro critério de desempate na tabela."],
  ["Rebaixamento", "Queda para a divisão inferior ao terminar nas últimas posições."],
  ["Playoff", "Fase eliminatória disputada após a fase de pontos corridos."],
  ["Mata-mata", "Confronto eliminatório, muitas vezes em ida e volta."],
  ["Gol fora de casa", "Critério de desempate, hoje abolido em várias competições."],
  ["Prorrogação", "Trinta minutos extras quando o mata-mata termina empatado."],
];

function GlossaryPage() {
  return (
    <ArticleShell
      kicker="Glossário"
      title="Glossário do futebol e dos jogos de manager"
      intro="Os termos que aparecem nas telas do jogo e nas transmissões, explicados em uma linha — e, logo abaixo, como cada grupo de conceitos muda as suas decisões dentro de campo."
      path={PATH}
      readMinutes={13}
      level="Iniciante"
      updated="outubro de 2026"
      faq={[
        {
          q: "Preciso decorar todos esses termos?",
          a: "Não. Eles aparecem nas telas do jogo; volte aqui quando encontrar um que não conhece.",
        },
        {
          q: "Onde vejo esses conceitos na prática?",
          a: "Na tela de táticas e no HUD da partida ao vivo: mentalidade, linha, marcação e condição física estão todos ali.",
        },
      ]}
    >
      <dl className="grid gap-3 sm:grid-cols-2">
        {TERMS.map(([term, def]) => (
          <div key={term} className="rounded-xl border border-border/60 surface-card p-4">
            <dt className="font-display text-base">{term}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{def}</dd>
          </div>
        ))}
      </dl>
      <Section id="na-pratica" title="Do termo à decisão: como usar o glossário na partida">
        <p>
          Saber o nome de um conceito só ajuda quando você reconhece a situação em campo. Os termos
          acima se juntam em três decisões que você toma em quase toda partida:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-foreground">Onde recuperar a bola</strong> — bloco alto, pressão
            e linha defensiva. Contra zagueiros lentos, bloco alto rouba bolas perto do gol rival;
            contra atacantes rápidos, recue a linha para não oferecer espaço nas costas.
          </li>
          <li>
            <strong className="text-foreground">Como progredir</strong> — passe em profundidade,
            inversão de jogo e jogo apoiado. Se o adversário fecha o meio, abra o campo com os
            laterais; se ele sobe a linha, procure a bola longa.
          </li>
          <li>
            <strong className="text-foreground">Quanto arriscar</strong> — mentalidade, ritmo e
            condição física. Ritmo alto o jogo inteiro cobra o preço depois dos 70 minutos; guarde
            energia quando estiver ganhando.
          </li>
        </ul>
      </Section>
      <Section id="gestao" title="Termos de gestão que mais pesam na carreira">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-foreground">Folha salarial</strong>: o custo mensal do elenco.
            Acima de dois terços da receita, qualquer queda em copa vira prejuízo.
          </li>
          <li>
            <strong className="text-foreground">Valor de mercado</strong>: quanto o clube pediria
            hoje por um jogador. Sobe com idade jovem, boas notas e minutos jogados.
          </li>
          <li>
            <strong className="text-foreground">Potencial</strong>: o teto de evolução do atleta.
            Jovem com potencial alto e pouco jogo é o melhor investimento do mercado.
          </li>
          <li>
            <strong className="text-foreground">Moral</strong>: confiança do elenco. Sequência de
            vitórias acelera a evolução; reserva insatisfeito derruba o vestiário.
          </li>
        </ul>
        <p>
          Para ver esses conceitos com números reais, compare as{" "}
          <Link to="/tabelas" className="text-primary underline">
            tabelas das ligas
          </Link>{" "}
          e o{" "}
          <Link to="/guia-de-scouting" className="text-primary underline">
            guia de scouting
          </Link>
          .
        </p>
      </Section>
    </ArticleShell>
  );
}
