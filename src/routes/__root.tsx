import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { I18nProvider } from "../i18n";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="text-7xl font-bold text-foreground">404</p>
        <h1 className="mt-4 text-xl font-semibold text-foreground">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

const GOOGLE_FONTS =
  "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Inter+Tight:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap";

/** Libera as fontes (carregadas como "print") sem bloquear a primeira pintura. */
const ENABLE_FONTS = `(function(){var l=document.getElementById('google-fonts');if(!l)return;var go=function(){l.media='all'};if(l.sheet){go()}else{l.addEventListener('load',go);setTimeout(go,1500)}})();`;

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "google-site-verification",
        content: "N3Z9611b9SUqfFw2Y7W4VXRU1IQF5XiqC8MoOnaq-4U",
      },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "author", content: "Pro Football Manager 3D" },
      { name: "theme-color", content: "#0a8f3c" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Pro Football Manager 3D" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      // Fontes carregadas sem bloquear a primeira pintura: entram como "print"
      // e o script abaixo as libera assim que o navegador as baixa.
      { rel: "preload", as: "style", href: GOOGLE_FONTS },
      { rel: "stylesheet", href: GOOGLE_FONTS, media: "print", id: "google-fonts" },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      // Resumo do site para assistentes de IA (padrão llms.txt)
      { rel: "llms", type: "text/plain", href: "/llms.txt" },
    ],
    scripts: [{ children: ENABLE_FONTS }],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    void import("../lib/world").then((m) => m.applyWorld());

    // Estatísticas de uso não podem competir com a primeira pintura: só sobem
    // quando o navegador fica ocioso (fallback por timer onde não há idle).
    const start = () => void import("../lib/analytics").then((m) => m.initAnalytics());
    const ric = (window as unknown as { requestIdleCallback?: typeof requestIdleCallback })
      .requestIdleCallback;
    if (typeof ric === "function") {
      const id = ric(start, { timeout: 5000 });
      return () =>
        (
          window as unknown as { cancelIdleCallback?: (h: number) => void }
        ).cancelIdleCallback?.(id);
    }
    const timer = window.setTimeout(start, 3000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-3 focus:font-display focus:text-sm focus:uppercase focus:tracking-widest focus:text-primary-foreground"
        >
          Pular para o conteúdo
        </a>
        <div id="conteudo">
          {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
          <Outlet />
        </div>
      </I18nProvider>
    </QueryClientProvider>
  );
}
