import {
  ADDED_LANGS,
  BASE_LANGS,
  LANGS,
  RTL_LANGS,
  resolveLang,
  type AddedLang,
  type Lang,
} from "./locale-identifiers";
export { BASE_LANGS, ADDED_LANGS, LANGS, RTL_LANGS, resolveLang, type Lang, type AddedLang };
export const LANG_NAMES: Record<Lang, string> = {
  "pt-BR": "Português (Brasil)",
  "pt-PT": "Português (Portugal)",
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
  nl: "Nederlands",
  pl: "Polski",
  tr: "Türkçe",
  ru: "Русский",
  uk: "Українська",
  ar: "العربية",
  he: "עברית",
  fa: "فارسی",
  hi: "हिन्दी",
  bn: "বাংলা",
  id: "Bahasa Indonesia",
  ms: "Bahasa Melayu",
  vi: "Tiếng Việt",
  th: "ไทย",
  ja: "日本語",
  ko: "한국어",
  "zh-CN": "简体中文",
  "zh-TW": "繁體中文",
  sv: "Svenska",
  no: "Norsk",
  da: "Dansk",
  fi: "Suomi",
  cs: "Čeština",
  sk: "Slovenčina",
  hu: "Magyar",
  ro: "Română",
  el: "Ελληνικά",
  bg: "Български",
  sr: "Српски",
  hr: "Hrvatski",
  ca: "Català",
  sw: "Kiswahili",
  af: "Afrikaans",
  am: "አማርኛ",
  as: "অসমীয়া",
  az: "Azərbaycan",
  be: "Беларуская",
  bs: "Bosanski",
  ceb: "Cebuano",
  cy: "Cymraeg",
  eo: "Esperanto",
  et: "Eesti",
  eu: "Euskara",
  fil: "Filipino",
  ga: "Gaeilge",
  gd: "Gàidhlig",
  gl: "Galego",
  gu: "ગુજરાતી",
  ha: "Hausa",
  hy: "Հայերեն",
  ig: "Igbo",
  is: "Íslenska",
  jv: "Basa Jawa",
  ka: "ქართული",
  kk: "Қазақша",
  km: "ខ្មែរ",
  kn: "ಕನ್ನಡ",
  ku: "Kurdî",
  ky: "Кыргызча",
  lb: "Lëtzebuergesch",
  lo: "ລາວ",
  lt: "Lietuvių",
  lv: "Latviešu",
  mk: "Македонски",
  ml: "മലയാളം",
  mn: "Монгол",
  mr: "मराठी",
  mt: "Malti",
  my: "မြန်မာ",
  ne: "नेपाली",
  pa: "ਪੰਜਾਬੀ",
  ps: "پښتو",
  si: "සිංහල",
  sl: "Slovenščina",
  so: "Soomaali",
  sq: "Shqip",
  ta: "தமிழ்",
  te: "తెలుగు",
  tg: "Тоҷикӣ",
  tk: "Türkmençe",
  ur: "اردو",
  uz: "Oʻzbek",
  yo: "Yorùbá",
  zu: "isiZulu",
  rw: "Kinyarwanda",
  mg: "Malagasy",
  ny: "Chichewa",
  sd: "سنڌي",
  yi: "ייִדיש",
  ug: "ئۇيغۇرچە",
  dv: "ދިވެހި",
};

export const TRANSLATION_STATUSES = ["draft", "reviewed", "approved"] as const;
export type TranslationStatus = (typeof TRANSLATION_STATUSES)[number];
export type LocaleSource = "source" | "pack" | "fallback";

/** JSON packs currently present under src/i18n/packs/. Keep this list in sync with the files. */
export const LOCALE_PACKS = [
  "ar",
  "bn",
  "de",
  "es",
  "fa",
  "fr",
  "hi",
  "id",
  "it",
  "ja",
  "ko",
  "mr",
  "pa",
  "pl",
  "pt-PT",
  "ru",
  "sw",
  "ta",
  "te",
  "th",
  "tr",
  "ur",
  "vi",
  "zh-CN",
] as const satisfies readonly Lang[];

export interface LocaleCatalogEntry {
  locale: Lang;
  name: string;
  direction: "ltr" | "rtl";
  source: LocaleSource;
  hasPack: boolean;
  fallbackLocale: "en" | null;
  status: TranslationStatus;
  translationComplete: boolean;
}

const PACKED_LOCALES: ReadonlySet<Lang> = new Set(LOCALE_PACKS);
const SOURCE_LOCALES: ReadonlySet<Lang> = new Set(["pt-BR", "en"]);

function sourceFor(locale: Lang): LocaleSource {
  if (SOURCE_LOCALES.has(locale)) return "source";
  return PACKED_LOCALES.has(locale) ? "pack" : "fallback";
}

export const LOCALE_CATALOG: Readonly<Record<Lang, LocaleCatalogEntry>> = LANGS.reduce(
  (catalog, locale) => {
    const source = sourceFor(locale);
    catalog[locale] = {
      locale,
      name: LANG_NAMES[locale],
      direction: RTL_LANGS.has(locale) ? "rtl" : "ltr",
      source,
      hasPack: source === "pack",
      fallbackLocale: source === "source" ? null : "en",
      // Generated packs and fallback dictionaries remain draft until native review.
      status: source === "source" ? "approved" : "draft",
      translationComplete: source === "source",
    };
    return catalog;
  },
  {} as Record<Lang, LocaleCatalogEntry>,
);

export interface LocalePackParity {
  announcedWithoutPack: Lang[];
  catalogPacksMissingOnDisk: Lang[];
  actualPacksNotCatalogued: string[];
  fallbackLocales: Lang[];
}

/** Compare announced identifiers with the JSON packs found by the caller. */
export function compareLocalePacks(realPackLocales: readonly string[]): LocalePackParity {
  const actualPacks = new Set(realPackLocales);
  const announced = new Set<string>(LANGS);
  return {
    announcedWithoutPack: LANGS.filter((locale) => !actualPacks.has(locale)),
    catalogPacksMissingOnDisk: LOCALE_PACKS.filter((locale) => !actualPacks.has(locale)),
    actualPacksNotCatalogued: [...actualPacks].filter((locale) => !announced.has(locale)),
    fallbackLocales: LANGS.filter(
      (locale) => locale !== "pt-BR" && locale !== "en" && !actualPacks.has(locale),
    ),
  };
}

export function languageSearchText(lang: Lang, displayLocale: string): string {
  let displayName = "";
  try {
    displayName = new Intl.DisplayNames([displayLocale], { type: "language" }).of(lang) ?? "";
  } catch (error) {
    reportSilent("i18n.translation", error, {
      classification: "ignorable",
      feature: "display-name",
      phase: "intl",
      dedupeKey: "intl-display-names",
    });
  }
  return `${LANG_NAMES[lang]} ${displayName} ${lang}`
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase();
}
import { reportSilent } from "@/lib/silent-errors";
