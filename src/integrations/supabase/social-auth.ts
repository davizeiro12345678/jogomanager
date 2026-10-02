import type { Provider } from "@supabase/supabase-js";

export const SOCIAL_LABELS = {
  google: "Google",
  azure: "Microsoft",
  discord: "Discord",
  facebook: "Facebook",
  github: "GitHub",
  linkedin_oidc: "LinkedIn",
  spotify: "Spotify",
  figma: "Figma",
  apple: "Apple",
  bitbucket: "Bitbucket",
  gitlab: "GitLab",
  kakao: "Kakao",
  keycloak: "Keycloak",
  linkedin: "LinkedIn (legado)",
  notion: "Notion",
  slack_oidc: "Slack",
  slack: "Slack (legado)",
  twitch: "Twitch",
  twitter: "X / Twitter",
  x: "X",
  workos: "WorkOS",
  zoom: "Zoom",
  fly: "Fly.io",
} as const satisfies Record<Exclude<Provider, `custom:${string}`>, string>;

export type SocialProvider = Provider;
export type AuthMethods = {
  socialProviders: SocialProvider[];
  email: boolean;
  passkeys: boolean;
  signup: boolean;
};

export function socialProviderLabel(provider: SocialProvider): string {
  return provider.startsWith("custom:")
    ? provider.slice("custom:".length)
    : SOCIAL_LABELS[provider as keyof typeof SOCIAL_LABELS];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Read only explicit enabled flags, never infer providers from client credentials. */
export function parseAuthMethods(settings: unknown): AuthMethods {
  if (!isRecord(settings) || !isRecord(settings["external"])) {
    throw new Error("Invalid public authentication settings");
  }
  const external = settings["external"];
  const builtIn = (Object.keys(SOCIAL_LABELS) as (keyof typeof SOCIAL_LABELS)[]).filter(
    (provider) => external[provider] === true,
  );
  const custom = Object.keys(external).filter(
    (provider): provider is `custom:${string}` =>
      provider.startsWith("custom:") && provider.length > 7 && external[provider] === true,
  );
  return {
    socialProviders: [...builtIn, ...custom],
    email: external["email"] === true,
    passkeys: settings["passkeys_enabled"] === true,
    signup: settings["disable_signup"] !== true,
  };
}

/** Supabase publishes these flags; use only the browser's publishable key. */
export async function availableAuthMethods(signal?: AbortSignal): Promise<AuthMethods> {
  const url = import.meta.env["VITE_SUPABASE_URL"];
  const key = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Missing public authentication configuration");
  const timeout = AbortSignal.timeout(8_000);
  const response = await fetch(`${url.replace(/\/$/, "")}/auth/v1/settings`, {
    headers: { apikey: key },
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Authentication settings unavailable");
  return parseAuthMethods(await response.json());
}

export function lovableOAuthProvider(provider: SocialProvider) {
  if (provider === "google" || provider === "apple") return provider;
  if (provider === "azure") return "microsoft";
  return undefined;
}

export function socialOAuthOptions(provider: SocialProvider, redirectTo: string) {
  return { redirectTo, ...(provider === "azure" ? { scopes: "email" } : {}) };
}
