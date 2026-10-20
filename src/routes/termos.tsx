import { createFileRoute } from "@tanstack/react-router";

import { articleLd, breadcrumbLd, canonical, seoMeta } from "@/lib/seo";
import { TermosPage } from "@/pages/termos";
import { TERMOS_PATH as PATH } from "@/lib/public-route-paths";

const TITLE = "Termos de uso · Pro Football Manager 3D";

const DESC =
  "Regras de uso do Pro Football Manager 3D: conta, conduta no chat, compras na loja, reembolso, conteúdo criado por você e limites de responsabilidade.";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH, type: "article" }),
    links: canonical(PATH),
    scripts: [
      articleLd({ headline: "Termos de uso", description: DESC, path: PATH }),
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Termos", path: PATH },
      ]),
    ],
  }),
  component: TermosPage,
});
