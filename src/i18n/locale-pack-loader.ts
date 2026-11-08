import { isLegacyPublishedLocale, isRuntimeApprovedLocale } from "./locale-runtime-manifest";
import type { Lang } from "./locale-identifiers";

export type LocaleMessagePack = Record<string, string>;
type LegacyPackModule = { default?: unknown };
type LegacyPackLoader = () => Promise<LegacyPackModule | unknown>;

const LEGACY_PACK_LOADERS = import.meta.glob<LegacyPackModule>("./packs/*.json");

export interface LoadLocalePackOptions {
  signal?: AbortSignal;
  /** Test seam; production always uses the allowlisted source pack glob. */
  legacyLoader?: LegacyPackLoader;
}

export function isLocaleMessagePack(value: unknown): value is LocaleMessagePack {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entries = Object.entries(value);
  return (
    entries.length > 0 &&
    entries.every(
      ([key, message]) =>
        key.trim().length > 0 && typeof message === "string" && message.trim().length > 0,
    )
  );
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new Error("Locale pack load was aborted.");
}

function modulePayload(value: LegacyPackModule | unknown): unknown {
  if (value && typeof value === "object" && "default" in value) {
    return (value as LegacyPackModule).default;
  }
  return value;
}

/**
 * Load only an already-published legacy pack. Generated packs live outside
 * `public/` and are deliberately not part of this loader's import graph.
 */
export async function loadLocalePack(
  lang: Lang,
  { signal, legacyLoader }: LoadLocalePackOptions = {},
): Promise<LocaleMessagePack> {
  throwIfAborted(signal);
  if (!isRuntimeApprovedLocale(lang)) {
    throw new Error(`Locale ${lang} is not approved for runtime loading.`);
  }
  if (!isLegacyPublishedLocale(lang)) {
    throw new Error(`Locale ${lang} has no runtime pack; use the bootstrap translator.`);
  }

  const loader = legacyLoader ?? LEGACY_PACK_LOADERS[`./packs/${lang}.json`];
  if (!loader) throw new Error(`Legacy locale pack ${lang} is unavailable.`);
  const loaded = await loader();
  throwIfAborted(signal);
  const payload = modulePayload(loaded);
  if (!isLocaleMessagePack(payload)) throw new Error("Locale pack has an invalid message map.");
  return payload;
}
