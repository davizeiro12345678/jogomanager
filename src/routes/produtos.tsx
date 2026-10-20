/**
 * Vitrine pública dos itens atualmente ativos no catálogo oficial.
 * A vitrine e a compra por e-mail também funcionam antes da autenticação.
 */
import { createFileRoute } from "@tanstack/react-router";

import { breadcrumbLd, canonical, seoMeta } from "@/lib/seo";
import { ProdutosPage } from "@/pages/produtos";
import { PRODUTOS_PATH as PATH } from "@/lib/public-route-paths";

const TITLE = "Pacotes e passe de temporada | Pro Football Manager 3D";

const DESC =
  "Catálogo atual de itens para a carreira no Pro Football Manager 3D. Consulte os detalhes e compre com e-mail ou entre para sua carreira.";

export const Route = createFileRoute("/produtos")({
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH }),
    links: canonical(PATH),
    scripts: [
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Pacotes", path: PATH },
      ]),
    ],
  }),
  component: ProdutosPage,
});
