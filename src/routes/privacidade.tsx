import { createFileRoute } from "@tanstack/react-router";

import { articleLd, breadcrumbLd, canonical, seoMeta } from "@/lib/seo";
import { PrivacidadePage } from "@/pages/privacidade";
import { PRIVACIDADE_PATH as PATH } from "@/lib/public-route-paths";

const TITLE = "Política de privacidade · Pro Football Manager 3D";

const DESC =
  "Quais dados o Pro Football Manager 3D guarda, por quanto tempo, com quem são compartilhados e como pedir a exclusão da sua conta e da sua carreira.";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH, type: "article" }),
    links: canonical(PATH),
    scripts: [
      articleLd({ headline: "Política de privacidade", description: DESC, path: PATH }),
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Privacidade", path: PATH },
      ]),
    ],
  }),
  component: PrivacidadePage,
});
