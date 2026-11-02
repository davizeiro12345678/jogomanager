/** Only advertise actual versions of the public home page. */
export const HOME_LOCALES = [
  { language: "pt-BR", path: "/" },
  { language: "en", path: "/en.html" },
  { language: "es", path: "/es.html" },
  { language: "x-default", path: "/" },
] as const;
