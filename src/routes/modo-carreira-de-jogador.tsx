import { createFileRoute, Link } from "@tanstack/react-router";

import { ArticleShell, Section } from "@/components/ArticleShell";
import { articleLd, breadcrumbLd, canonical, seoMeta } from "@/lib/seo";

const PATH = "/modo-carreira-de-jogador";
const TITLE = "Modo carreira de jogador: crie seu atleta | JogoManager";
const DESC =
  "Conheça a carreira de jogador do JogoManager: crie um atleta, escolha posição e clube, treine, decida lances importantes e acompanhe a trajetória por temporadas.";

export const Route = createFileRoute("/modo-carreira-de-jogador")({
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH, type: "article", keywords: [] }),
    links: canonical(PATH),
    scripts: [
      articleLd({
        headline: "Como funciona o modo carreira de jogador",
        description: DESC,
        path: PATH,
      }),
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Carreira de jogador", path: PATH },
      ]),
    ],
  }),
  component: PlayerCareerGuide,
});

const FAQ = [
  {
    q: "A carreira de jogador substitui a carreira de treinador?",
    a: "Não. São modos separados: na carreira de treinador você administra o clube; na carreira de jogador você acompanha um atleta, sua semana de treino e suas decisões nos lances importantes.",
  },
  {
    q: "Quantos atletas posso manter?",
    a: "O arquivo de carreiras oferece três espaços para trajetórias de jogador. Cada espaço pode ser retomado separadamente do save de treinador.",
  },
  {
    q: "Treinar pesado garante que o atleta vai evoluir mais?",
    a: "A intensidade é uma escolha de risco e desenvolvimento, não uma promessa de resultado. O treino também afeta energia e pode causar lesão; escolha considerando a condição e a profundidade da temporada.",
  },
  {
    q: "Posso jogar como goleiro?",
    a: "Sim. A criação permite escolher goleiro, zagueiro, lateral, volante, meia, ponta ou atacante; a carreira adapta as áreas de treino e os lances à posição escolhida.",
  },
] as const;

