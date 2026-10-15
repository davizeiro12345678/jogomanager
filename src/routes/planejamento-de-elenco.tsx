import { createFileRoute, Link } from "@tanstack/react-router";

import { ArticleShell, Section } from "@/components/ArticleShell";
import { articleLd, breadcrumbLd, canonical, seoMeta } from "@/lib/seo";

const PATH = "/planejamento-de-elenco";
const TITLE = "Scouting e transferências: planeje o elenco | JogoManager";
const DESC =
  "Use relatórios de olheiros para comparar posição, overall, potencial e valor. Planeje transferências considerando taxa, luvas, comissão e salário semanal.";

export const Route = createFileRoute("/planejamento-de-elenco")({
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH, type: "article", keywords: [] }),
    links: canonical(PATH),
    scripts: [
      articleLd({
        headline: "Scouting e transferências: como planejar seu elenco",
        description: DESC,
        path: PATH,
      }),
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Guias", path: "/guias" },
        { name: "Planejamento do elenco", path: PATH },
      ]),
    ],
  }),
  component: SquadPlanningPage,
});

const FAQ = [
  {
    q: "Quantos relatórios os olheiros podem trazer?",
    a: "O comando de scouting gera 3 relatórios mais o nível do departamento de olheiros e o investimento de scouting definido no plano operacional. O investimento altera a quantidade, não promete maior precisão.",
  },
  {
    q: "Potencial alto garante que o jogador vai evoluir?",
    a: "Não. Potencial indica um limite de desenvolvimento no sistema do jogo. Ele não garante crescimento, minutos, melhora imediata nem desempenho em campo.",
  },
  {
    q: "Em quais rodadas posso contratar?",
    a: "A janela fica aberta nas rodadas 1 a 4 e 19 a 22. Fora desses períodos, uma contratação pode ser bloqueada mesmo que o jogador e o valor estejam corretos.",
  },
  {
    q: "Por que uma proposta acessível pode ser recusada pelo jogo?",
    a: "O caixa precisa cobrir os custos iniciais e manter a reserva projetada para quatro semanas de operação e salários. A janela, o clube atual do jogador e uma contratação anterior também podem impedir a assinatura.",
  },
] as const;

