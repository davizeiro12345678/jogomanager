import { createFileRoute } from "@tanstack/react-router";

import { ArticleShell } from "@/components/ArticleShell";
import { articleLd, breadcrumbLd, canonical, seoMeta } from "@/lib/seo";

const PATH = "/glossario-do-futebol";
const TITLE = "Glossário do futebol: 40 termos de tática e gestão explicados · Pro Football Manager 3D: Jogo de Futebol Manager Online";
const DESC =
  "Monte seu elenco, defina táticas e assista aos 90 minutos em 3D. Jogo de manager de futebol online e grátis com clubes reais de 30+ ligas.";

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
  ["Gegenpressing", "Pressionar imediatamente após perder a bola, antes que o adversário organize."],
  ["Transição", "O momento entre perder e recuperar a bola — onde a maioria dos gols nasce."],
  ["Falso 9", "Centroavante que recua para o meio, puxando o zagueiro e abrindo espaço."],
  ["Ala", "Jogador de lado do campo em esquemas de três zagueiros; ataca e defende a faixa inteira."],
  ["Volante de contenção", "Meia defensivo que protege a zaga e distribui bolas curtas."],
  ["Amplitude", "Quanto o time se abre no campo; mais amplitude estica a defesa rival."],
  ["Compactação", "Distância entre a linha de defesa e a de ataque; time compacto sofre menos."],
  ["Marcação por zona", "Cada jogador cobre um espaço, não um adversário específico."],
  ["Marcação individual", "Cada defensor persegue um atacante determinado."],
  ["Linha de impedimento", "Altura da última linha defensiva usada para deixar o rival em impedimento."],
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
      intro="Quarenta termos que aparecem nas telas do jogo e nas transmissões, explicados em uma linha cada."
      path={PATH}
    >
      <dl className="grid gap-3 sm:grid-cols-2">
        {TERMS.map(([term, def]) => (
          <div key={term} className="rounded-xl border border-border/60 surface-card p-4">
            <dt className="font-display text-base">{term}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{def}</dd>
          </div>
        ))}
      </dl>
    </ArticleShell>
  );
}
