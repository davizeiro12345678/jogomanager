import { createFileRoute, Link } from "@tanstack/react-router";

import { ArticleShell, Section } from "@/components/ArticleShell";
import { LeagueDataInsights } from "@/components/LeagueDataInsights";
import { getLeagueDigests } from "@/lib/real-football.functions";
import { articleLd, breadcrumbLd, canonical, seoMeta } from "@/lib/seo";

const PATH = "/dicas-de-gestao";
const TITLE = "Gestão de Clube de Futebol | Planejamento de Temporada";
const DESC =
  "Planeje a temporada no manager de futebol: calendário, rodízio, metas, orçamento, reserva de caixa e análise dos rivais sem promessas de vitória.";

export const Route = createFileRoute("/dicas-de-gestao")({
  loader: async () => ({ leagues: await getLeagueDigests().catch(() => []) }),
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH, type: "article" }),
    links: canonical(PATH),
    scripts: [
      articleLd({
        headline: "Como planejar a temporada de um clube",
        description: DESC,
        path: PATH,
        datePublished: "2026-09-18",
        dateModified: "2026-10-13",
      }),
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Guias", path: "/guias" },
        { name: "Gestão da temporada", path: PATH },
      ]),
    ],
  }),
  component: TipsPage,
});

const FAQ = [
  {
    q: "Qual é o tamanho ideal de elenco?",
    a: "Depende do calendário, do número de substituições e das posições disponíveis. O importante é ter alternativas nas funções mais exigidas sem comprometer o orçamento.",
  },
  {
    q: "Devo jogar da mesma maneira em casa e fora?",
    a: "Não há obrigação de mudar pelo mando. Observe as características do rival, seus próprios jogadores e o contexto da competição antes de alterar a estratégia.",
  },
  {
    q: "Quando devo rodar os titulares?",
    a: "Considere condição física, sequência de partidas, opções do banco e importância do próximo confronto. Rodízio serve para evitar sobrecarga, mas não precisa seguir calendário fixo.",
  },
  {
    q: "O que significa uma sequência de resultados ruins?",
    a: "Pode indicar problemas de tática, execução, elenco ou simplesmente adversários difíceis. Compare desempenho e chances criadas antes de mudar o projeto inteiro.",
  },
] as const;

