export type SocialProvider = "google" | "azure" | "apple";
export const SOCIAL_LABELS: Record<SocialProvider, string> = {
  google: "Google",
  azure: "Microsoft",
  apple: "Apple",
};

/** Supabase exposes these settings publicly; no administrative key is needed. */
export async function availableSocialProviders(): Promise<SocialProvider[]> {
  const url = import.meta.env["VITE_SUPABASE_URL"];
  const key = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return [];
  const response = await fetch(`${url}/auth/v1/settings`, {
    headers: { apikey: key },
    signal: AbortSignal.timeout(8_000),
    cache: "no-store",
  });
  if (!response.ok) return [];
  const settings = (await response.json()) as { external?: Record<string, boolean> };
  return (["google", "azure", "apple"] as const).filter(
    (provider) => settings.external?.[provider] === true,
  );
}
