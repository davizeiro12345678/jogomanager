import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext } from "@tanstack/react-router";
import {
  NotFoundComponent,
  ErrorComponent,
  RootShell,
  RootComponent,
} from "@/components/RootLayout";
import appCss from "../styles.css?url";

const LIGHTWEIGHT_PUBLIC_ROUTES = new Set([
  "/",
  "/guias",
  "/guia-de-scouting",
  "/melhores-formacoes",
  "/partida-rapida",
]);
import { CONSENT_VISIBILITY_SCRIPT } from "@/lib/consent";

// Optional prevents late font swaps after first paint, avoiding text-induced CLS
// on mobile routes without blocking the initial stylesheet and LCP.
const GOOGLE_FONTS =
  "https://fonts.googleapis.com/css2?family=Archivo+Black&family=Hind:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=optional";

/** Activate only a loaded sheet; a failed request must keep the system-font fallback. */
const ENABLE_FONTS = `(function(){var l=document.getElementById('google-fonts');if(l){var go=function(){l.media='all'};l.sheet?go():l.addEventListener('load',go,{once:true})}})();`;

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
      ...(!LIGHTWEIGHT_PUBLIC_ROUTES.has(matches.at(-1)?.routeId ?? "")
        ? [{ rel: "stylesheet", href: appCss }]
        : []),
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      // Fontes carregadas sem bloquear a primeira pintura: entram como "print"
      // e o script abaixo as libera assim que o navegador as baixa.
      // Avoid high-priority font CSS competing with the LCP image on mobile.
      { rel: "stylesheet", href: GOOGLE_FONTS, media: "print", id: "google-fonts" },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      // Resumo do site para assistentes de IA (padrão llms.txt)
      { rel: "llms", type: "text/plain", href: "/llms.txt" },
    ],
    scripts: [{ children: ENABLE_FONTS }, { children: CONSENT_VISIBILITY_SCRIPT }],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});
