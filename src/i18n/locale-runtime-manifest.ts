/**
 * Runtime locale policy.
 *
 * `runtimeApproved` means that this locale has an existing runtime path in the
 * product. It does not mean that any new translation content has semantic or
 * native-speaker approval. Generated packs remain drafts until reviewed.
 */
import { type Lang } from "./locale-identifiers";

export const LEGACY_PUBLISHED_LOCALES = [
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

export type LegacyPublishedLocale = (typeof LEGACY_PUBLISHED_LOCALES)[number];
export type RuntimeApprovedLang = "pt-BR" | "en" | LegacyPublishedLocale;

export const RUNTIME_APPROVED_LOCALES = [
  "pt-BR",
  "en",
  ...LEGACY_PUBLISHED_LOCALES,
] as const satisfies readonly RuntimeApprovedLang[];

export type RuntimeLocaleSource = "bootstrap" | "legacy-pack";
export type RuntimeLocaleManifestEntry = {
  readonly runtimeApproved: true;
  readonly source: RuntimeLocaleSource;
  /** Runtime eligibility is not a semantic translation approval. */
  readonly reviewStatus: "source" | "legacy-published";
};

export const LOCALE_RUNTIME_MANIFEST = {
  "pt-BR": { runtimeApproved: true, source: "bootstrap", reviewStatus: "source" },
  en: { runtimeApproved: true, source: "bootstrap", reviewStatus: "source" },
  ar: { runtimeApproved: true, source: "legacy-pack", reviewStatus: "legacy-published" },
  bn: { runtimeApproved: true, source: "legacy-pack", reviewStatus: "legacy-published" },
  de: { runtimeApproved: true, source: "legacy-pack", reviewStatus: "legacy-published" },
  es: { runtimeApproved: true, source: "legacy-pack", reviewStatus: "legacy-published" },
  fa: { runtimeApproved: true, source: "legacy-pack", reviewStatus: "legacy-published" },
  fr: { runtimeApproved: true, source: "legacy-pack", reviewStatus: "legacy-published" },
  hi: { runtimeApproved: true, source: "legacy-pack", reviewStatus: "legacy-published" },
  id: { runtimeApproved: true, source: "legacy-pack", reviewStatus: "legacy-published" },
  it: { runtimeApproved: true, source: "legacy-pack", reviewStatus: "legacy-published" },
  ja: { runtimeApproved: true, source: "legacy-pack", reviewStatus: "legacy-published" },
  ko: { runtimeApproved: true, source: "legacy-pack", reviewStatus: "legacy-published" },
  mr: { runtimeApproved: true, source: "legacy-pack", reviewStatus: "legacy-published" },
  pa: { runtimeApproved: true, source: "legacy-pack", reviewStatus: "legacy-published" },
  pl: { runtimeApproved: true, source: "legacy-pack", reviewStatus: "legacy-published" },
  "pt-PT": {
    runtimeApproved: true,
    source: "legacy-pack",
    reviewStatus: "legacy-published",
  },
  ru: { runtimeApproved: true, source: "legacy-pack", reviewStatus: "legacy-published" },
  sw: { runtimeApproved: true, source: "legacy-pack", reviewStatus: "legacy-published" },
  ta: { runtimeApproved: true, source: "legacy-pack", reviewStatus: "legacy-published" },
  te: { runtimeApproved: true, source: "legacy-pack", reviewStatus: "legacy-published" },
  th: { runtimeApproved: true, source: "legacy-pack", reviewStatus: "legacy-published" },
  tr: { runtimeApproved: true, source: "legacy-pack", reviewStatus: "legacy-published" },
  ur: { runtimeApproved: true, source: "legacy-pack", reviewStatus: "legacy-published" },
  vi: { runtimeApproved: true, source: "legacy-pack", reviewStatus: "legacy-published" },
  "zh-CN": {
    runtimeApproved: true,
    source: "legacy-pack",
    reviewStatus: "legacy-published",
  },
} as const satisfies Record<RuntimeApprovedLang, RuntimeLocaleManifestEntry>;

const RUNTIME_APPROVED_SET: ReadonlySet<string> = new Set(RUNTIME_APPROVED_LOCALES);
const LEGACY_PUBLISHED_SET: ReadonlySet<string> = new Set(LEGACY_PUBLISHED_LOCALES);

export function isRuntimeApprovedLocale(lang: string): lang is RuntimeApprovedLang {
  return RUNTIME_APPROVED_SET.has(lang);
}

export function isLegacyPublishedLocale(lang: string): lang is LegacyPublishedLocale {
  return LEGACY_PUBLISHED_SET.has(lang);
}

export function runtimeLocaleManifestEntry(lang: string): RuntimeLocaleManifestEntry | undefined {
  if (!isRuntimeApprovedLocale(lang)) return undefined;
  return LOCALE_RUNTIME_MANIFEST[lang];
}
