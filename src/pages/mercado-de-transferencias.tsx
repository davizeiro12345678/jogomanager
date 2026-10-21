import { Link } from "@tanstack/react-router";

import { ArticleShell, Section, type GuideFaq, type GuideTocItem } from "@/components/ArticleShell";
import { MERCADO_DE_TRANSFERENCIAS_PATH as PATH } from "@/lib/public-route-paths";

const RULES = [
  {
    id: "folha",
    title: "Orçamento não é o limite real",
    text: "Compare caixa, verba de transferência e custos recorrentes no mesmo período. Um preço baixo pode esconder um compromisso salarial que o clube não consegue sustentar.",
  },
  {
    id: "posicao",
    title: "Contrate por posição carente",
    text: "Um lateral 74 vale mais que um atacante 80 se você já tem três atacantes. Olhe o buraco do elenco, não a nota.",
  },
  {
    id: "jovens",
    title: "Jovem com potencial alto é investimento",
    text: "Um jovem pode oferecer margem de evolução, mas valorização e revenda são incertas. Compare atributos, potencial estimado, oportunidades de jogar e custo antes de comprometer o orçamento.",
  },
  {
    id: "emprestimo",
    title: "Empréstimo resolve temporada, não projeto",
    text: "Quando disponível na negociação, confira duração e responsabilidade pelo salário. Empréstimos podem cobrir uma necessidade temporária, mas não garantem economia nem reposição definitiva.",
  },
  {
    id: "clausula",
    title: "Cláusula de rescisão corta a negociação",
    text: "Confira as condições que a interface realmente apresenta. Uma cláusula, quando aplicável, não dispensa a análise de salário, contrato e aceitação do jogador.",
  },
  {
    id: "venda",
    title: "Venda no pico",
    text: "Compare oferta, custo de reposição, minutos e importância do atleta. Idade ajuda a avaliar o horizonte do projeto, mas não determina sozinha o momento de vender.",
  },
  {
    id: "propostas",
    title: "Clubes interessados são oportunidade",
    text: "Leia os termos das propostas disponíveis e compare o saldo da venda com o custo de um substituto. Não conte a receita antes da confirmação da operação.",
  },
] as const;

const TOC: readonly GuideTocItem[] = [
  ...RULES.map((r) => ({ id: r.id, title: r.title })),
  { id: "janela", title: "Plano de janela" },
  { id: "custo-total", title: "Custo total de uma contratação" },
  { id: "comparacao", title: "Comparação de propostas" },
  { id: "erros", title: "Erros de negociação" },
  { id: "mundo-real", title: "Dados reais e carreira" },
];

const FAQ: readonly GuideFaq[] = [
  {
    q: "Quanto da receita pode ir para salários?",
    a: "Compare custos e receitas confirmadas no mesmo período e preserve uma reserva. Uma porcentagem isolada não mede os riscos de calendário, premiações incertas e gastos de transferência.",
  },
  {
    q: "Vale a pena contratar no meio da temporada?",
    a: "Depende da disponibilidade na sua carreira, da urgência e do custo total. Compare reforço imediato, uso de um reserva e adiamento; esperar não garante preço menor.",
  },
  {
    q: "Como sei se um jovem vale o investimento?",
    a: "Compare posição, atributos atuais, potencial estimado, minutos possíveis e custo. Potencial é uma estimativa; não confirma evolução ou lucro de revenda.",
  },
];

