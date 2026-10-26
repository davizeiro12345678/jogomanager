import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext } from "@tanstack/react-router";
import {
  NotFoundComponent,
  ErrorComponent,
  RootShell,
  RootComponent,
} from "@/components/RootLayout";
import appCss from "../styles.css?url";
import publicCss from "../public-styles.css?url";

import { isLightweightCssPath } from "@/lib/public-content-routes";
import { CONSENT_VISIBILITY_SCRIPT } from "@/lib/consent";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: ({ matches }) => ({
    meta: [
      { charSet: "utf-8" },
      // Título e descrição padrão: páginas com head() próprio os sobrescrevem;
      // estes servem de fallback seguro para qualquer rota sem metadados.
      { title: "Pro Football Manager 3D: jogo de técnico de futebol grátis em 3D" },
      {
        name: "description",
        content:
          "Assuma um clube real, contrate no mercado, monte a tática e veja seu time jogar em 3D. Grátis no navegador, no PC e no celular, com tabelas e elencos atualizados.",
      },
      {
        name: "google-site-verification",
        content: "N3Z9611b9SUqfFw2Y7W4VXRU1IQF5XiqC8MoOnaq-4U",
      },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "author", content: "Pro Football Manager 3D" },
      { name: "application-name", content: "Pro Football Manager 3D" },
      { name: "theme-color", content: "#0b1220" },
      { name: "color-scheme", content: "dark" },
      { name: "format-detection", content: "telephone=no" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Pro Football Manager 3D" },
    ],
    links: [
      // Critical CSS belongs to the SSR head. A route's deferred JS/CSS import
      // is too late for the first styled paint on a throttled mobile device.
      {
        rel: "stylesheet",
        href: isLightweightCssPath(matches.at(-1)?.pathname ?? "") ? publicCss : appCss,
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      // Resumo do site para assistentes de IA (padrão llms.txt)
      { rel: "llms", type: "text/plain", href: "/llms.txt" },
    ],
    scripts: [{ children: CONSENT_VISIBILITY_SCRIPT }],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});
