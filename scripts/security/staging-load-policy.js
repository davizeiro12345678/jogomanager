/**
 * Stage-only guardrail for synthetic HTTP load.
 * Does not prove the backing database is isolated; the caller must separately
 * verify DNS, Worker bindings, Supabase project and provider webhooks.
 */
export const LOAD_PEAK_RPS = 4000;
export const SAFE_PUBLIC_PATHS = Object.freeze([
  "/",
  "/jogo-de-manager-de-futebol",
  "/tabelas",
  "/guia-de-scouting",
  "/melhores-formacoes",
  "/dicas-de-gestao",
  "/robots.txt",
  "/sitemap.xml",
]);

export function validateStagingTarget({ target, isolation }) {
  if (isolation !== "ISOLATED-STAGING-VERIFIED") {
    throw new Error("Missing independent staging isolation attestation");
  }
  // String allowlisting avoids URL globals missing in some k6 runtimes
  // and blocks all redirects, query strings, lookalike hostnames and ports.
  if (
    target !== "https://staging.jogomanager.com" &&
    target !== "https://staging.jogomanager.com/"
  ) {
    throw new Error("Only exact https://staging.jogomanager.com/ target is permitted");
  }
  return "https://staging.jogomanager.com";
}
