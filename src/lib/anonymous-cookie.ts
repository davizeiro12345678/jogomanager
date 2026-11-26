/** Cloudflare's bot-management cookie is not an application identity or session. */
export function hasSensitiveCookie(headers: Headers): boolean {
  const cookie = headers.get("cookie");
  if (cookie === null) return false;
  // Every other cookie is conservatively considered user/session state.
  return !/^__cf_bm=[^;\r\n]{1,2048}$/.test(cookie.trim());
}
