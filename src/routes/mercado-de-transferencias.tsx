import { createFileRoute } from "@tanstack/react-router";

import { articleLd, breadcrumbLd, canonical, seoMeta } from "@/lib/seo";
import { Page } from "@/pages/mercado-de-transferencias";
import { MERCADO_DE_TRANSFERENCIAS_PATH as PATH } from "@/lib/public-route-paths";

const TITLE = "Transferências no Manager de Futebol | Custo e Contratação";

const DESC =
  "Compare função, salário, preço e reposição antes de contratar ou vender. Guia de transferências com exemplos de custo total e planejamento de orçamento.";

export const Route = createFileRoute("/mercado-de-transferencias")({
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH, type: "article" }),
    links: canonical(PATH),
    scripts: [
      articleLd({
        headline: "Mercado de transferências: como contratar bem",
        description: DESC,
        path: PATH,
      }),
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Mercado de transferências", path: PATH },
      ]),
    ],
  }),
  component: Page,
});