export function Page() {
  return (
    <ArticleShell
      kicker="Mercado"
      title="Mercado de transferências: como contratar bem"
      intro="Contratar é a decisão que mais muda uma temporada — e a que mais quebra carreiras. Use critérios de função, custo total e reposição para decidir dentro das condições da sua carreira."
      path={PATH}
      readMinutes={14}
      level="Intermediário"
      updated="outubro de 2026"
      toc={TOC}
      faq={FAQ}
    >
      {RULES.map((r) => (
        <Section key={r.id} id={r.id} title={r.title}>
          <p>{r.text}</p>
        </Section>
      ))}
      <Section id="janela" title="Plano de janela em 4 etapas">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-foreground">Diagnóstico (antes de abrir a janela)</strong>:
            liste as posições com menos de dois jogadores aptos e os titulares acima de 31 anos. É
            ali que nasce a lista de compras.
          </li>
          <li>
            <strong className="text-foreground">Lista curta</strong>: três alvos por posição, um
            caro, um médio e um jovem. Se o principal falhar, você não negocia desesperado no último
            dia.
          </li>
          <li>
            <strong className="text-foreground">Venda antes de comprar</strong>: um reserva caro
            vendido libera salário e verba ao mesmo tempo.
          </li>
          <li>
            <strong className="text-foreground">Reserva de emergência</strong>: dimensione a reserva
            conforme custos recorrentes, calendário e opções do banco; não use uma fração fixa para
            todo clube.
          </li>
        </ul>
      </Section>
      <Section id="custo-total" title="Custo total: o preço anunciado é apenas uma parte">
        <p>
          Some a taxa de transferência aos salários do período que você está planejando e a outros
          custos apresentados na negociação. Verifique a unidade de tempo antes de comparar
          propostas. Mantenha receitas de vendas ainda não concluídas fora da conta principal.
        </p>
        <p>
          Exemplo fictício: o candidato A custa 200 mil e recebe 10 mil por semana; o B custa 400
          mil e recebe 4 mil. Em 30 semanas, os totais ilustrativos seriam 500 mil e 520 mil, sem
          outros encargos. A diferença seria de 20 mil, embora o preço inicial de B fosse o dobro. O
          caixa imediato, a função e o prazo do compromisso também importam.
        </p>
        <p>
          Para verificar quanto o clube consegue assumir, use a projeção do
          <Link to="/dicas-de-gestao" className="text-primary underline">
            {" "}
            guia de temporada e finanças
          </Link>
          . A conta é uma ferramenta de planejamento, não uma tabela de preços do jogo.
        </p>
      </Section>
      <Section id="comparacao" title="Compare propostas antes de confirmar">
        <ol className="list-decimal space-y-2 pl-5">
          <li>Escreva a função que precisa preencher e qual jogador atual seria substituído.</li>
          <li>Compare ao menos uma alternativa de contratação com a opção de manter o elenco.</li>
          <li>Confira posição, condição, custo recorrente e prazo nos dados disponíveis.</li>
          <li>Em uma venda, inclua o custo de reposição e os minutos que o time perderia.</li>
          <li>Confirme a negociação e depois confira elenco, saldo e compromissos atualizados.</li>
        </ol>
        <p>
          Uma oferta recusada não exige aumentar o preço imediatamente. Reveja o limite e retome a
          lista de alternativas. O{" "}
          <Link to="/guia-de-scouting" className="text-primary underline">
            guia de scouting
          </Link>{" "}
          ajuda a comparar candidatos; o
          <Link to="/melhores-formacoes" className="text-primary underline">
            {" "}
            guia tático
          </Link>
          ajuda a definir a função que o reforço deve cumprir.
        </p>
      </Section>
      <Section id="erros" title="Cinco erros que quebram clubes no mercado">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Contratar pelo overall sem olhar a posição — um meia a mais não resolve a lateral vazia.
          </li>
          <li>Dar salário de estrela a quem vai ser reserva; o vestiário cobra a conta.</li>
          <li>Comprar três jogadores para a mesma vaga e deixar todos insatisfeitos.</li>
          <li>Vender o artilheiro no meio da temporada sem substituto pronto.</li>
          <li>Tratar idade ou potencial como garantia de valorização e revenda.</li>
        </ul>
      </Section>
      <Section id="mundo-real" title="O que o mercado real ensina">
        <p>
          Os grandes clubes alternam ciclos: compram jovens promissores, valorizam e vendem no pico
          para financiar a próxima geração. Nas{" "}
          <Link to="/tabelas" className="text-primary underline">
            páginas das ligas
          </Link>{" "}
          você encontra o contexto das competições cobertas. Esses resultados pertencem ao futebol
          real e não garantem a presença, o preço ou a evolução de um atleta na carreira.
        </p>
      </Section>
    </ArticleShell>
  );
}
