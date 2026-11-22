/**
 * Ensures the browser build receives only the PUBLIC Supabase URL/key. Worker
 * bindings are runtime-only and cannot repair a Vite bundle built without VITE_*.
 */
export function publicSupabaseBuildEnv(settings) {
  const serverUrl = settings['SUPABASE_URL']?.trim();
  const browserUrl = settings['VITE_SUPABASE_URL']?.trim();
  const serverKey = settings['SUPABASE_PUBLISHABLE_KEY']?.trim();
  const browserKey = settings['VITE_SUPABASE_PUBLISHABLE_KEY']?.trim();
  const url = browserUrl || serverUrl;
  const key = browserKey || serverKey;

  if (!url) throw new Error('SUPABASE_URL or VITE_SUPABASE_URL is required for browser build.');
  if (!key) throw new Error('SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_PUBLISHABLE_KEY is required for browser build.');
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error('Invalid public Supabase URL.'); }
  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost')
    throw new Error('Public Supabase URL must use HTTPS.');
  if (serverUrl && browserUrl && new URL(serverUrl).origin !== parsed.origin)
    throw new Error('Browser and server Supabase project URLs must match.');
  if (serverKey && browserKey && serverKey !== browserKey)
    throw new Error('Browser and server Supabase key settings must match.');
  if (/^(?:sb_secret_|sk_(?:live|test)_)/.test(key))
    throw new Error('A secret key cannot be injected into the public bundle.');
  if (key.startsWith('eyJ')) {
    try {
      const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
      if (payload.role !== 'anon') throw new Error('not-anon');
    } catch {
      throw new Error('Only an anon legacy key may be used in the public bundle.');
    }
  }
  return { VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: key };
}
