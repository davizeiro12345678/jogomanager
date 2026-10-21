import { createFileRoute } from "@tanstack/react-router";

import { articleLd, breadcrumbLd, canonical, seoMeta } from "@/lib/seo";
import { PlayerCareerGuide } from "@/pages/modo-carreira-de-jogador";
import { MODO_CARREIRA_DE_JOGADOR_PATH as PATH } from "@/lib/public-route-paths";

const TITLE = "Modo carreira de jogador: crie seu atleta | JogoManager";

const DESC =
  "Conheça a carreira de jogador do JogoManager: crie um atleta, escolha posição e clube, treine, decida lances importantes e acompanhe a trajetória por temporadas.";

export const Route = createFileRoute("/modo-carreira-de-jogador")({
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH, type: "article", keywords: [] }),
    links: canonical(PATH),
    scripts: [
      articleLd({
        headline: "Como funciona o modo carreira de jogador",
        description: DESC,
        path: PATH,
      }),
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Carreira de jogador", path: PATH },
      ]),
    ],
  }),
  component: PlayerCareerGuide,
});
