import { QueryClientProvider } from "@tanstack/react-query";
import { ConsentBanner } from "@/components/privacy/ConsentBanner";
import {
  Outlet,
  Link,
  useRouteContext,
  useRouter,
  useLocation,
  Scripts,
} from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";

import { I18nProvider, useT } from "../i18n/provider";
import {
  isLightweightCssPath,
  isPublicContentPath,
  shouldInitializeWorldOnEntry,
} from "@/lib/public-content-routes";
import { AccessibilityProvider } from "@/components/accessibility/AccessibilityProvider";
import { RouteHeadContent } from "@/components/RouteHeadContent";
// Reading-controls UI is only visible on the public home page. Keep it out of
// the shared initial JS closure for every gameplay and editorial route.
const AccessibilitySettings = lazy(
  () => import("@/components/accessibility/AccessibilitySettings"),
);

function PageFailure({
  title,
  message,
  children,
}: {
  title: string;
  message: string;
  children?: ReactNode;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {children}
          <Link
            to="/"
            className="inline-flex min-h-11 items-center rounded-md border border-input px-4 text-sm font-medium hover:bg-accent"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </main>
  );
}

export function NotFoundComponent() {
  return (
    <PageFailure
      title="Página não encontrada"
      message="Esta página mudou de endereço ou foi removida."
    />
  );
}

export function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    void import("../lib/lovable-error-reporting")
      .then(({ reportLovableError }) =>
        reportLovableError(error, { boundary: "tanstack_root_error_component" }),
      )
      .catch(() => undefined);
  }, [error]);

  return (
    <PageFailure
      title="Não foi possível carregar esta página"
      message="Tente carregar novamente ou volte ao início."
    >
      <button
        type="button"
        onClick={() => {
          void router.invalidate();
          reset();
        }}
        className="min-h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
      >
        Tentar novamente
      </button>
    </PageFailure>
  );
}

export function RootShell({ children }: { children: ReactNode }) {
  const pathname = useLocation({ select: (location) => location.pathname });
  return (
    <html
      lang="pt-BR"
      className="dark"
      data-public-shell={isLightweightCssPath(pathname) || undefined}
    >
      <head>
        <RouteHeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

// SEO/editorial pages must not download the full league and squad catalogue.
// On navigation into gameplay we still initialize it immediately.
export function RootComponent() {
  const { queryClient } = useRouteContext({ from: "__root__" });
  const pathname = useLocation({ select: (location) => location.pathname });

  useEffect(() => {
    // The public home needs no catalogue. Restore the campaign on entry to the
    // rest of the app, rather than downloading every club after first paint.
    if (shouldInitializeWorldOnEntry(pathname))
      void import("../lib/world").then((world) => world.default()).catch(() => undefined);
  }, [pathname]);

  useEffect(() => {
    // Estatísticas de uso não podem competir com a primeira pintura: só sobem
    // quando o navegador fica ocioso (fallback por timer onde não há idle).
    const start = () => void import("../lib/analytics").then((m) => m.initAnalytics());
    window.addEventListener("consent-changed", start);
    const idle = typeof window.requestIdleCallback === "function";
    const handle = idle
      ? window.requestIdleCallback(start, { timeout: 5000 })
      : window.setTimeout(start, 3000);
    return () => {
      window.removeEventListener("consent-changed", start);
      if (idle) window.cancelIdleCallback?.(handle);
      else window.clearTimeout(handle);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AccessibilityProvider>
          <RootReadingControls pathname={pathname} />
          <SkipContentLink />
          <div id="conteudo" tabIndex={-1}>
            {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
            <Outlet />
            <ConsentBanner />
          </div>
          <DeferredToaster />
        </AccessibilityProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

function SkipContentLink() {
  return (
    <a href="#conteudo" className="skip-to-content">
      {useT().t("common.skip")}
    </a>
  );
}
function RootReadingControls({ pathname }: { pathname: string }) {
  const { lang, t } = useT();
  const router = useRouter();
  const renderedPath = useRef(pathname);
  useEffect(() => {
    // These public routes already declare canonical head metadata via TanStack
    // SSR. Never download game-page metadata for a route that does not use it.
    if (isPublicContentPath(pathname)) return;
    let active = true;
    // Route metadata is only written after the client page renders. Keep its
    // copy and translation tables out of every initial route's static closure.
    void import("../lib/game-page-metadata")
      .then(({ applyGamePageMetadata }) => {
        if (active) applyGamePageMetadata(pathname, lang, t);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
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
      <Suspense fallback={null}>
        <AccessibilitySettings />
      </Suspense>
    </div>
  ) : null;
}

const LazyToaster = lazy(() =>
  import("@/components/ui/sonner").then((m) => ({ default: m.Toaster })),
);
/** Notifications from toast() need one mounted host; load it after hydration. */
function DeferredToaster() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready ? (
    <Suspense fallback={null}>
      <LazyToaster position="top-center" richColors />
    </Suspense>
  ) : null;
}
