import { createFileRoute } from "@tanstack/react-router";

import { breadcrumbLd, canonical, seoMeta } from "@/lib/seo";
import { Page } from "@/pages/criador";
import { CRIADOR_PATH as PATH } from "@/lib/public-route-paths";

const TITLE = "Criador do Pro Football Manager 3D | Novidades";

const DESC =
  "Conheça o criador do Pro Football Manager 3D, veja as atualizações do jogo e acompanhe o desenvolvimento do manager de futebol 3D no navegador.";

export const Route = createFileRoute("/criador")({
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH }),
    links: canonical(PATH),
    scripts: [
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Criador", path: PATH },
      ]),
    ],
  }),
  component: Page,
});
