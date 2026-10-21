import { createFileRoute } from "@tanstack/react-router";

import { breadcrumbLd, canonical, seoMeta } from "@/lib/seo";
import { Page } from "@/pages/perguntas-frequentes";
import { PERGUNTAS_FREQUENTES_PATH as PATH } from "@/lib/public-route-paths";

const TITLE = "Perguntas Frequentes | Pro Football Manager 3D";

const DESC =
  "Tire dúvidas sobre jogo grátis, clubes, partidas 3D, carreira, saves, nuvem, multiplayer e compras no Pro Football Manager 3D.";

export const Route = createFileRoute("/perguntas-frequentes")({
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH }),
    links: canonical(PATH),
    scripts: [
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Perguntas frequentes", path: PATH },
      ]),
    ],
  }),
  component: Page,
});
