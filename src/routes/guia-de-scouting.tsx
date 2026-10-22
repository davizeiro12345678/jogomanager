import { createFileRoute } from "@tanstack/react-router";
import "../public-styles.css";

import { getLeagueDigests } from "@/lib/real-football.functions";

import { articleLd, breadcrumbLd, canonical, seoMeta } from "@/lib/seo";
import { ScoutingPage } from "@/pages/guia-de-scouting";
import { GUIA_DE_SCOUTING_PATH as PATH } from "@/lib/public-route-paths";

const TITLE = "Guia de Scouting: Como Avaliar e Contratar Jogadores";

const DESC =
  "Aprenda a avaliar potencial, estatísticas, salários e custos antes de contratar. Um guia de scouting com critérios práticos para encontrar reforços no manager 3D.";

export const Route = createFileRoute("/guia-de-scouting")({
  loader: async () => ({ leagues: await getLeagueDigests().catch(() => []) }),
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH, type: "article" }),
    links: canonical(PATH),
    scripts: [
      articleLd({
        headline: "Guia de scouting: encontrar craques antes dos rivais",
        description: DESC,
        path: PATH,
        datePublished: "2026-09-18",
        dateModified: "2026-10-13",
      }),
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Guias", path: "/guias" },
        { name: "Guia de scouting", path: PATH },
      ]),
    ],
  }),
  component: ScoutingPage,
});
