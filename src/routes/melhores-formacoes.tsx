import { createFileRoute } from "@tanstack/react-router";
import "../public-styles.css";

import { articleLd, breadcrumbLd, canonical, seoMeta } from "@/lib/seo";
import { FormationsPage } from "@/pages/melhores-formacoes";
import { MELHORES_FORMACOES_PATH as PATH } from "@/lib/public-route-paths";

const TITLE = "Melhores Formações de Futebol | Guia 4-3-3 e 4-2-3-1";

const DESC =
  "Compare 4-3-3, 4-2-3-1, 4-4-2 e 3-5-2: pontos fortes, limitações e ajustes para escolher a tática do seu elenco no manager de futebol.";

export const Route = createFileRoute("/melhores-formacoes")({
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH, type: "article" }),
    links: canonical(PATH),
    scripts: [
      articleLd({
        headline: "Melhores formações de futebol",
        description: DESC,
        path: PATH,
        datePublished: "2026-09-18",
        dateModified: "2026-10-13",
      }),
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Guias", path: "/guias" },
        { name: "Melhores formações", path: PATH },
      ]),
    ],
  }),
  component: FormationsPage,
});
