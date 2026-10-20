import { createFileRoute } from "@tanstack/react-router";

import { articleLd, breadcrumbLd, canonical, seoMeta } from "@/lib/seo";
import { GuidesPage } from "@/pages/guias";
import { GUIAS_PATH as PATH } from "@/lib/public-route-paths";

const TITLE = "Guias de Manager de Futebol 3D | Táticas e Scouting";

const DESC =
  "Aprenda táticas, scouting, contratações, finanças e gestão de elenco com os guias do Pro Football Manager 3D. Comece sua carreira no navegador.";

export const Route = createFileRoute("/guias")({
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH, type: "article" }),
    links: canonical(PATH),
    scripts: [
      articleLd({
        headline: "Guias de manager de futebol",
        description: DESC,
        path: PATH,
        datePublished: "2026-09-18",
        dateModified: "2026-10-13",
      }),
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Guias", path: PATH },
      ]),
    ],
  }),
  component: GuidesPage,
});
