import type { Lang } from "./locale-catalog";

export type FeatureMessages<K extends string> = Readonly<
  Record<"pt" | "en" | "es", Readonly<Record<K, string>>>
>;

/** Feature-local catalogs follow the existing English fallback without loading global packs. */
export function featureMessages<K extends string>(
  lang: Lang,
  messages: FeatureMessages<K>,
): Readonly<Record<K, string>> {
  return messages[lang.startsWith("pt") ? "pt" : lang === "es" ? "es" : "en"];
}
