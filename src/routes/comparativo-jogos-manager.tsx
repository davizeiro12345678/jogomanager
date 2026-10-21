import { createFileRoute } from "@tanstack/react-router";

import { articleLd, breadcrumbLd, canonical, seoMeta } from "@/lib/seo";
import { ComparePage } from "@/pages/comparativo-jogos-manager";
import { COMPARATIVO_JOGOS_MANAGER_PATH as PATH } from "@/lib/public-route-paths";

const TITLE =
  "Pro Football Manager 3D x outros managers: dados, 3D, preço e celular | Pro Football Manager 3D";

const DESC =
  "Comparação lado a lado: profundidade de base de dados, partida 3D, custo, offline, plataformas e progressão de carreira — sem promessas exageradas.";

export const Route = createFileRoute("/comparativo-jogos-manager")({
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH, type: "article", keywords: [] }),
    links: canonical(PATH),
    scripts: [
      articleLd({
        headline: "Como escolher um jogo de manager de futebol",
        description: DESC,
        path: PATH,
      }),
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Como escolher um jogo de manager", path: PATH },
      ]),
    ],
  }),
  component: ComparePage,
});
