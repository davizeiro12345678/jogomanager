import { createFileRoute } from "@tanstack/react-router";

import { articleLd, breadcrumbLd, canonical, seoMeta } from "@/lib/seo";
import { RulesPage } from "@/pages/regras";
import { REGRAS_PATH as PATH } from "@/lib/public-route-paths";

const TITLE = "Regras do futebol e a simulação do jogo | JogoManager";

const DESC =
  "Entenda impedimento, faltas, cartões, pênaltis e substituições. Veja o que o JogoManager simula e consulte a IFAB para a regra oficial do futebol.";

export const Route = createFileRoute("/regras")({
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH, type: "article" }),
    links: canonical(PATH),
    scripts: [
      articleLd({
        headline: "Regras do futebol e a simulação do jogo",
        description: DESC,
        path: PATH,
      }),
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Regras", path: PATH },
      ]),
    ],
  }),
  component: RulesPage,
});
