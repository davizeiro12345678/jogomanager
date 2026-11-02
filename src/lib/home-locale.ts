/** Locale of the public home variants; all other editorial pages remain pt-BR. */
export function homeLocale(pathname: string): "en" | "es" | null {
  const path = pathname.replace(/\/$/, "") || "/";
  if (path === "/en") return "en";
  if (path === "/es") return "es";
  return null;
}
