import { createFileRoute, Link } from "@tanstack/react-router";

import { ArticleShell, Section } from "@/components/ArticleShell";
import { LeagueDataInsights } from "@/components/LeagueDataInsights";
import { getLeagueDigests } from "@/lib/real-football.functions";
import { articleLd, breadcrumbLd, canonical, seoMeta } from "@/lib/seo";

const PATH = "/guia-de-scouting";
const TITLE = "Scouting no Manager de Futebol | Guia de Contratações";
const DESC =
  "Aprenda a comparar potencial, desempenho, custo e posição antes de contratar. Guia prático de scouting para sua carreira no Pro Football Manager 3D.";

export const Route = createFileRoute("/guia-de-scouting")({
  loader: async () => ({ leagues: await getLeagueDigests().catch(() => []) }),
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH, type: "article" }),
    links: canonical(PATH),
    scripts: [
      articleLd({ headline: "Guia de scouting", description: DESC, path: PATH }),
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Guia de scouting", path: PATH },
      ]),
    ],
  }),
  component: ScoutingPage,
});

function ScoutingPage() {
  const { leagues } = Route.useLoaderData();
  return (
    <ArticleShell
      kicker="Scouting"
      title="Guia de scouting: encontrar craques antes dos rivais"
      intro="Scouting é transformar uma necessidade do elenco em uma escolha de contratação justificável. Aprenda a organizar observações, comparar opções e interpretar incertezas antes de investir."
      path={PATH}
      readMinutes={14}
      level="Intermediário"
      updated="outubro de 2026"
      toc={[
        { id: "potencial", title: "Potencial vale mais que nota atual" },
        { id: "idade", title: "A janela de idade" },
        { id: "carencia", title: "Contrate por carência, não por vitrine" },
        { id: "sinais", title: "Sinais de bom negócio" },
        { id: "erros", title: "Erros clássicos de olheiro" },
        { id: "metodo", title: "Método de avaliação" },
        { id: "matriz", title: "Matriz comparativa" },
        { id: "observacao", title: "Como interpretar estatísticas" },
        { id: "dados-scouting", title: "Onde procurar em cada liga" },
      ]}
      faq={[
        {
          q: "Prefiro um jovem promissor ou um veterano pronto?",
          a: "Jovem quando o objetivo é crescer ao longo de temporadas; veterano quando a meta é subir de divisão ou brigar por título agora.",
        },
        {
          q: "Quantos reforços por janela?",
          a: "Não existe limite ideal universal. Priorize carências, orçamento e o tempo de adaptação; movimentos numerosos aumentam a complexidade da gestão.",
        },
        {
          q: "Onde acho jogadores baratos?",
          a: "Observe jogadores com poucos minutos, contratos perto do fim e atletas fora do protagonismo, sempre conferindo condição física, custo e disponibilidade real.",
        },
      ]}
    >
      <Section id="potencial" title="1. Potencial vale mais que nota atual">
        <p>
          Imagine dois candidatos: um jovem com nota 68 e potencial estimado 85 e um atleta experiente
          com nota 76. O primeiro oferece perspectiva de crescimento, mas pode precisar de tempo; o
          segundo pode resolver uma necessidade imediata. Os números são ilustrativos, não uma
          avaliação de jogadores reais. Compare também salário, posição e risco.
        </p>
      </Section>
      <Section id="idade" title="2. A janela de idade">
        <p>
          A idade ajuda a situar o momento de carreira, mas não determina isoladamente evolução,
          valor ou desempenho. Atletas jovens podem ter maior margem de crescimento; veteranos podem
          oferecer consistência. Observe atributos atuais, potencial estimado, custo e metas do clube.
        </p>
      </Section>
      <Section id="carencia" title="3. Contrate por carência, não por vitrine">
        <p>
          Antes de abrir o mercado, conte quantos atletas realmente podem ocupar cada função.
          Considere lesões, suspensões, improvisações e minutos de jogo. Um reserva versátil pode
          solucionar dois problemas diferentes, sem exigir duas contratações.
        </p>
      </Section>
      <Section id="sinais" title="4. Sinais de bom negócio">
        <p>
          Contratos perto do fim, poucos minutos e mudança no papel do jogador são pistas para
          investigar uma oportunidade, não provas de desconto. Sempre compare valor pedido, salário,
          risco de lesão e expectativa de uso antes de negociar.
        </p>
      </Section>
      <Section id="erros" title="5. Erros clássicos de olheiro">
        <p>
          Evite montar a lista apenas por overall, assumir que um potencial alto será alcançado e
          gastar toda a verba numa única posição. Muitas chegadas simultâneas podem dificultar a
          gestão do elenco; o efeito exato depende das regras e da simulação.
        </p>
      </Section>
      <Section id="metodo" title="6. Um método em quatro passos">
        <p>
          Primeiro, defina a lacuna tática que precisa ser corrigida. Segundo, crie uma lista curta
          com candidatos de perfis e preços diferentes. Terceiro, compare atributos, idade, salário
          e consistência de rendimento. Quarto, revise as informações disponíveis e escolha quem
          resolve o problema sem comprometer as outras prioridades financeiras.
        </p>
      </Section>

      <Section id="matriz" title="Matriz de scouting: escolha com critérios claros">
        <p>
          Em vez de escolher o atleta com a maior nota isolada, crie critérios de avaliação.
          A tabela abaixo usa notas ilustrativas de 1 a 5 atribuídas pelo treinador, não
          uma fórmula oficial de overall do jogo.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="p-2">Critério</th><th className="p-2">Jogador A</th><th className="p-2">Jogador B</th><th className="p-2">O que analisar</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/50"><td className="p-2">Encaixe na posição</td><td className="p-2">5</td><td className="p-2">3</td><td className="p-2">Função e atributos relevantes</td></tr>
              <tr className="border-b border-border/50"><td className="p-2">Custo total</td><td className="p-2">3</td><td className="p-2">5</td><td className="p-2">Transferência e salários</td></tr>
              <tr className="border-b border-border/50"><td className="p-2">Prontidão atual</td><td className="p-2">4</td><td className="p-2">2</td><td className="p-2">Condição e rendimento recente</td></tr>
              <tr><td className="p-2">Perspectiva futura</td><td className="p-2">2</td><td className="p-2">5</td><td className="p-2">Idade e potencial estimado</td></tr>
            </tbody>
          </table>
        </div>
        <p>
          O Jogador A pode ser mais adequado para uma disputa imediata por título. O Jogador B
          pode fazer sentido num projeto de formação, desde que o orçamento e o tempo de jogo
          permitam. O importante é documentar por que a contratação atende à estratégia.
        </p>
      </Section>
      <Section id="observacao" title="Como analisar estatísticas sem tirar conclusões apressadas">
        <p>
          Gols, assistências e minutos jogados são úteis, mas precisam de contexto. Compare
          atletas por função e tempo em campo. Um volante pode ser essencial pela recuperação
          de bolas e pelo posicionamento, mesmo sem muitos gols. Um atacante com poucos minutos
          pode ter números reduzidos simplesmente por entrar sempre no fim das partidas.
        </p>
        <p>
          Confira se as estatísticas vêm da mesma temporada e competição. Misturar amostras de
          ligas diferentes sem considerar a força dos adversários pode produzir comparações
          injustas. Quando faltar uma informação, registre a incerteza em vez de inventar
          uma nota. Consulte as <Link to="/tabelas" className="text-primary underline">
          páginas de tabelas reais</Link> para ampliar o contexto da competição.
        </p>
      </Section>
      <LeagueDataInsights leagues={leagues} mode="scouting" />
      <p className="mt-8">
        Depois de contratar, organize o elenco com as{" "}
        <Link to="/dicas-de-gestao" className="text-primary underline">
          dicas de gestão por liga
        </Link>{" "}
        e acompanhe as{" "}
        <Link to="/tabelas" className="text-primary underline">
          tabelas atualizadas
        </Link>
        .
      </p>
    </ArticleShell>
  );
}
