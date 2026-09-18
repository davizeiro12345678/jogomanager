/**
 * Host base usado por robots.txt e sitemap.xml.
 *
 * O site responde em vários domínios (preview, *.lovable.app e domínios
 * próprios). Para os buscadores só existe um endereço canônico, então
 * robots.txt e sitemap.xml sempre apontam para ele.
 */
export const PUBLISHED_BASE_URL = "https://jogomanager.com";

export function publicBaseUrlFor(_request: Request): string {
  return PUBLISHED_BASE_URL;
}
