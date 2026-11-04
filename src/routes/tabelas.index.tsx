import { createFileRoute } from "@tanstack/react-router";

import { breadcrumbLd, canonical, seoMeta } from "@/lib/seo";

import { TablesIndex } from "@/pages/tabelas.index";
import { TABELAS_INDEX_PATH as PATH } from "@/lib/public-route-paths";

const TITLE = "Tabelas de 12 ligas: Brasileirão, Premier League, La Liga e mais | jogomanager";

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
