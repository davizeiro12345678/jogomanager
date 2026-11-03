/**
 * Vitrine pública dos itens atualmente ativos no catálogo oficial.
 * A vitrine e a compra por e-mail também funcionam antes da autenticação.
 */
import { createFileRoute } from "@tanstack/react-router";

import { breadcrumbLd, canonical, seoMeta } from "@/lib/seo";
import { ProdutosPage } from "@/pages/produtos";
import { PRODUTOS_PATH as PATH } from "@/lib/public-route-paths";

const TITLE = "Pacotes do jogomanager: preços, moedas por real e passe mensal";

const DESC =
  "Compare os 10 pacotes do manager de futebol 3D: custo por moeda, bônus de olheiros e treino, passe de temporada e itens visuais. Compra segura, também sem conta.";

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
