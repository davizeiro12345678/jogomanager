import { createFileRoute, Link } from "@tanstack/react-router";

import { ArticleShell, Section } from "@/components/ArticleShell";
import { Crest } from "@/components/game/Crest";
import { getLeague } from "@/game/data/leagues";
import { SERIE_D_IDS } from "@/game/data/serie-d";
import { articleLd, breadcrumbLd, canonical, seoMeta } from "@/lib/seo";

const PATH = "/brasileirao";
const TITLE = "Brasileirão no jogo: clubes e carreira | JogoManager";
const DESC =
  "Compare os clubes da Série A e B disponíveis no JogoManager. Veja o catálogo brasileiro, entenda o desafio inicial e prepare uma carreira no futebol nacional.";

export const Route = createFileRoute("/brasileirao")({
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH, type: "article", keywords: [] }),
    links: canonical(PATH),
    scripts: [
      articleLd({
        headline: "Brasileirão no jogo: clubes e carreira",
        description: DESC,
        path: PATH,
      }),
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Brasileirão", path: PATH },
      ]),
    ],
  }),
  component: Page,
});

const SERIE_A = getLeague("bra");
const SERIE_B = getLeague("bra2");
const FEATURED_LEAGUES = [SERIE_A, SERIE_B];
const SERIE_C = getLeague("bra3");
const SERIE_D = SERIE_D_IDS.map((id) => getLeague(id));

const FAQ = [
  {
    q: "Quais clubes do Brasileirão posso escolher?",
    a: "A lista abaixo mostra os clubes da Série A e da Série B presentes no catálogo de carreira do jogo. A página de ligas reúne também as outras competições disponíveis.",
  },
  {
    q: "A Série B sempre começa com menos orçamento?",
    a: "Não use apenas a divisão para estimar o caixa. No jogo, o orçamento inicial considera a força atribuída ao clube e o perfil do treinador. Confira os valores e o objetivo gerados ao iniciar a carreira.",
  },
  {
    q: "Uma equipe mais forte garante uma temporada tranquila?",
    a: "Não. A força do clube influencia os parâmetros iniciais da carreira, mas escalação, disponibilidade dos jogadores, adversários e decisões ao longo da temporada continuam afetando os resultados.",
  },
  {
    q: "O catálogo representa a tabela oficial atual?",
    a: "Esta página descreve as equipes incluídas no jogo. Ela não é uma tabela ao vivo nem substitui o calendário e os participantes publicados pelos organizadores de cada competição.",
  },
] as const;

