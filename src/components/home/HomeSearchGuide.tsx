import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

/**
 * Server-rendered editorial copy for the home page. It answers what visitors
 * search for ("jogo de técnico de futebol", "jogo grátis de futebol") with
 * facts about this game, so the page is not only a hero and buttons.
 */
const MODES = [
  {
    title: "Carreira de técnico",
    text: "Crie seu treinador, escolha um clube e conduza a temporada inteira: escalação, treinos, contratações, metas da diretoria e orçamento. O resultado de uma rodada muda o elenco que você terá na seguinte.",
    to: "/new",
    cta: "Criar meu treinador",
  },
  {
    title: "Carreira de jogador",
    text: "Comece como um atleta jovem, defina posição e estilo e evolua com minutos em campo, treinos e propostas de outros clubes. É outro ponto de vista do mesmo futebol.",
    to: "/modo-carreira-de-jogador",
    cta: "Como funciona a carreira de jogador",
  },
  {
    title: "Partida rápida em 3D",
    text: "Escolha dois clubes e assista ao confronto no estádio 3D, com narração, câmeras de transmissão e estatísticas ao vivo. Serve para testar uma tática antes de levá-la para a carreira.",
    to: "/partida-rapida",
    cta: "Jogar uma partida agora",
  },
  {
    title: "Desafio 1x1 com amigos",
    text: "Crie uma sala, envie o código para um amigo e disputem a mesma partida. Cada técnico decide o próprio time; o resultado é calculado pelo servidor.",
    to: "/multiplayer",
    cta: "Criar uma sala",
  },
] as const;

const STEPS = [
  ["Escolha o desafio", "Assuma um favorito ao título ou um clube pequeno que precisa subir de divisão."],
  ["Monte o elenco", "Compare condição física, posição e potencial; use olheiros antes de gastar o orçamento."],
  ["Defina a tática", "Formação, mentalidade, pressão e substituições. Mude uma coisa por vez e observe o efeito."],
  ["Assista e ajuste", "A partida roda em 3D. No intervalo, corrija o plano a partir do que aconteceu em campo."],
] as const;

export function HomeSearchGuide() {
  return (
    <>
      <section className="mt-14" aria-labelledby="home-what-is">
        <p className="font-display text-xs uppercase tracking-widest text-primary">
          O que é o jogomanager
        </p>
        <h2 id="home-what-is" className="mt-2 font-display text-3xl">
          Um jogo de técnico de futebol grátis, direto no navegador
        </h2>
        <div className="mt-4 grid gap-4 text-base leading-relaxed text-muted-foreground lg:grid-cols-2">
          <p>
            No jogomanager você não controla o jogador com o polegar: você é o técnico. Escolhe
            quem joga, como o time se posiciona, quem contratar e quando poupar um atleta cansado.
            Depois assiste às suas decisões ganharem forma numa partida em 3D, lance a lance, com
            narração em português.
          </p>
          <p>
            É um jogo grátis de futebol que abre no celular ou no computador sem instalar nada e
            sem cadastro obrigatório. A carreira fica salva no próprio aparelho e continua
            funcionando sem internet; com uma conta, você também pode guardar uma cópia na nuvem.
            A loja é opcional.
          </p>
        </div>
      </section>

      <section className="mt-14" aria-labelledby="home-modes">
        <h2 id="home-modes" className="font-display text-2xl">
          Quatro jeitos de jogar futebol como técnico
        </h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {MODES.map((mode) => (
            <article key={mode.title} className="surface-card rounded-xl border border-border/60 p-5">
              <h3 className="font-display text-xl">{mode.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{mode.text}</p>
              <Link
                to={mode.to}
                className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm text-primary"
              >
                {mode.cta}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-14" aria-labelledby="home-first-season">
        <h2 id="home-first-season" className="font-display text-2xl">
          Sua primeira temporada em quatro passos
        </h2>
        <ol className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(([title, text], index) => (
            <li key={title} className="surface-card rounded-xl border border-border/60 p-5">
              <span className="font-display text-sm text-primary">Passo {index + 1}</span>
              <h3 className="mt-1 font-display text-lg">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-14" aria-labelledby="home-real-football">
        <h2 id="home-real-football" className="font-display text-2xl">
          Futebol real como ponto de partida
        </h2>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground">
          O catálogo reúne clubes e ligas de vários países, do Brasileirão às ligas europeias,
          americanas e asiáticas. Fora do jogo, as{" "}
          <Link to="/tabelas" className="text-primary underline-offset-4 hover:underline">
            tabelas de classificação
          </Link>{" "}
          mostram a temporada atual de campeonatos como a{" "}
          <Link
            to="/tabelas/$slug"
            params={{ slug: "brasileirao-serie-a" }}
            className="text-primary underline-offset-4 hover:underline"
          >
            Série A do Brasileirão
          </Link>{" "}
          e a{" "}
          <Link
            to="/tabelas/$slug"
            params={{ slug: "premier-league" }}
            className="text-primary underline-offset-4 hover:underline"
          >
            Premier League
          </Link>
          , com artilharia, forma recente e desempenho em casa e fora. É uma boa forma de escolher
          o clube que você quer comandar.
        </p>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground">
          Quer comparar com outros jogos de manager? O{" "}
          <Link
            to="/comparativo-jogos-manager"
            className="text-primary underline-offset-4 hover:underline"
          >
            comparativo
          </Link>{" "}
          mostra onde o jogomanager se sai melhor e onde os simuladores de PC vão mais fundo. Para
          aprender a jogar, comece pelo guia de{" "}
          <Link to="/melhores-formacoes" className="text-primary underline-offset-4 hover:underline">
            formações
          </Link>{" "}
          e pelo{" "}
          <Link
            to="/glossario-do-futebol"
            className="text-primary underline-offset-4 hover:underline"
          >
            glossário tático
          </Link>
          .
        </p>
      </section>
    </>
  );
}
