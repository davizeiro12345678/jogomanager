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
  let url;
  try {
    url = new URL(target);
  } catch {
    throw new Error("Staging target must be a valid HTTPS origin");
  }
  const exact =
    url.protocol === "https:" &&
    url.hostname === "staging.jogomanager.com" &&
    !url.port &&
    !url.username &&
    !url.password &&
    (url.pathname === "/" || url.pathname === "") &&
    !url.search &&
    !url.hash;
  if (!exact) {
    throw new Error("Only exact https://staging.jogomanager.com/ target is permitted");
  }
  return "https://staging.jogomanager.com";
}
