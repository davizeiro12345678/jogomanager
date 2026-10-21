import { createFileRoute } from "@tanstack/react-router";

import { articleLd, breadcrumbLd, canonical, seoMeta } from "@/lib/seo";
import { GlossaryPage } from "@/pages/glossario-do-futebol";
import { GLOSSARIO_DO_FUTEBOL_PATH as PATH } from "@/lib/public-route-paths";

const TITLE =
  "Glossário tático: xG, pressão pós-perda, terceiro homem e 80 termos | Pro Football Manager 3D";

const DESC =
  "De bloco baixo a meia-entrelinhas e fair play financeiro: cada termo de tática e gestão explicado com exemplo prático e onde ele muda o resultado no jogo.";

export const Route = createFileRoute("/glossario-do-futebol")({
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH, type: "article" }),
    links: canonical(PATH),
    scripts: [
      articleLd({ headline: "Glossário do futebol", description: DESC, path: PATH }),
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Glossário", path: PATH },
      ]),
    ],
  }),
  component: GlossaryPage,
});
