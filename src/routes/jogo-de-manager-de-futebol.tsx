import { createFileRoute, Link } from "@tanstack/react-router";

import { PublicLinks } from "@/components/PublicLinks";
import { LEAGUES } from "@/game/data/leagues";
import { articleLd, breadcrumbLd, canonical, seoMeta } from "@/lib/seo";

const PATH = "/jogo-de-manager-de-futebol";
const TITLE = "Manager de futebol online grátis | Pro Football Manager 3D";
const DESC =
  "Jogo de manager de futebol grátis e online: monte o elenco, defina a tática e assista às partidas em 3D no navegador, sem instalar nada.";

export const Route = createFileRoute("/jogo-de-manager-de-futebol")({
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH, type: "article" }),
    links: canonical(PATH),
    scripts: [
      articleLd({
        headline: "Jogo de manager de futebol grátis online em 3D",
        description: DESC,
        path: PATH,
      }),
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Jogo de manager de futebol", path: PATH },
      ]),
    ],
  }),
  component: Page,
});

function Page() {
  const clubs = LEAGUES.reduce((n, l) => n + l.clubs.length, 0);

  return (
    <div className="pitch-bg min-h-screen px-4 py-14">
      <article className="mx-auto max-w-3xl">
        <p className="font-display text-xs uppercase tracking-[0.4em] text-primary">Grátis</p>
        <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">
          Jogo de manager de futebol grátis online em 3D
        </h1>
        <p className="mt-4 text-muted-foreground">
          O Pro Football Manager 3D roda direto no navegador: você assume o comando de um clube,
          decide contratações, escala o time, escolhe a tática e assiste aos 90 minutos com
          jogadores em 3D. São {LEAGUES.length} campeonatos e {clubs} clubes disponíveis, e você
          pode começar sem criar conta.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/new"
            className="rounded-lg bg-primary px-6 py-3 font-display text-sm uppercase tracking-widest text-primary-foreground"
          >
            Começar carreira
          </Link>
          <Link
            to="/ligas-de-futebol"
            className="rounded-lg border border-border px-6 py-3 font-display text-sm uppercase tracking-widest"
          >
            Ver as ligas
          </Link>
        </div>

        <h2 className="mt-12 font-display text-2xl">Como funciona</h2>
        <ol className="mt-4 space-y-3 text-muted-foreground">
          <li>
            <h3 className="font-display text-lg text-foreground">1. Escolha o clube</h3> Clubes com
            força acima de 85 cobram título já na primeira temporada; entre 70 e 78 a diretoria dá
            tempo para você construir um projeto.
          </li>
          <li>
            <h3 className="font-display text-lg text-foreground">2. Monte o elenco</h3> 22 a 26
            jogadores é o equilíbrio entre folha salarial e segurança contra lesões.
          </li>
          <li>
            <h3 className="font-display text-lg text-foreground">3. Defina a tática</h3> Formação,
            mentalidade, altura da linha e ritmo mudam o comportamento do time dentro da partida.
          </li>
          <li>
            <h3 className="font-display text-lg text-foreground">4. Assista ou pule</h3> Veja o jogo
            em 3D com câmera de transmissão ou simule o resultado em segundos.
          </li>
        </ol>

        <h2 className="mt-12 font-display text-2xl">Precisa instalar ou pagar?</h2>
        <p className="mt-3 text-muted-foreground">
          Não. O jogo é gratuito e roda no navegador do computador ou do celular. A conta é
          opcional: jogando como convidado a carreira fica salva no próprio aparelho; criando conta,
          ela é salva na nuvem e você continua de onde parou em qualquer lugar.
        </p>

        <h2 className="mt-12 font-display text-2xl">Próximos passos</h2>
        <p className="mt-3 text-muted-foreground">
          Se é sua primeira carreira, comece pelo{" "}
          <Link to="/como-ser-tecnico-de-futebol" className="text-primary underline">
            passo a passo para novos treinadores
          </Link>{" "}
          e depois estude as{" "}
          <Link to="/taticas-e-formacoes" className="text-primary underline">
            táticas e formações
          </Link>
          .
        </p>

        <PublicLinks exclude={PATH} />
      </article>
    </div>
  );
}
