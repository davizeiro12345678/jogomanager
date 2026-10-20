import { createFileRoute, redirect } from "@tanstack/react-router";

import { Consent } from "@/pages/[.]lovable.oauth.consent";

export const Route = createFileRoute("/.lovable/oauth/consent")({
  // Browser-only: the Supabase session lives in localStorage, absent on SSR.
  ssr: false,
  head: () => ({
    meta: [
      { title: "Autorizar acesso · Pro Football Manager 3D" },
      {
        name: "description",
        content: "Revise e autorize com segurança o acesso de um aplicativo à sua carreira.",
      },
      { property: "og:title", content: "Autorizar acesso · Pro Football Manager 3D" },
      {
        property: "og:description",
        content: "Revise e autorize com segurança o acesso de um aplicativo à sua carreira.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s["authorization_id"] === "string" ? s["authorization_id"] : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    // Route guards are part of the shared route tree; load the session SDK
    // only when this browser-only consent route is actually entered.
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/auth", search: { next } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { supabase } = await import("@/integrations/supabase/client");
    const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
    if (error) throw error;
    const details = data as {
      redirect_url?: string;
      redirect_to?: string;
      client?: { name?: string } | null;
    } | null;
    const immediate = details?.redirect_url ?? details?.redirect_to;
    if (immediate && !details?.client) throw redirect({ href: immediate });
    return details;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="pitch-bg flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-card/85 p-6 text-center backdrop-blur-xl">
        <h1 className="font-display text-2xl">Não foi possível conectar</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {String((error as Error)?.message ?? error)}
        </p>
      </div>
    </main>
  ),
});
