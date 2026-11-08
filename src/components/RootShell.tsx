import { Scripts, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { RouteHeadContent } from "@/components/RouteHeadContent";
import { isLightweightCssPath } from "@/lib/public-content-routes";

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
