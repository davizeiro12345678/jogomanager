import { createFileRoute, Link, notFound } from "@tanstack/react-router";

import { leagueFaq } from "@/lib/league-faq";

import { breadcrumbLd, canonical, seoMeta } from "@/lib/seo";

import { LEAGUE_LABELS } from "@/lib/league-labels";

import { getLeagueTable } from "@/lib/real-football.functions";
import { LeaguePage } from "@/pages/tabelas.$slug";

export const Route = createFileRoute("/tabelas/$slug")({
  loader: async ({ params }) => {
    if (!LEAGUE_LABELS[params.slug]) throw notFound();
    const table = await getLeagueTable({ data: { slug: params.slug } });
    return { table, label: LEAGUE_LABELS[params.slug]! };
  },
  head: ({ params, loaderData }) => {
    const label = loaderData?.label ?? { name: "Liga", country: "" };
    const table = loaderData?.table;
    const season = table?.season;
    const leader = table?.groups[0]?.[0]?.team.name;
    const scorer = table?.scorers[0];
    const path = `/tabelas/${params.slug}`;
    const title = `Tabela ${label.name}${season ? ` ${season}` : ""}: classificação, artilharia e análise`;
    const description = `Classificação da ${label.name} (${label.country})${leader ? ` com ${leader} na liderança` : ""}${scorer ? `, artilharia (${scorer.name}, ${scorer.goals} gols)` : ""}, promessas, casa x fora e desfalques.`;
    const faq = table ? leagueFaq(table, label.name) : [];
    return {
      meta: seoMeta({ title, description, path, type: "article" }),
      links: canonical(path),
      scripts: [
        breadcrumbLd([
          { name: "Início", path: "/" },
          { name: "Tabelas", path: "/tabelas" },
          { name: label.name, path },
        ]),
        ...(faq.length
          ? [
              {
                type: "application/ld+json",
                children: JSON.stringify({
                  "@context": "https://schema.org",
                  "@type": "FAQPage",
                  mainEntity: faq.map((f) => ({
                    "@type": "Question",
                    name: f.q,
                    acceptedAnswer: { "@type": "Answer", text: f.a },
                  })),
                }),
              },
            ]
          : []),
      ],
    };
  },
  notFoundComponent: () => (
    <main className="pitch-bg min-h-screen px-4 py-20 text-center">
      <h1 className="font-display text-3xl">Liga não encontrada</h1>
      <Link to="/tabelas" className="mt-6 inline-block text-primary underline">
        Ver todas as tabelas
      </Link>
    </main>
  ),
  errorComponent: () => (
    <main className="pitch-bg min-h-screen px-4 py-20 text-center">
      <h1 className="font-display text-3xl">Não foi possível carregar a tabela</h1>
      <p className="mt-3 text-muted-foreground">Tente novamente em alguns instantes.</p>
      <Link to="/tabelas" className="mt-6 inline-block text-primary underline">
        Voltar às tabelas
      </Link>
    </main>
  ),
  component: LeaguePage,
});