function SquadPlanningPage() {
  return (
    <ArticleShell
      kicker="Elenco e mercado"
      title="Scouting e transferências: monte um elenco sustentável"
      intro="Um reforço útil resolve uma necessidade sem comprometer as decisões seguintes. Este guia explica como ler os relatórios dos olheiros, comparar jogadores pela função e avaliar o custo da contratação e da folha no Pro Football Manager 3D."
      path={PATH}
      readMinutes={10}
      level="Intermediário"
      updated="outubro de 2026"
      toc={[
        { id: "diagnostico", title: "Defina a necessidade antes de buscar nomes" },
        { id: "scouting", title: "Leia um relatório de scouting" },
        { id: "comparar", title: "Compare candidatos pela função" },
        { id: "janela", title: "Planeje a janela de transferências" },
        { id: "custo", title: "Calcule o custo completo" },
        { id: "decidir", title: "Decida entre contratar, vender ou esperar" },
        { id: "checklist", title: "Checklist antes de assinar" },
      ]}
      faq={FAQ}
    >
      <Section id="diagnostico" title="Defina a necessidade antes de buscar nomes">
        <p>
          Comece pela escalação e pelo banco. Marque as funções sem uma alternativa adequada e
          diferencie uma lacuna permanente de uma ausência temporária por lesão ou suspensão. Depois
          confira o desenho tático que pretende usar: a mesma posição pode ter exigências diferentes
          em formações diferentes.
        </p>
        <p>
          Transforme a lacuna em critérios que você possa conferir no mercado: posição, nível atual,
          idade adequada ao horizonte do clube, atributos necessários para a função e limite de
          salário semanal. Definir esses critérios antes de olhar os melhores nomes evita gastar
          tempo e orçamento com jogadores que não resolvem o problema identificado.
        </p>
        <p>
          Se ainda estiver escolhendo a estrutura da equipe, consulte primeiro o guia de{" "}
          <Link to="/taticas-e-formacoes" className="text-primary underline">
            táticas e formações
          </Link>
          . A necessidade de elenco fica mais clara depois de saber quais funções seu plano exige.
        </p>
      </Section>

      <Section id="scouting" title="Leia um relatório de scouting">
        <p>
          O relatório de olheiro reúne clube, posição, idade, OVR atual, potencial e valor estimado.
          Use esses campos juntos: OVR ajuda a comparar o nível atual, potencial indica o teto de
          desenvolvimento do sistema, idade informa o horizonte do projeto e valor ajuda a preparar
          uma negociação.
        </p>
        <p>
          No jogo, enviar olheiros gera três relatórios mais um relatório por nível do departamento
          de olheiros e um por nível de investimento em scouting. Aumentar esse investimento amplia
          a quantidade de nomes gerados; não significa que a precisão de cada relatório aumentou.
        </p>
        <p>
          A diferença entre potencial e OVR pode ajudar a encontrar espaço para desenvolvimento, mas
          não é uma promessa de evolução. Potencial não substitui atributos úteis para a posição,
          condição física, salário ou necessidade imediata do elenco. Também não use faixas de idade
          rígidas como regra universal: um projeto de curto prazo e outro de várias temporadas têm
          prioridades diferentes.
        </p>
        <p>
          Trate o valor mostrado no relatório como uma estimativa do jogo, não como garantia de que
          o clube aceitará uma proposta pelo mesmo montante. Verifique o preço pedido e os termos da
          assinatura na tela de mercado antes de decidir.
        </p>
      </Section>

      <Section id="comparar" title="Compare candidatos pela função">
        <p>
          O overall resume o nível geral, mas dois jogadores com a mesma nota podem servir a papéis
          diferentes. Compare os atributos que importam para a posição e para o estilo que você
          definiu, depois confira se o jogador pode entrar na equipe agora e se existe uma
          alternativa caso ele fique indisponível.
        </p>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Critérios para comparar reforços</caption>
            <thead>
              <tr>
                <th scope="col" className="p-3">
                  Critério
                </th>
                <th scope="col" className="p-3">
                  Pergunta prática
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border">
                <th scope="row" className="p-3">
                  Adequação
                </th>
                <td className="p-3 text-muted-foreground">
                  Ele ocupa a posição e cumpre a função que está faltando?
                </td>
              </tr>
              <tr className="border-t border-border">
                <th scope="row" className="p-3">
                  Nível atual
                </th>
                <td className="p-3 text-muted-foreground">
                  Ele melhora o titular, oferece rotação ou é uma aposta de desenvolvimento?
                </td>
              </tr>
              <tr className="border-t border-border">
                <th scope="row" className="p-3">
                  Desenvolvimento
                </th>
                <td className="p-3 text-muted-foreground">
                  O potencial informado comporta crescimento e o clube tem tempo para desenvolvê-lo?
                </td>
              </tr>
              <tr className="border-t border-border">
                <th scope="row" className="p-3">
                  Sustentabilidade
                </th>
                <td className="p-3 text-muted-foreground">
                  O custo inicial e o salário cabem sem eliminar a reserva necessária?
                </td>
              </tr>
              <tr className="border-t border-border">
                <th scope="row" className="p-3">
                  Profundidade
                </th>
                <td className="p-3 text-muted-foreground">
                  A contratação cobre uma ausência ou cria excesso numa posição que já está
                  preenchida?
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Compare pelo menos duas opções quando houver alternativas. Um nome mais famoso ou com OVR
          maior não é automaticamente a melhor decisão se não resolver a lacuna ou exigir uma folha
          que o clube não consegue sustentar.
        </p>
      </Section>

      <Section id="janela" title="Planeje a janela de transferências">
        <p>
          As contratações no mercado da carreira podem ser concluídas nas rodadas 1 a 4 e 19 a 22.
          Use o período antes da janela para diagnosticar a posição, pesquisar candidatos e revisar
          o orçamento. Assim, você chega à negociação sabendo qual função precisa preencher e qual é
          o limite financeiro do clube.
        </p>
        <p>
          O mercado oferece busca de jogadores e filtros por posição, idade máxima e nível mínimo.
          Use os filtros para reduzir a lista, mas abra cada candidato para conferir os dados que
          afetam a decisão. A busca ajuda a encontrar nomes; a análise do elenco continua sendo sua.
        </p>
        <p>
          Uma proposta pode receber contraproposta ou ser recusada. Ajuste o valor dentro do seu
          limite, considere a comissão e não trate uma negociação aprovada como sinal de que a
          contratação cabe no plano de longo prazo.
        </p>
      </Section>

      <Section id="custo" title="Calcule o custo completo, não só a taxa">
        <p>
          A taxa de transferência é apenas uma parte da conta. A simulação financeira da contratação
          soma o valor acordado, a comissão do agente quando aplicável e luvas equivalentes a duas
          semanas do salário. O novo salário também passa a pesar na folha semanal depois da
          assinatura.
        </p>
        <p>
          Antes de confirmar, confira quanto sobra do caixa após os custos iniciais. A validação da
          carreira preserva uma reserva projetada para quatro semanas de operação e salários,
          incluindo o custo semanal do novo jogador. Se a proposta deixar o caixa abaixo dessa
          reserva, o jogo pode impedir a contratação mesmo que a taxa, isoladamente, pareça caber.
        </p>
        <p>
          Use a área de finanças para comparar projeção, folha e despesas do clube. Se uma venda
          também estiver no plano, avalie o que muda na escalação antes de contar com a receita. Não
          existe um percentual único de salários que sirva para todos os clubes; acompanhe os
          números da sua carreira e deixe espaço para custos já previstos.
        </p>
      </Section>

      <Section id="decidir" title="Decida entre contratar, vender ou esperar">
        <p>
          Contrate quando a necessidade estiver clara, o jogador combinar com a função e o custo
          couber na projeção. Espere quando a lacuna puder ser coberta por uma rotação já
          disponível, quando faltar informação ou quando a assinatura comprometer a reserva do
          clube.
        </p>
        <p>
          Ao receber uma oferta por um titular, compare a receita com a perda esportiva e com a
          cobertura que resta no elenco. Se aceitar, revise imediatamente a escalação e o banco; o
          jogador vendido deixa de estar disponível para as próximas partidas.
        </p>
        <p>
          Rescisão também tem custo. O sistema calcula uma compensação equivalente a 20% do valor do
          jogador, e a operação depende de caixa suficiente e de manter o tamanho mínimo previsto
          para o elenco. Por isso, compare a rescisão com as alternativas antes de liberar alguém.
        </p>
      </Section>

      <Section id="checklist" title="Checklist antes de assinar">
        <ol className="list-decimal space-y-2 pl-5">
          <li>Confirmei uma lacuna no time titular ou nas alternativas do banco.</li>
          <li>Comparei posição, OVR, potencial, idade e atributos úteis para a função.</li>
          <li>
            Verifiquei se a janela está aberta e se o jogador ainda não pertence ao meu clube.
          </li>
          <li>Somei taxa, comissão e luvas, além de considerar o novo salário semanal.</li>
          <li>
            Conferi a projeção de quatro semanas e a reserva que permanece depois da assinatura.
          </li>
          <li>Tenho um plano para encaixar o jogador e manter cobertura para ausências.</li>
        </ol>
        <p>
          Se ainda estiver organizando sua primeira temporada, volte ao{" "}
          <Link to="/guias" className="text-primary underline">
            guia de começo de carreira
          </Link>
          . Ele reúne o diagnóstico do clube, o primeiro plano tático e a rotina entre rodadas.
        </p>
      </Section>
    </ArticleShell>
  );
}
