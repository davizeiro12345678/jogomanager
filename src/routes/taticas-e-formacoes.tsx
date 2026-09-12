import { createFileRoute, Link } from "@tanstack/react-router";

import { PublicLinks } from "@/components/PublicLinks";
import { articleLd, breadcrumbLd, canonical, seoMeta } from "@/lib/seo";

const PATH = "/taticas-e-formacoes";
const TITLE =
  "Melhores táticas e formações no manager de futebol | Pro Football Manager 3D: Jogo de Futebol Manager Online";
const DESC =
  "Monte seu elenco, defina táticas e assista aos 90 minutos em 3D. Jogo de manager de futebol online e grátis com clubes reais de 30+ ligas.";

export const Route = createFileRoute("/taticas-e-formacoes")({
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH, type: "article" }),
    links: canonical(PATH),
    scripts: [
      articleLd({ headline: "Melhores táticas e formações", description: DESC, path: PATH }),
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Táticas e formações", path: PATH },
      ]),
    ],
  }),
  component: Page,
});

const FORMATIONS = [
  {
    name: "4-3-3",
    when: "Elenco com pontas rápidas e meio de campo com bom passe.",
    how: "Combine com mentalidade ofensiva e linha alta. Cansa mais: troque as pontas por volta dos 65 minutos.",
  },
  {
    name: "4-4-2",
    when: "Elenco equilibrado, sem estrelas nas pontas.",
    how: "A formação mais estável do jogo. Mentalidade equilibrada e ritmo médio seguram bem qualquer adversário.",
  },
  {
    name: "4-2-3-1",
    when: "Você tem um meia criativo e dois volantes de marcação.",
    how: "Boa contra times fortes: bloco médio, transição rápida e o meia livre entre as linhas.",
  },
  {
    name: "3-5-2",
    when: "Alas com fôlego alto e três zagueiros confiáveis.",
    how: "Domina o meio-campo, mas sofre em contra-ataques pelos lados. Use pressão alta só quando estiver à frente no placar.",
  },
  {
    name: "5-3-2",
    when: "Você é o time mais fraco em campo, ou está segurando um resultado.",
    how: "Bloco baixo, mentalidade defensiva, ritmo baixo. Aposte em bola parada e contra-ataque.",
  },
];

function Page() {
  return (
    <div className="pitch-bg min-h-screen px-4 py-14">
      <article className="mx-auto max-w-3xl">
        <p className="font-display text-xs uppercase tracking-[0.4em] text-primary">Tática</p>
        <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">
          Melhores táticas e formações
        </h1>
        <p className="mt-4 text-muted-foreground">
          Não existe formação invencível: existe formação que combina com o seu elenco e com o
          adversário da rodada. Veja o resumo de cada uma.
        </p>

        <div className="mt-8 space-y-5">
          {FORMATIONS.map((f) => (
            <section key={f.name} className="rounded-xl border border-border/60 p-5">
              <h2 className="font-display text-2xl">{f.name}</h2>
              <p className="mt-2 text-sm">
                <span className="text-primary">Quando usar: </span>
                <span className="text-muted-foreground">{f.when}</span>
              </p>
              <p className="mt-1 text-sm">
                <span className="text-primary">Como ajustar: </span>
                <span className="text-muted-foreground">{f.how}</span>
              </p>
            </section>
          ))}
        </div>

        <h2 className="mt-12 font-display text-2xl">Os três ajustes que mais mudam o jogo</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-muted-foreground">
          <li>
            <strong className="text-foreground">Mentalidade</strong> define quantos jogadores sobem
            no ataque. Ofensiva cria mais chances e concede mais contra-ataques.
          </li>
          <li>
            <strong className="text-foreground">Altura da linha</strong> decide onde você recupera a
            bola. Linha alta contra time lento, linha baixa contra atacante veloz.
          </li>
          <li>
            <strong className="text-foreground">Ritmo</strong> acelera as jogadas e a fadiga. Ritmo
            alto o jogo inteiro derruba a condição física no último terço da partida.
          </li>
        </ul>

        <div className="mt-10">
          <Link
            to="/new"
            className="rounded-lg bg-primary px-6 py-3 font-display text-sm uppercase tracking-widest text-primary-foreground"
          >
            Testar na prática
          </Link>
        </div>

        <PublicLinks exclude={PATH} />
      </article>
    </div>
  );
}
