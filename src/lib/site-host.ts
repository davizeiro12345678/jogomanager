/**
 * Host base usado por robots.txt e sitemap.xml.
 *
 * Endereços de preview (id-preview--*.lovable.app) nunca podem vazar para
 * buscadores: quando o pedido chega por um host de preview, respondemos com o
 * domínio publicado do projeto.
 */
export const PUBLISHED_BASE_URL = "https://stadium-stewards.lovable.app";

function isPreviewHost(hostname: string): boolean {
  return (
    hostname.includes("id-preview") ||
    hostname.endsWith(".lovableproject.com") ||
    hostname === "localhost"
  );
}

export function publicBaseUrlFor(request: Request): string {
  try {
    const url = new URL(request.url);
    if (isPreviewHost(url.hostname)) return PUBLISHED_BASE_URL;
    return url.origin;
  } catch {
    return PUBLISHED_BASE_URL;
  }
}