function Page() {
  const tierCount = 3 + SERIE_D.length;
  const serieDClubCount = SERIE_D.reduce((total, league) => total + league.clubs.length, 0);

  return (
    <ArticleShell
      kicker="Futebol brasileiro"
      title="Brasileirão no jogo: escolha seu clube e planeje a temporada"
      intro="Compare as equipes da Série A e da Série B no catálogo do Pro Football Manager 3D e escolha o tipo de carreira que quer construir. Além da lista de clubes, este guia explica como avaliar o desafio, ler os parâmetros iniciais e preparar o primeiro jogo sem presumir que uma divisão ou um escudo determine sozinho o orçamento e os resultados."
      path={PATH}
      readMinutes={8}
      level="Iniciante"
      updated="outubro de 2026"
      toc={[
        { id: "clubes", title: "Clubes da Série A e da Série B" },
        { id: "piramide", title: "Outras divisões brasileiras no jogo" },
        { id: "escolha", title: "Escolha o tipo de desafio" },
        { id: "preparar", title: "Prepare as primeiras rodadas" },
        { id: "continuar", title: "Guias para continuar o planejamento" },
      ]}
      faq={FAQ}
    >
      <Section id="clubes" title="Clubes da Série A e da Série B">
        <p>
          O catálogo do jogo reúne {SERIE_A.clubs.length} equipes na Série A e{" "}
          {SERIE_B.clubs.length} na Série B. A ordem das listas identifica os clubes disponíveis;
          ela não é classificação, previsão de desempenho ou uma tabela oficial da temporada.
        </p>
        <div className="grid gap-8">
          {FEATURED_LEAGUES.map((league) => (
            <section key={league.id} aria-labelledby={`league-${league.id}`}>
              <h3 id={`league-${league.id}`} className="font-display text-xl">
                {league.name}{" "}
                <span className="text-sm text-muted-foreground">
                  ({league.clubs.length} clubes)
                </span>
              </h3>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {league.clubs.map((club) => (
                  <li
                    key={club.id}
                    className="flex items-center gap-3 rounded-xl border border-border/60 surface-card p-3"
                  >
                    <Crest club={club} size={32} detail="simple" />
                    <span className="text-sm">{club.name}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </Section>

      <Section id="piramide" title="A carreira brasileira inclui mais divisões">
        <p>
          A pirâmide nacional do jogo também inclui a Série C, com {SERIE_C.clubs.length} clubes, e
          a Série D organizada em {SERIE_D.length} grupos, com {serieDClubCount} equipes no total.
          As divisões estão conectadas para que as campanhas possam avançar pela pirâmide conforme
          as regras de movimentação da carreira.
        </p>
        <p>
          Esta página detalha os clubes de A e B, que concentram as duas listas principais do guia.
          Consulte a página de{" "}
          <Link to="/ligas-de-futebol" className="text-primary underline">
            ligas e clubes disponíveis
          </Link>{" "}
          para ver as demais competições do catálogo e confirmar qual divisão pretende comandar. Os
          participantes mostrados no jogo descrevem o catálogo, não uma tabela oficial atualizada em
          tempo real.
        </p>
      </Section>

      <Section id="escolha" title="Escolha o desafio pelo elenco e pelos objetivos">
        <p>
          A divisão ajuda a localizar o tipo de competição, mas é uma referência incompleta para
          escolher um projeto. Ao criar uma carreira, o jogo calcula o objetivo da diretoria a
          partir da força atribuída ao clube e define o orçamento inicial considerando essa força e
          o perfil do treinador. Por isso, não presuma que todo clube de uma divisão comece com a
          mesma meta ou que um time da Série B tenha sempre um caixa menor que qualquer equipe da
          Série A.
        </p>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">
              Perguntas para escolher um clube na carreira brasileira
            </caption>
            <thead>
              <tr>
                <th scope="col" className="p-3">
                  O que você procura
                </th>
                <th scope="col" className="p-3">
                  O que conferir antes de começar
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border">
                <th scope="row" className="p-3 align-top">
                  Disputar uma campanha exigente
                </th>
                <td className="p-3 text-muted-foreground">
                  Leia o objetivo da diretoria e compare-o com o elenco e os próximos adversários.
                </td>
              </tr>
              <tr className="border-t border-border">
                <th scope="row" className="p-3 align-top">
                  Construir o time aos poucos
                </th>
                <td className="p-3 text-muted-foreground">
                  Procure posições com poucas alternativas e planeje contratações que resolvam uma
                  lacuna real.
                </td>
              </tr>
              <tr className="border-t border-border">
                <th scope="row" className="p-3 align-top">
                  Levar um clube por várias divisões
                </th>
                <td className="p-3 text-muted-foreground">
                  Comece em uma divisão inferior e avalie a campanha temporada a temporada; promoção
                  e rebaixamento fazem parte da pirâmide do jogo.
                </td>
              </tr>
              <tr className="border-t border-border">
                <th scope="row" className="p-3 align-top">
                  Experimentar antes de se comprometer
                </th>
                <td className="p-3 text-muted-foreground">
                  Jogue uma partida rápida para conhecer controles e ritmo, depois compare com a
                  rotina de uma carreira.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          O elenco e o valor inicial de cada carreira são dados do simulador. Eles não representam
          automaticamente uma projeção de folha, uma recomendação de mercado ou a situação
          financeira de um clube real.
        </p>
      </Section>

      <Section id="preparar" title="Prepare as primeiras rodadas">
        <ol className="list-decimal space-y-3 pl-5">
          <li>
            <strong>Confira o objetivo e o caixa inicial.</strong> Guarde esses dados para comparar
            suas decisões com as condições da carreira que você escolheu.
          </li>
          <li>
            <strong>Revise o elenco antes de contratar.</strong> Veja quem pode cumprir cada
            posição, quem está indisponível e onde falta uma alternativa para o banco.
          </li>
          <li>
            <strong>Escolha uma formação que seu grupo consegue preencher.</strong> O jogo oferece
            4-3-3, 4-4-2, 3-5-2 e 4-2-3-1; compare as funções exigidas com os jogadores disponíveis.
          </li>
          <li>
            <strong>Analise a partida após o apito final.</strong> Além do placar, observe chutes,
            chances e espaços cedidos antes de mudar a tática para a rodada seguinte.
          </li>
          <li>
            <strong>Planeje as negociações.</strong> Considere taxa, comissão, luvas, salário e a
            reserva financeira antes de confirmar uma contratação.
          </li>
        </ol>
        <p>
          Esse roteiro cria uma referência para suas decisões sem prometer vitória por escolher um
          clube ou uma formação específica. Conforme a temporada avança, anote o problema que quer
          corrigir e altere um aspecto por vez para entender o efeito no time.
        </p>
      </Section>

      <Section id="continuar" title="Continue o planejamento com guias práticos">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <Link to="/guias" className="text-primary underline">
              Guia de carreira de manager
            </Link>
            : escolha um plano, organize a primeira escalação e estruture a rotina entre rodadas.
          </li>
          <li>
            <Link to="/taticas-e-formacoes" className="text-primary underline">
              Táticas e formações
            </Link>
            : compare as quatro formações e aprenda a observar os controles que o jogo oferece.
          </li>
          <li>
            <Link to="/planejamento-de-elenco" className="text-primary underline">
              Scouting e planejamento do elenco
            </Link>
            : interprete relatórios e calcule os custos de uma transferência.
          </li>
          <li>
            <Link to="/analise-de-partida-de-futebol" className="text-primary underline">
              Análise de partida
            </Link>
            : transforme estatísticas em uma pergunta tática para o próximo jogo.
          </li>
        </ul>
      </Section>
    </ArticleShell>
  );
}
