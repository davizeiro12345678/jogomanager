/** Only advertise actual versions of the public home page. */
export const HOME_LOCALES = [
  { language: "pt-BR", path: "/" },
  { language: "en", path: "/en" },
  { language: "es", path: "/es" },
  { language: "x-default", path: "/" },
] as const;
