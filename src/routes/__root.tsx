import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConsentBanner } from "@/components/privacy/ConsentCenter";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useLocation,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { I18nProvider, useT } from "../i18n";
import { AccessibilityProvider } from "@/components/accessibility/AccessibilityProvider";
import { AccessibilitySettings } from "@/components/accessibility/AccessibilitySettings";
import { gamePageMetadata } from "@/lib/game-page-metadata";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="text-7xl font-bold text-foreground">404</p>
        <h1 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Esta página não existe ou mudou de endereço.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Não foi possível carregar esta página
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tente carregar novamente ou volte ao início para continuar.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              void router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Voltar ao início
          </a>
        </div>
      </div>
    </div>
  );
}

const GOOGLE_FONTS =
  "https://fonts.googleapis.com/css2?family=Archivo+Black&family=Hind:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap";

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
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
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
  const pathname = useLocation({ select: (location) => location.pathname });
  const worldReady = useRef(false);

  useEffect(() => {
    // The public home needs no catalogue. Restore the campaign on entry to the
    // rest of the app, rather than downloading every club after first paint.
    if (pathname === "/" || worldReady.current) return;
    worldReady.current = true;
    void import("../lib/world")
      .then((m) => m.applyWorld())
      .catch(() => {
        worldReady.current = false;
      });
  }, [pathname]);

  useEffect(() => {
    // Estatísticas de uso não podem competir com a primeira pintura: só sobem
    // quando o navegador fica ocioso (fallback por timer onde não há idle).
    const start = () => void import("../lib/analytics").then((m) => m.initAnalytics());
    window.addEventListener("consent-changed", start);
    const ric = (window as unknown as { requestIdleCallback?: typeof requestIdleCallback })
      .requestIdleCallback;
    if (typeof ric === "function") {
      const id = ric(start, { timeout: 5000 });
      return () => {
        window.removeEventListener("consent-changed", start);
        (window as unknown as { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback?.(
          id,
        );
      };
    }
    const timer = window.setTimeout(start, 3000);
    return () => {
      window.removeEventListener("consent-changed", start);
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AccessibilityProvider>
          <RootReadingControls pathname={pathname} />
          <a
            href="#conteudo"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-3 focus:font-display focus:text-sm focus:uppercase focus:tracking-widest focus:text-primary-foreground"
          >
            <SkipContentLabel />
          </a>
          <div id="conteudo" tabIndex={-1}>
            {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
            <Outlet />
            <ConsentBanner />
          </div>
        </AccessibilityProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

function SkipContentLabel() {
  return <>{useT().t("common.skip")}</>;
}
function RootReadingControls({ pathname }: { pathname: string }) {
  const { lang, t } = useT();
  const router = useRouter();
  const renderedPath = useRef(pathname);
  useEffect(() => {
    const page = gamePageMetadata(pathname, lang, t);
    if (!page) return;
    document.title = page.title;
    for (const selector of ['meta[property="og:title"]', 'meta[name="twitter:title"]']) {
      document.querySelector<HTMLMetaElement>(selector)?.setAttribute("content", page.title);
    }
    for (const selector of [
      'meta[name="description"]',
      'meta[property="og:description"]',
      'meta[name="twitter:description"]',
    ]) {
      document.querySelector<HTMLMetaElement>(selector)?.setAttribute("content", page.description);
    }
    let localeTag = document.querySelector<HTMLMetaElement>('meta[property="og:locale"]');
    if (page.locale) {
      if (!localeTag) {
        localeTag = document.createElement("meta");
        localeTag.setAttribute("property", "og:locale");
        document.head.append(localeTag);
      }
      localeTag.content = page.locale;
    } else localeTag?.remove();
  }, [pathname, lang, t]);
  useEffect(() => {
    let frame = 0;
    // A pathname can change before the lazy page mounts. Wait for the router
    // to acknowledge the new DOM, then allow closing menus to release focus.
    const unsubscribe = router.subscribe("onRendered", ({ toLocation }) => {
      // Lazy routes can acknowledge rendering after the URL is already
      // resolved. Compare the rendered destinations, not event.pathChanged.
      if (renderedPath.current === toLocation.pathname) return;
      renderedPath.current = toLocation.pathname;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const heading = document.querySelector<HTMLElement>(
          "main h1, #career-content h1, #conteudo h1",
        );
        if (heading) {
          heading.tabIndex = -1;
          heading.focus({ preventScroll: true });
        }
      });
    });
    return () => {
      unsubscribe();
      cancelAnimationFrame(frame);
    };
  }, [router]);
  return pathname === "/" ? (
    <div className="public-reading-controls">
      <AccessibilitySettings />
    </div>
  ) : null;
}
