/** New support copy is authored in Portuguese and English. Other languages
 * explicitly use English until a reviewed translation is added here. This
 * does not claim full localization of the older public pages or locale packs. */
export function supportCopyLanguage(lang: string): "pt" | "en" {
  return lang === "pt" || lang === "pt-BR" || lang === "pt-PT" ? "pt" : "en";
}

export function supportContentLocale(lang: string): "pt-BR" | "pt-PT" | "en" {
  return supportCopyLanguage(lang) === "pt" ? (lang === "pt-PT" ? "pt-PT" : "pt-BR") : "en";
}
