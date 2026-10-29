type Environment = Record<string, string | undefined>;

/** Probe only the trusted simulation service; never return provider data. */
export async function checkMatchAuxReadiness(
  env: Environment,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  const base = env["MATCH_AUX_URL"];
  const key = env["MATCH_AUX_SIGNING_KEY"];
  if (!base || !key || key.length < 32) return false;
  try {
    const url = new URL("/v1/readiness", base);
    if (url.protocol !== "https:" || url.username || url.password) return false;
    const body = '{"probe":"readiness"}';
    const timestamp = String(Date.now());
    const encoder = new TextEncoder();
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      encoder.encode(key),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const bytes = new Uint8Array(
      await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(`${timestamp}.${body}`)),
    );
    const signature = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    const response = await fetcher(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-pfm-timestamp": timestamp,
        "x-pfm-signature": signature,
      },
      body,
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(2_000),
    });
    if (response.status !== 200) return false;
    const result: unknown = await response.json();
    return Boolean(
      result &&
      typeof result === "object" &&
      !Array.isArray(result) &&
      "ok" in result &&
      result.ok === true &&
      "busy" in result &&
      typeof result.busy === "boolean",
    );
  } catch {
    return false;
  }
}
