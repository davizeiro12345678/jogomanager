import { createFileRoute } from "@tanstack/react-router";

import { breadcrumbLd, canonical, seoMeta } from "@/lib/seo";
import { Page } from "@/pages/criador";
import { CRIADOR_PATH as PATH } from "@/lib/public-route-paths";

const TITLE = "Quem cria o jogomanager: história, tecnologia e atualizações";

const DESC =
  "A história do manager de futebol 3D grátis feito por um desenvolvedor independente: princípios, como a simulação funciona, linha do tempo das novidades e canais de contato.";

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
