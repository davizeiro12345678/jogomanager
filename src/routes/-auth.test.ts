import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthMethods } from "@/integrations/supabase/social-auth";
import { parseAuthMethods } from "@/integrations/supabase/social-auth";

const state = vi.hoisted(() => ({
  methods: null as AuthMethods | null,
  loading: false,
  error: null as string | null,
  retry: vi.fn(),
  passkeysSupported: true,
}));

vi.mock("@/hooks/useAuthMethods", () => ({ useAuthMethods: () => state }));
vi.mock("@/integrations/supabase/passkey-auth", () => ({
  supportsPasskeys: () => state.passkeysSupported,
  passkeyErrorMessage: () => "Falha na chave de acesso",
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: object) => ({ options, useSearch: () => ({}) }),
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children: React.ReactNode }) => createElement("a", null, children),
}));

import { Route } from "./auth";

function renderAuth() {
  return renderToStaticMarkup(createElement(Route.options.component as ComponentType));
}

beforeEach(() => {
  state.methods = parseAuthMethods({
    external: {
      google: true,
      azure: true,
      discord: true,
      facebook: true,
      github: true,
      linkedin_oidc: true,
      spotify: true,
      figma: true,
      apple: false,
      email: true,
    },
    passkeys_enabled: true,
  });
  state.loading = false;
  state.error = null;
  state.passkeysSupported = true;
});

describe("game login screen", () => {
  it("renders all eight enabled providers together with email and passkeys", () => {
    const markup = renderAuth();
    for (const label of [
      "Google",
      "Microsoft",
      "Discord",
      "Facebook",
      "GitHub",
      "LinkedIn",
      "Spotify",
      "Figma",
    ]) {
      expect(markup).toContain(`Continuar com ${label}`);
    }
    expect(markup).not.toContain("Continuar com Apple");
    expect(markup).toContain("Entrar com chave de acesso");
    expect(markup).toContain("Entrar por link ou código de e-mail");
  });

  it("keeps additional Supabase providers in Lovable mode and hides disabled Apple", () => {
    vi.stubEnv("VITE_AUTH_MODE", "lovable");
    try {
      const markup = renderAuth();
      expect(markup).toContain("Continuar com Discord");
      expect(markup).toContain("Continuar com GitHub");
      expect(markup).not.toContain("Continuar com Apple");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("does not offer disabled email or passkey flows", () => {
    state.methods = parseAuthMethods({ external: { google: true, email: false } });
    const markup = renderAuth();
    expect(markup).not.toContain("auth-email");
    expect(markup).not.toContain("Entrar com chave de acesso");
    expect(markup).not.toContain("Não tem conta? Cadastre-se");
  });

  it("offers a retry on discovery failure without guessing providers", () => {
    state.methods = null;
    state.error = "Falha ao carregar";
    const markup = renderAuth();
    expect(markup).toContain("Tentar novamente");
    expect(markup).not.toContain("Continuar com Google");
  });

  it("does not render Supabase providers excluded by the verified login allowlist", () => {
    state.methods = parseAuthMethods({ external: { google: true, facebook: true, email: true } }, [
      "google",
    ]);
    const markup = renderAuth();
    expect(markup).toContain("Continuar com Google");
    expect(markup).not.toContain("Continuar com Facebook");
    expect(markup).toContain("Entrar com e-mail");
  });

  it("explains unsupported passkeys before starting a browser ceremony", () => {
    state.passkeysSupported = false;
    expect(renderAuth()).toContain("navegador com suporte a chaves de acesso");
  });
});
