import { createFileRoute } from "@tanstack/react-router";

import { breadcrumbLd, canonical, seoMeta } from "@/lib/seo";

import { TablesIndex } from "@/pages/tabelas.index";
import { TABELAS_INDEX_PATH as PATH } from "@/lib/public-route-paths";

const TITLE =
  "Classificação ao vivo de 12 ligas: Brasileirão, Premier, La Liga e mais | Pro Football Manager 3D";

const DESC =
  "Tabela, artilharia, assistências, forma recente, casa x fora e desfalques de 12 campeonatos — e o mesmo clube pronto para você comandar em 3D.";

export const Route = createFileRoute("/tabelas/")({
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH }),
    links: canonical(PATH),
    scripts: [
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Tabelas", path: PATH },
      ]),
    ],
  }),
  component: TablesIndex,
});
