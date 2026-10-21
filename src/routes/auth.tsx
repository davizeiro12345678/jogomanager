import { createFileRoute } from "@tanstack/react-router";

import { safeAuthNext } from "@/lib/auth-policy";

import { AuthPage } from "@/pages/auth";

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
  component: AuthPage,
});
