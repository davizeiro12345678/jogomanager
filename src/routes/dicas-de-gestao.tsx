import { createFileRoute } from "@tanstack/react-router";

import { getLeagueDigests } from "@/lib/real-football.functions";

import { articleLd, breadcrumbLd, canonical, seoMeta } from "@/lib/seo";
import { TipsPage } from "@/pages/dicas-de-gestao";
import { DICAS_DE_GESTAO_PATH as PATH } from "@/lib/public-route-paths";

const TITLE = "Gestão de Clube de Futebol | Planejamento de Temporada";

const DESC =
  "Planeje a temporada no manager de futebol: calendário, rodízio, metas, orçamento, reserva de caixa e análise dos rivais sem promessas de vitória.";

export const Route = createFileRoute("/dicas-de-gestao")({
  loader: async () => ({ leagues: await getLeagueDigests().catch(() => []) }),
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH, type: "article" }),
    links: canonical(PATH),
    scripts: [
      articleLd({
        headline: "Como planejar a temporada de um clube",
        description: DESC,
        path: PATH,
        datePublished: "2026-09-18",
        dateModified: "2026-10-13",
      }),
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Guias", path: "/guias" },
        { name: "Gestão da temporada", path: PATH },
      ]),
    ],
  }),
  component: TipsPage,
});
