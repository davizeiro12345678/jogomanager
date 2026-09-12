import { createFileRoute, Link } from "@tanstack/react-router";

import { PublicLinks } from "@/components/PublicLinks";
import { CHANGELOG, CREATOR } from "@/content/changelog";
import { breadcrumbLd, canonical, seoMeta } from "@/lib/seo";

const PATH = "/criador";
const TITLE =
  "Sobre o criador e novidades do jogo | Pro Football Manager 3D: Jogo de Futebol Manager Online";
const DESC =
  "Conheça quem criou o Pro Football Manager 3D e acompanhe as novidades e atualizações mais recentes do jogo de manager de futebol online.";

export const Route = createFileRoute("/criador")({
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH }),
    links: canonical(PATH),
    scripts: [
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Criador", path: PATH },
      ]),
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-16">
      <h1 className="font-display text-4xl uppercase tracking-wide">Sobre o criador</h1>
      <p className="mt-4 text-lg text-muted-foreground">{CREATOR.bio}</p>

      <section className="mt-8 rounded-2xl border border-border/60 surface-card p-5">
        <p className="font-display text-xl uppercase tracking-wide">{CREATOR.name}</p>
        <p className="text-sm text-muted-foreground">{CREATOR.role}</p>
      </section>

      <h2 className="mt-12 font-display text-2xl uppercase tracking-wide">Novidades</h2>
      <ol className="mt-4 space-y-6">
        {CHANGELOG.map((entry) => (
          <li key={`${entry.date}-${entry.title}`} className="border-l-2 border-primary/50 pl-4">
            <p className="text-xs uppercase tracking-[0.3em] text-primary">{entry.date}</p>
            <p className="font-display text-lg uppercase tracking-wide">{entry.title}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {entry.items.map((it) => (
                <li key={it}>{it}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>

      <p className="mt-10 text-sm">
        <Link to="/" className="text-primary hover:underline">
          Voltar e começar uma carreira
        </Link>
      </p>

      <PublicLinks exclude={PATH} />
    </main>
  );
}
