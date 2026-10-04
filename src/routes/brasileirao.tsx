import { createFileRoute, Link } from "@tanstack/react-router";

import { PublicLinks } from "@/components/PublicLinks";
import { Crest } from "@/components/game/Crest";
import { getLeague } from "@/game/data/leagues";
import { articleLd, breadcrumbLd, canonical, seoMeta } from "@/lib/seo";

const PATH = "/brasileirao";
const TITLE = "Brasileirão: clubes e carreira | Pro Football Manager 3D";
const DESC =
  "Comande um clube do Brasileirão Série A ou Série B em um jogo de manager de futebol 3D e gratuito. Veja todos os times disponíveis e comece sua carreira.";

export const Route = createFileRoute("/brasileirao")({
  head: () => {
    return {
      meta: seoMeta({ title: TITLE, description: DESC, path: PATH, type: "article" }),
      links: canonical(PATH),
      scripts: [
        articleLd({ headline: "Brasileirão no jogo de manager", description: DESC, path: PATH }),
        breadcrumbLd([
          { name: "Início", path: "/" },
          { name: "Brasileirão", path: PATH },
        ]),
      ],
    };
  },
  component: Page,
});

function Page() {
  const leagues = [getLeague("bra"), getLeague("bra2")];

  return (
    <div className="pitch-bg min-h-screen px-4 py-14">
      <article className="mx-auto max-w-4xl">
        <p className="font-display text-xs uppercase tracking-[0.4em] text-primary">Brasil</p>
        <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">
          Brasileirão no jogo de manager
        </h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Série A e Série B estão jogáveis por inteiro. Escolha o clube, monte o elenco, dispute o
          campeonato ponto a ponto e acompanhe as partidas em 3D — de graça, no navegador.
        </p>

        <div className="mt-10 space-y-10">
          {leagues.map((l) => (
            <section key={l.id}>
              <h2 className="font-display text-2xl">{l.name}</h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {l.clubs.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center gap-3 rounded-xl border border-border/60 p-3"
                  >
                    <Crest club={c} size={32} detail="simple" />
                    <span className="text-sm">{c.name}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <h2 className="mt-12 font-display text-2xl">Qual clube escolher?</h2>
        <p className="mt-3 text-muted-foreground">
          Para a primeira carreira, um time de meio de tabela da Série A dá orçamento razoável e
          cobrança justa. Quem quer dificuldade real começa na Série B e tenta o acesso: o orçamento
          é curto e a diretoria exige resultado rápido.
        </p>

        <section className="mt-10 space-y-4 text-sm leading-relaxed text-muted-foreground">
          <h2 className="font-display text-2xl text-foreground">Prepare a primeira temporada</h2>
          <p>
            Escolher um clube é também escolher um projeto. Antes de contratar, examine o elenco
            disponível, as posições com poucas opções e os compromissos da temporada. Um time com
            bons titulares pode precisar de reservas para suportar a sequência de jogos. Já um grupo
            jovem pede atenção ao desenvolvimento e à condição física. Use a primeira escalação como
            diagnóstico: identifique quem pode cumprir cada função e quais setores exigem uma
            solução no mercado. O nome ou a tradição do clube não substituem essa avaliação do grupo
            que você vai comandar.
          </p>
          <p>
            Acompanhe as expectativas da diretoria e o orçamento antes de definir sua prioridade.
            Buscar uma campanha estável, disputar posições mais altas e construir um elenco para
            temporadas futuras envolvem escolhas diferentes. Reserve parte dos recursos para
            salários e imprevistos; gastar todo o orçamento em um reforço pode deixar outras
            necessidades sem resposta. Ao avaliar uma proposta, considere a função do jogador, as
            alternativas já presentes no clube e o impacto do contrato nas finanças. Uma contratação
            útil resolve uma necessidade concreta do elenco.
          </p>
          <h2 className="font-display text-2xl text-foreground">
            Escolha uma formação para o seu elenco
          </h2>
          <p>
            Comece por um desenho que aproveite as características dos jogadores disponíveis.
            Observe se há pontas, meias de criação, volantes e atacantes suficientes para executar o
            plano. Uma formação pode parecer forte na prancheta e ainda exigir atletas que seu clube
            não tem. Depois de escolher os titulares, confira quem pode entrar em cada posição.
            Durante a partida, acompanhe os espaços deixados pelo time e a condição dos jogadores
            antes de alterar a pressão, a mentalidade ou fazer substituições. Mudar muitas
            instruções ao mesmo tempo dificulta entender o efeito de cada decisão.
          </p>
          <h2 className="font-display text-2xl text-foreground">Aprenda com as rodadas</h2>
          <p>
            Use a classificação, as estatísticas e os acontecimentos das partidas para revisar seu
            planejamento. O placar é uma parte da análise: observe também como o time cria chances e
            onde o adversário encontra espaço. Uma vitória não significa que todas as escolhas
            funcionaram, assim como uma derrota isolada não exige abandonar a formação. Compare os
            jogos seguintes e procure padrões antes de reorganizar o elenco. Ao avançar no
            calendário, cuide do descanso e prepare alternativas para ausências, preservando uma
            ideia de jogo que os jogadores possam executar.
          </p>
          <p>
            Para aprofundar esse planejamento, consulte os{" "}
            <Link to="/guias" className="text-primary hover:underline">
              guias do treinador
            </Link>
            , as orientações de{" "}
            <Link to="/taticas-e-formacoes" className="text-primary hover:underline">
              táticas e formações
            </Link>{" "}
            e o guia de{" "}
            <Link to="/gestao-financeira" className="text-primary hover:underline">
              gestão financeira
            </Link>
            . Se ainda estiver conhecendo os controles, experimente uma partida rápida antes de
            criar a carreira. A lista acima ajuda a encontrar o clube; esses guias ajudam a
            organizar as decisões depois que você assume o comando.
          </p>
        </section>

        <div className="mt-8">
          <Link
            to="/new"
            className="rounded-lg bg-primary px-6 py-3 font-display text-sm uppercase tracking-widest text-primary-foreground"
          >
            Escolher meu clube
          </Link>
        </div>

        <PublicLinks exclude={PATH} />
      </article>
    </div>
  );
}
