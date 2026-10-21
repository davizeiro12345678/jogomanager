import { createFileRoute } from "@tanstack/react-router";

import { articleLd, breadcrumbLd, canonical, seoMeta } from "@/lib/seo";
import { Page } from "@/pages/jogo-de-manager-de-futebol";
import { JOGO_DE_MANAGER_DE_FUTEBOL_PATH as PATH } from "@/lib/public-route-paths";

const TITLE = "Jogo de Manager de Futebol 3D | Pro Football Manager 3D";

const DESC =
  "Jogue como técnico de futebol: escolha um clube, faça contratações, organize a tática e assista aos jogos em 3D. Grátis e direto no navegador.";

export const Route = createFileRoute("/jogo-de-manager-de-futebol")({
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH, type: "article" }),
    links: canonical(PATH),
    scripts: [
      articleLd({
        headline: "Jogo de manager de futebol grátis online em 3D",
        description: DESC,
        path: PATH,
      }),
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Jogo de manager de futebol", path: PATH },
      ]),
    ],
  }),
  component: Page,
});