function TipsPage() {
  const { leagues } = Route.useLoaderData();

  return (
    <ArticleShell
      kicker="Gestão esportiva"
      title="Como administrar uma temporada inteira no manager de futebol"
      intro="Uma temporada é uma sequência de decisões relacionadas: calendário, elenco, condição física, tática, objetivos e dinheiro. Este guia organiza o trabalho do treinador sem prometer vitórias automáticas."
      path={PATH}
      readMinutes={20}
      level="Intermediário"
      updated="13 de outubro de 2026"
      toc={[
        { id: "diagnostico", title: "Diagnóstico no início da temporada" },
        { id: "calendario", title: "Calendário e prioridades" },
        { id: "rotacao", title: "Rodízio e fadiga" },
        { id: "adversarios", title: "Preparação por adversário" },
        { id: "analise", title: "Avaliação depois das partidas" },
        { id: "diretoria", title: "Metas da diretoria" },
        { id: "financas", title: "Orçamento e reserva de caixa" },
        { id: "decisao", title: "Um exemplo de decisão difícil" },
        { id: "dados-gestao", title: "Dados das ligas reais" },
        { id: "revisao", title: "Revisão de meio de temporada" },
        { id: "rotina", title: "Rotina entre duas rodadas" },
        { id: "crise", title: "Diagnóstico de uma sequência ruim" },
        { id: "fechamento", title: "Balanço e próxima temporada" },
      ]}
      faq={FAQ}
    >
      <Section id="diagnostico" title="1. Diagnóstico no início da temporada">
        <p>
          Antes da primeira rodada, não comece procurando a contratação mais famosa. Confira a
          competição que vai disputar, as metas exibidas para o clube e os setores em que seu elenco
          possui poucas alternativas. Os três pontos formam um mapa das prioridades.
        </p>
        <p>
          Uma equipe que disputará apenas um campeonato pode aceitar uma distribuição diferente de
          minutos daquela que também enfrenta jogos eliminatórios. Compare goleiros, defensores,
          volantes, meias e atacantes. Para cada função, identifique quem pode jogar imediatamente,
          quem precisa de recuperação e quem oferece cobertura no banco.
        </p>
        <p>
          Registre duas listas: problemas que você consegue resolver com a escalação atual e
          problemas que exigem contratação. A primeira lista pertence ao planejamento tático; a
          segunda pode ser aprofundada no
          <Link to="/mercado-de-transferencias" className="text-primary underline">
            guia de mercado de transferências
          </Link>
          .
        </p>
      </Section>

      <Section id="calendario" title="2. Transforme o calendário em um plano">
        <p>
          Analise blocos de partidas, não apenas o próximo adversário. Três jogos próximos entre si
          podem exigir alternativas em posições de alto desgaste, enquanto uma semana sem partida
          pode servir para revisar a equipe e recuperar atletas.
        </p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            <strong className="text-foreground">Marque confrontos difíceis:</strong> rivais de alto
            nível ou fases eliminatórias.
          </li>
          <li>
            <strong className="text-foreground">Identifique intervalos curtos:</strong> observe
            quais jogadores acumulam mais minutos.
          </li>
          <li>
            <strong className="text-foreground">Liste alternativas:</strong> determine quais
            reservas cobrem mais de uma posição.
          </li>
          <li>
            <strong className="text-foreground">Reavalie semanalmente:</strong> lesões, suspensões e
            resultados podem mudar o plano.
          </li>
        </ol>
        <p>
          Um calendário apertado não significa que o treinador deva desistir de um torneio.
          Significa que precisa comparar riscos, prioridades e recursos reais, em vez de escalar a
          mesma equipe por hábito.
        </p>
      </Section>

      <Section id="rotacao" title="3. Rodízio: proteja a equipe sem perder a organização">
        <p>
          Rodar jogadores é mais do que substituir titulares cansados. Se seis atletas são trocados
          de uma só vez, a equipe passa a combinar perfis e funções diferentes. Faça substituições
          planejadas e acompanhe se os novos jogadores cumprem os papéis que a estratégia exige.
        </p>
        <p>
          Uma maneira prática de organizar o grupo é separá-lo em titulares frequentes, reservas
          capazes de iniciar partidas e jovens que precisam de oportunidades. Essa classificação
          deve ser revista: um reserva em boa fase pode merecer mais minutos, enquanto um titular
          pode precisar recuperar a condição física.
        </p>
        <p>
          Em confrontos sucessivos, compare o benefício da força máxima imediata com o risco de
          desgaste nos jogos seguintes. O efeito exato depende das regras e da simulação do jogo;
          não existe uma porcentagem universal de fadiga que garanta o resultado.
        </p>
      </Section>

      <Section
        id="adversarios"
        title="4. Prepare cada confronto de acordo com as características do rival"
      >
        <p>
          Observe onde o adversário concentra jogadores, de onde parte sua criação e como protege a
          defesa. Uma equipe que ataca pelos lados pede atenção diferente daquela que cria pelo
          centro. Não presuma que jogar em casa garante vantagem nem que a melhor tática é sempre
          atacar mais.
        </p>
        <p>
          Um treinador pode explorar pontas rápidos no 4-3-3, proteger o centro com dois volantes no
          4-2-3-1 ou buscar compactação no 4-4-2. Cada escolha tem custos: abrir espaço para os
          pontas pode expor os laterais, enquanto proteger demais a área pode limitar a saída para o
          ataque.
        </p>
        <p>
          Aprenda a avaliar os setores com o
          <Link to="/melhores-formacoes" className="text-primary underline">
            guia de formações e ajustes táticos
          </Link>
          .
        </p>
      </Section>

      <Section id="analise" title="5. Analise o jogo antes de julgar apenas o placar">
        <p>
          Vitória e derrota são resultados importantes, mas não contam sozinhos toda a história de
          uma partida. Uma equipe pode vencer criando poucas oportunidades ou perder depois de
          realizar um bom jogo. Compare adversários de força semelhante, observe de onde surgiram os
          lances e documente as mudanças.
        </p>
        <p>
          Depois de cada confronto, faça três perguntas: o time criou chances a partir do plano
          original? As oportunidades do rival surgiram de um problema recorrente? O desempenho
          físico permitiu manter a estratégia até o fim?
        </p>
        <p>
          Evite trocar formação, jogadores e mentalidade simultaneamente após uma derrota. Quando
          muitas variáveis mudam, fica difícil identificar por que o resultado seguinte foi
          diferente.
        </p>
      </Section>

      <Section id="diretoria" title="6. Metas da diretoria e decisões de longo prazo">
        <p>
          Antes de planejar uma temporada perfeita, entenda o objetivo que o jogo realmente
          apresenta para o clube. Um projeto de permanência na divisão pede escolhas diferentes de
          uma equipe que compete pelo título. Metas ambiciosas podem exigir planejamento de elenco e
          capacidade de adaptação ao longo do calendário.
        </p>
        <p>
          Crie três níveis de avaliação: objetivo mínimo, desenvolvimento esperado e desempenho
          excepcional. Esses níveis são uma ferramenta de organização pessoal, não regras
          automáticas de demissão ou premiação. Reavalie as prioridades quando o calendário ou a
          situação financeira mudar.
        </p>
      </Section>

      <Section id="financas" title="7. Finanças: transforme o saldo em um plano de temporada">
        <p>
          Saldo disponível, orçamento de transferências e capacidade de pagar salários são medidas
          diferentes. Antes de negociar, confira quais valores a sua carreira mostra e em qual
          período cada custo é cobrado. Não compare uma folha semanal com uma receita mensal sem
          converter ambos para o mesmo intervalo.
        </p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>Registre o caixa atual e os custos recorrentes conhecidos.</li>
          <li>Projete esses custos até a próxima revisão do calendário.</li>
          <li>
            Conte apenas receitas confirmadas; trate vendas e premiações futuras como cenários.
          </li>
          <li>Separe uma reserva para imprevistos antes de calcular quanto pode investir.</li>
          <li>Depois de contratar ou renovar, refaça a projeção com o novo custo recorrente.</li>
        </ol>
        <p>
          Exemplo fictício, em unidades monetárias: com caixa de 1 milhão, receitas confirmadas de
          300 mil e custos previstos de 800 mil no período, a projeção termina em 500 mil. Se você
          reservar 200 mil para imprevistos, restam 300 mil para decisões novas. Uma contratação de
          250 mil com salários adicionais de 100 mil no mesmo período ultrapassa esse limite em 50
          mil. O preço da transferência sozinho esconderia o risco.
        </p>
        <p>
          Esses valores ilustram uma conta de planejamento; não são os valores nem uma regra
          automática do jogo. Compare um cenário conservador com outro que inclua receitas incertas
          e escolha um compromisso que o clube consiga sustentar mesmo sem uma venda. A reserva
          adequada depende do calendário e dos custos, não de uma porcentagem fixa.
        </p>
        <p>
          Se a projeção ficar negativa, revise os gastos adiáveis e o custo das alternativas antes
          de enfraquecer uma posição essencial. Para avaliar o custo de cada reforço, consulte o{" "}
          <Link to="/mercado-de-transferencias" className="text-primary underline">
            guia de transferências
          </Link>
          . Para comparar candidatos, use o
          <Link to="/guia-de-scouting" className="text-primary underline">
            {" "}
            scouting
          </Link>
          .
        </p>
      </Section>

      <Section id="decisao" title="8. Caso ilustrativo: clássico antes de um jogo eliminatório">
        <p>
          Imagine que seu time enfrenta um clássico fora de casa e, três dias depois, uma decisão de
          copa. Dois jogadores importantes estão cansados e os reservas oferecem características
          diferentes. O erro seria escolher apenas entre escalar todos os titulares ou trocar o time
          inteiro.
        </p>
        <p>
          Compare a qualidade dos substitutos por função, estude quais setores podem aguentar
          rodízio e considere se o sistema tático precisa ser adaptado. Talvez preservar um lateral
          seja mais importante do que descansar um atacante. Talvez a melhor solução seja distribuir
          minutos ao longo das duas partidas.
        </p>
        <p>
          Esse exemplo não reproduz um resultado real nem garante que determinado plano vencerá.
          Serve para mostrar como decisões interligadas podem ser avaliadas antes de confirmar a
          escalação.
        </p>
      </Section>

      <LeagueDataInsights leagues={leagues} mode="gestao" />

      <Section id="revisao" title="9. Revisão de meio de temporada e preparação da próxima janela">
        <p>
          Quando metade do calendário tiver passado, compare seus objetivos iniciais com o que
          realmente aconteceu: posições com falta de opções, desempenho por função, desgaste,
          orçamento e resultados contra rivais semelhantes.
        </p>
        <p>
          Use os dados das ligas reais desta página como contexto, não como promessa do que ocorrerá
          dentro da simulação. A tabela de uma competição externa tem participantes e acontecimentos
          próprios; sua carreira cria outra história. Consulte as{" "}
          <Link to="/tabelas" className="text-primary underline">
            tabelas de futebol reais
          </Link>{" "}
          para explorar o contexto.
        </p>
        <p>
          Se o problema for a qualidade das alternativas disponíveis, identifique candidatos no{" "}
          <Link to="/guia-de-scouting" className="text-primary underline">
            scouting
          </Link>
          . Se envolver custos ou negociação, siga o
          <Link to="/mercado-de-transferencias" className="text-primary underline">
            guia específico de transferências
          </Link>
          . Assim, cada decisão usa um material diferente, em vez de repetir o mesmo artigo em
          várias páginas.
        </p>
        <p>
          Antes de alterações grandes na carreira, exporte uma cópia quando possível e confirme o
          estado da sincronização. Veja as
          <Link to="/jogar-offline" className="text-primary underline">
            orientações de salvamento e uso offline
          </Link>
          .
        </p>
      </Section>
      <Section id="rotina" title="10. Uma rotina curta entre duas rodadas">
        <p>
          Organize a revisão sempre na mesma ordem: resultado anterior, disponibilidade, próximo
          adversário, escalação e finanças. Uma ordem estável reduz a chance de esquecer uma
          suspensão ou confirmar uma negociação sem olhar o saldo previsto. O tempo necessário varia
          com o clube e a fase do calendário.
        </p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>Registre um problema e um ponto positivo da última partida.</li>
          <li>Confira condição, lesões, suspensões e opções para cada posição.</li>
          <li>Escolha uma prioridade para o próximo confronto, com uma alternativa no banco.</li>
          <li>Revise compromissos financeiros se houve contratação, venda ou renovação.</li>
          <li>Confira o estado do salvamento antes de encerrar a sessão ou mudar de aparelho.</li>
        </ol>
        <p>
          Em uma semana tranquila, aprofunde a avaliação do elenco. Em uma sequência apertada,
          priorize disponibilidade e cobertura. Uma decisão adiada conscientemente é melhor do que
          negociar por hábito sem uma carência definida. Retome o
          <Link to="/guias" className="text-primary underline">
            {" "}
            roteiro de primeiros passos
          </Link>
          quando precisar reorganizar a base do plano.
        </p>
      </Section>
      <Section id="crise" title="11. Como diagnosticar uma sequência ruim sem desmontar o projeto">
        <p>
          Separe três dimensões: resultados, desempenho observado e disponibilidade. Derrotas contra
          favoritos, chances perdidas e ausência de titulares não pedem necessariamente a mesma
          resposta. Procure padrões repetidos e considere a força dos adversários antes de comparar
          duas sequências do calendário.
        </p>
        <p>
          Se o time cria chances mas não converte, avalie os lances e o perfil dos atacantes. Se não
          chega à área, observe a conexão entre setores. Se cai sempre no fim, compare minutos,
          condição e banco. Faça uma mudança coerente com a hipótese, acompanhe a sequência seguinte
          e registre se o problema persistiu.
        </p>
        <p>
          Evite financiar uma reação com receitas que ainda dependem de venda ou premiação. Uma
          contratação pode resolver uma função e simultaneamente criar um problema de caixa. Compare
          a correção com as alternativas internas e use o
          <Link to="/mercado-de-transferencias" className="text-primary underline">
            {" "}
            método de custo total
          </Link>
          antes de assumir outro compromisso.
        </p>
      </Section>
      <Section id="fechamento" title="12. Termine a temporada com um balanço que ajude a próxima">
        <p>
          Compare metas iniciais e resultados, mas também examine quais funções tiveram cobertura,
          quais decisões aumentaram custos e quais jovens receberam oportunidades. Classifique
          necessidades como imediatas, importantes e adiáveis. Essa lista permite chegar à próxima
          janela com prioridades e limites definidos.
        </p>
        <p>
          Revise contratações pelo problema que deveriam resolver. Um reforço caro usado em outra
          função não testa a hipótese original. Um reserva que cobriu várias ausências pode ter sido
          valioso sem liderar as estatísticas. Documente essas diferenças antes de decidir quem
          permanece e qual perfil procurar.
        </p>
        <p>
          Guarde uma cópia da carreira quando a exportação estiver disponível e confira a
          sincronização. O balanço pessoal e o backup servem a objetivos diferentes: um preserva o
          raciocínio; o outro ajuda a preservar o progresso. Veja o
          <Link to="/jogar-offline" className="text-primary underline">
            {" "}
            guia de saves e conexão
          </Link>
          .
        </p>
      </Section>
    </ArticleShell>
  );
}
