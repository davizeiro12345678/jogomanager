import { Scripts, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { RouteHeadContent } from "@/components/RouteHeadContent";
import { isLightweightCssPath } from "@/lib/public-content-routes";
import {
  GUIA_DE_SCOUTING_PATH,
  GUIAS_PATH,
  MELHORES_FORMACOES_PATH,
} from "@/lib/public-route-paths";

export function RootShell({ children }: { children: ReactNode }) {
  const pathname = useLocation({ select: (location) => location.pathname });
  const path = pathname.replace(/\/+$/, "");
  const editorialShell =
    path === GUIAS_PATH || path === GUIA_DE_SCOUTING_PATH || path === MELHORES_FORMACOES_PATH;
  return (
    <html
      lang="pt-BR"
      className="dark"
      data-public-shell={isLightweightCssPath(pathname) || undefined}
      data-editorial-shell={editorialShell || undefined}
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
