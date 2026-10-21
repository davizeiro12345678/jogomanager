import { createFileRoute } from "@tanstack/react-router";

import { articleLd, breadcrumbLd, canonical, seoMeta } from "@/lib/seo";
import { SquadPlanningPage } from "@/pages/planejamento-de-elenco";
import { PLANEJAMENTO_DE_ELENCO_PATH as PATH } from "@/lib/public-route-paths";

const TITLE = "Scouting e transferências: planeje o elenco | JogoManager";

const DESC =
  "Use relatórios de olheiros para comparar posição, overall, potencial e valor. Planeje transferências considerando taxa, luvas, comissão e salário semanal.";

export const Route = createFileRoute("/planejamento-de-elenco")({
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH, type: "article", keywords: [] }),
    links: canonical(PATH),
    scripts: [
      articleLd({
        headline: "Scouting e transferências: como planejar seu elenco",
        description: DESC,
        path: PATH,
      }),
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Guias", path: "/guias" },
        { name: "Planejamento do elenco", path: PATH },
      ]),
    ],
  }),
  component: SquadPlanningPage,
});
