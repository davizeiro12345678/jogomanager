import { createFileRoute } from "@tanstack/react-router";

import { articleLd, breadcrumbLd, canonical, seoMeta } from "@/lib/seo";

import { ContatoPage } from "@/pages/contato";
import { CONTATO_PATH as PATH } from "@/lib/public-route-paths";

const TITLE = "Suporte e Contato | Pro Football Manager 3D";

const DESC =
  "Fale com o JogoManager por e-mail ou Discord. Encontre contato oficial, canais de suporte para carreiras e compras e orientações para relatar problemas.";

export const Route = createFileRoute("/contato")({
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH, type: "article" }),
    links: canonical(PATH),
    scripts: [
      articleLd({ headline: "Contato e suporte", description: DESC, path: PATH }),
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Contato", path: PATH },
      ]),
    ],
  }),
  component: ContatoPage,
});
