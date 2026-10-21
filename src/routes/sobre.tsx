import { createFileRoute } from "@tanstack/react-router";

import { articleLd, breadcrumbLd, canonical, seoMeta } from "@/lib/seo";

import { SobrePage } from "@/pages/sobre";
import { SOBRE_PATH as PATH } from "@/lib/public-route-paths";

const TITLE = "Sobre o jogo | Pro Football Manager 3D";

const DESC =
  "Sobre o Pro Football Manager 3D: um jogo de manager de futebol online, gratuito e com partidas em 3D, feito para quem ama futebol.";

export const Route = createFileRoute("/sobre")({
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH, type: "article" }),
    links: canonical(PATH),
    scripts: [
      articleLd({ headline: "Sobre o Pro Football Manager 3D", description: DESC, path: PATH }),
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Sobre", path: PATH },
      ]),
    ],
  }),
  component: SobrePage,
});