function PlayerCareerGuide() {
  const actions = (
    <div className="mt-12 flex flex-wrap gap-3">
      <Link
        to="/carreiras"
        className="rounded-lg bg-primary px-6 py-3 font-display text-sm uppercase tracking-widest text-primary-foreground transition hover:brightness-110"
      >
        Ver minhas carreiras
      </Link>
      <Link
        to="/jogador"
        className="rounded-lg border border-border px-6 py-3 font-display text-sm uppercase tracking-widest transition hover:bg-secondary"
      >
        Gerenciar atletas
      </Link>
    </div>
  );

  return (
    <ArticleShell
      kicker="Carreira individual"
      title="Construa a trajetória de um jogador de futebol"
      intro="Neste modo você acompanha um atleta, em vez de administrar todas as decisões de um clube. Crie identidade e posição, escolha onde começar, planeje o treino semanal e participe dos lances que podem marcar a temporada."
      path={PATH}
      readMinutes={8}
      level="Iniciante"
      updated="outubro de 2026"
      toc={[
        { id: "modo", title: "Como a carreira de jogador funciona" },
        { id: "criar", title: "Crie identidade e escolha uma posição" },
        { id: "origem", title: "Escolha origem e primeiro clube" },
        { id: "semana", title: "Planeje treino e decisões de jogo" },
        { id: "temporadas", title: "Acompanhe contrato, temporadas e legado" },
        { id: "arquivo", title: "Guarde trajetórias separadas" },
      ]}
      faq={FAQ}
      actions={actions}
    >
      <Section id="modo" title="Uma trajetória centrada no atleta">
        <p>
          A carreira individual acompanha um personagem de semana em semana: treino, possível
          participação na partida, desempenho, evolução e mudanças de clube. Você não escolhe a
          escalação inteira nem controla todos os lances como técnico. Em vez disso, decide a
          preparação do seu atleta e responde a momentos importantes da partida.
        </p>
        <p>
          Esse foco muda a pergunta de cada rodada. Em vez de “qual esquema serve ao meu elenco?”,
          você avalia “qual área devo treinar?”, “estou pronto para jogar?” e “qual opção combina
          com meus atributos e com o risco do lance?”.
        </p>
      </Section>

      <Section id="criar" title="Crie identidade e escolha uma posição">
        <p>
          Na criação você define nome e apelido, nacionalidade e cidade, número, pé preferido,
          altura, tipo físico e aparência. A posição afeta os atributos valorizados e os tipos de
          treino e de situação que aparecem durante a carreira.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <article className="rounded-xl border border-border/60 p-4">
            <h3 className="font-display text-base">Posições disponíveis</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Goleiro, zagueiro, lateral, volante, meia, ponta e atacante.
            </p>
          </article>
          <article className="rounded-xl border border-border/60 p-4">
            <h3 className="font-display text-base">Seu perfil</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Personalidade, características físicas e origem compõem o ponto de partida do
              personagem.
            </p>
          </article>
        </div>
        <p>
          Overall ajuda a resumir o momento, mas não substitui os atributos específicos da posição.
          Ao decidir o que desenvolver, compare as áreas de treino com a função que você quer
          exercer em campo.
        </p>
      </Section>

      <Section id="origem" title="Escolha a origem e leia as opções de clube">
        <p>
          A origem muda o contexto inicial e a lista de clubes que aparece para a escolha. A base
          permite selecionar um clube da liga; a peneira oferece uma lista menor de opções; a várzea
          apresenta outro caminho de entrada. O jogo também altera o ponto de partida do atleta
          conforme a origem escolhida.
        </p>
        <p>
          Use o preview da criação para comparar clube, posição e aparência antes de confirmar. Não
          existe uma origem que garanta titularidade ou prêmios: a carreira avança com condição,
          atributos, decisões de treino e situações simuladas ao longo das semanas.
        </p>
      </Section>

      <Section id="semana" title="Planeje o treino e decida os lances importantes">
        <p>
          A rotina semanal permite selecionar áreas de treino e uma intensidade leve, normal ou
          pesada. A intensidade mais alta envolve um risco maior de lesão, então leve em conta a
          energia do atleta, a posição e o que vem na temporada. Treinar uma área é uma decisão de
          desenvolvimento, não uma garantia de aumento fixo de overall.
        </p>
        <p>
          Antes da partida, você pode preparar decisões para momentos importantes. As opções
          destacam atributos relacionados ao lance e mostram um nível de risco. Escolher a opção
          mais agressiva pode oferecer uma recompensa diferente, mas também aumenta a chance de não
          dar certo; uma alternativa segura pode ser adequada quando a prioridade é preservar a
          jogada.
        </p>
        <p>
          Depois, confira minutos, função na partida, nota, gols, assistências e o resumo dos
          lances. Leia esse relatório com o treino e a condição física para decidir o foco da semana
          seguinte.
        </p>
      </Section>

      <Section id="temporadas" title="Acompanhe contrato, mudanças de clube e legado">
        <p>
          O painel registra temporada, semana, contrato, desempenho e notícias da trajetória. Com o
          avanço da carreira podem surgir renovações ou ofertas de outros clubes; examine os termos
          e a situação do atleta antes de escolher. Lesões também fazem parte do percurso e podem
          alterar as decisões de treino e participação.
        </p>
        <p>
          Cada temporada deixa uma linha de histórico com partidas, titularidades, gols,
          assistências e avaliação. Quando decidir encerrar a trajetória, o painel mantém um resumo
          do legado para você rever a história construída.
        </p>
      </Section>

      <Section id="arquivo" title="Guarde trajetórias separadas">
        <p>
          O arquivo de carreiras mantém três espaços de jogador e um save de treinador separado.
          Você pode voltar à lista de trajetórias para continuar uma história ou começar outra sem
          substituir os demais atletas. O estado de salvamento indica se a carreira está apenas
          neste aparelho ou sincronizada com a conta.
        </p>
        <p>
          Para entender a continuidade local e a sincronização, leia também o guia de{" "}
          <Link to="/jogar-offline" className="text-primary underline">
            jogo offline e salvamento
          </Link>
          . Para assumir o comando do clube inteiro, comece pelo{" "}
          <Link to="/guias" className="text-primary underline">
            guia de carreira de manager
          </Link>
          .
        </p>
      </Section>
    </ArticleShell>
  );
}
