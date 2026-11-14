import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

import { safeAuthNext } from "@/lib/auth-next";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (
    s: Record<string, unknown>,
  ): { next?: string; mode?: "up"; recovery?: boolean } => {
    const next = safeAuthNext(s["next"]);
    return {
      ...(next ? { next } : {}),
      ...(s["mode"] === "up" ? { mode: "up" as const } : {}),
      ...(s["recovery"] === "1" || s["recovery"] === true ? { recovery: true } : {}),
    };
  },
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Entrar ou criar conta · Pro Football Manager 3D" },
      {
        name: "description",
        content:
          "Crie sua conta, entre no jogo e recupere sua senha para continuar a carreira no Pro Football Manager 3D.",
      },
    ],
  }),
  // Browser-only page: keep its dependencies out of SSR Worker initialization.
  component: import.meta.env.SSR
    ? () => null
    : lazyRouteComponent(() => import("@/pages/auth"), "AuthPage"),
});
