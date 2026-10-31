import { isValidElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({
  direct: vi.fn(),
  broker: vi.fn(),
}));

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => [typeof initial === "function" ? initial() : initial, vi.fn()],
  useEffect: () => undefined,
  useCallback: (fn: unknown) => fn,
}));
vi.mock("@tanstack/react-router", () => ({
  getRouteApi: () => ({ useSearch: () => ({ next: "/loja" }) }),
  useNavigate: () => vi.fn(),
  Link: "a",
}));
vi.mock("@/hooks/useAuthMethods", () => ({
  useAuthMethods: () => ({
    methods: { socialProviders: ["google", "azure", "discord"], email: true },
    loading: false,
    error: null,
    retry: vi.fn(),
  }),
}));
vi.mock("@/integrations/supabase/passkey-auth", () => ({
  supportsPasskeys: () => false,
  passkeyErrorMessage: () => "",
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { signInWithOAuth: calls.direct } },
}));
vi.mock("@/integrations/lovable/index", () => ({
  lovable: { auth: { signInWithOAuth: calls.broker } },
}));

import { AuthPage } from "./auth";

function findButton(node: unknown, label: string): (() => Promise<void>) | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findButton(child, label);
      if (found) return found;
    }
    return undefined;
  }
  if (
    !isValidElement<{ children?: unknown; onClick?: () => Promise<void>; "aria-label"?: string }>(
      node,
    )
  )
    return undefined;
  if (node.props.onClick && (node.props.children === label || node.props["aria-label"] === label))
    return node.props.onClick;
  return findButton(node.props.children, label);
}

beforeEach(() => {
  calls.direct.mockResolvedValue({ error: null });
  calls.broker.mockResolvedValue({ redirected: true, error: null });
  vi.stubGlobal("window", { location: { origin: "https://jogomanager.com" } });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("social sign-in selection", () => {
  it.each(["supabase", "supabase-direct", ""])(
    "sends Google to Supabase when auth mode is %j",
    async (mode) => {
      vi.stubEnv("VITE_AUTH_MODE", mode);
      const click = findButton(AuthPage(), "Continuar com Google");
      expect(click).toBeDefined();
      await click!();
      expect(calls.direct).toHaveBeenCalledWith({
        provider: "google",
        options: { redirectTo: "https://jogomanager.com/auth?next=%2Floja" },
      });
      expect(calls.broker).not.toHaveBeenCalled();
    },
  );

  it("uses the Lovable broker only when explicitly configured", async () => {
    vi.stubEnv("VITE_AUTH_MODE", "lovable");
    await findButton(AuthPage(), "Continuar com Microsoft")!();
    expect(calls.broker).toHaveBeenCalledWith("microsoft", {
      redirect_uri: "https://jogomanager.com/auth?next=%2Floja",
    });
    expect(calls.direct).not.toHaveBeenCalled();
  });

  it("keeps non-brokered providers on Supabase in Lovable mode", async () => {
    vi.stubEnv("VITE_AUTH_MODE", "lovable");
    await findButton(AuthPage(), "Continuar com Discord")!();
    expect(calls.direct).toHaveBeenCalledWith({
      provider: "discord",
      options: { redirectTo: "https://jogomanager.com/auth?next=%2Floja" },
    });
    expect(calls.broker).not.toHaveBeenCalled();
  });
});
