import { createFileRoute } from "@tanstack/react-router";

import { articleLd, breadcrumbLd, canonical, seoMeta } from "@/lib/seo";
import { OfflinePage } from "@/pages/jogar-offline";
import { JOGAR_OFFLINE_PATH as PATH } from "@/lib/public-route-paths";

const TITLE = "JogoManager Offline | Saves, Backup e Sincronização";

const DESC =
  "Entenda saves locais, backup e sincronização do JogoManager. Prepare a carreira para uso sem conexão e saiba o que conferir ao trocar de aparelho.";

export const Route = createFileRoute("/jogar-offline")({
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH, type: "article" }),
    links: canonical(PATH),
    scripts: [
      articleLd({ headline: "Saves, backup e uso offline", description: DESC, path: PATH }),
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Offline e backup", path: PATH },
      ]),
    ],
  }),
  component: OfflinePage,
});
