import { createFileRoute } from "@tanstack/react-router";

import { canonical, noindexMeta, seoMeta } from "@/lib/seo";

import { SharePage } from "@/pages/compartilhar";

const PATH = "/compartilhar";

const DESCRIPTION =
  "Compartilhe o Pro Football Manager 3D com seus amigos e convide novos treinadores para jogar grátis no navegador.";

export const Route = createFileRoute("/compartilhar")({
  head: () => ({
    meta: [
      ...seoMeta({
        title: "Compartilhar Pro Football Manager 3D",
        description: DESCRIPTION,
        path: PATH,
      }),
      ...noindexMeta,
    ],
    links: canonical(PATH),
  }),
  component: SharePage,
});
