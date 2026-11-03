import { createFileRoute } from "@tanstack/react-router";

import { breadcrumbLd, canonical, seoMeta } from "@/lib/seo";
import { Page } from "@/pages/perguntas-frequentes";
import { FAQ_COUNT, faqPageLd } from "@/content/faq";
import { PERGUNTAS_FREQUENTES_PATH as PATH } from "@/lib/public-route-paths";

const TITLE = `FAQ do jogo: ${FAQ_COUNT} respostas sobre carreira, 3D e saves | jogomanager`;

const DESC =
  "Busque respostas sobre o manager de futebol grátis: como salvar a carreira na nuvem, jogar offline, usar moedas, montar táticas e deixar a partida 3D fluida no celular.";

export const Route = createFileRoute("/perguntas-frequentes")({
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH }),
    links: canonical(PATH),
    scripts: [
      faqPageLd(),
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Perguntas frequentes", path: PATH },
      ]),
    ],
  }),
  component: Page,
});
