import { PUBLIC_PAGE_INVENTORY } from "./public-page-inventory";

/** Public authored pages. Personal game screens stay crawlable for noindex. */
export const PUBLIC_SEARCH_PAGES: readonly string[] = PUBLIC_PAGE_INVENTORY.map(({ path }) => path);
const publicPages: ReadonlySet<string> = new Set(PUBLIC_SEARCH_PAGES);

export function responseIndexingPolicy(pathname: string, contentType: string) {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (path.startsWith("/_serverFn/assets/")) return null;
  if (/^\/(?:api\/|_serverFn\/|lovable\/|mcp$)/.test(path)) return "noindex, nofollow";
  if (!contentType.includes("text/html") || publicPages.has(path)) return null;
  return /^\/(?:checkout\/|auth$|cadastro$|\.lovable\/)/.test(path)
    ? "noindex, nofollow"
    : "noindex, follow";
}
