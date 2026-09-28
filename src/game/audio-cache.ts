import { del, get, set } from "idb-keyval";

const INDEX_KEY = "manager3d.voice-cache.v2.index";
const ITEM_PREFIX = "manager3d.voice-cache.v2:";
const MAX_BYTES = 12 * 1024 * 1024;
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

type CacheEntry = { audio: string; bytes: number; touchedAt: number };
type CacheIndex = Record<string, { bytes: number; touchedAt: number }>;

const memory = new Map<string, string>();

function itemKey(key: string) {
  return `${ITEM_PREFIX}${key}`;
}

export async function readVoiceCache(key: string): Promise<string | null> {
  const hot = memory.get(key);
  if (hot) return hot;
  try {
    const entry = await get<CacheEntry>(itemKey(key));
    if (!entry || Date.now() - entry.touchedAt > MAX_AGE_MS) {
      if (entry) await del(itemKey(key));
      return null;
    }
    memory.set(key, entry.audio);
    const index = (await get<CacheIndex>(INDEX_KEY)) ?? {};
    index[key] = { bytes: entry.bytes, touchedAt: Date.now() };
    await set(INDEX_KEY, index);
    return entry.audio;
  } catch {
    return null;
  }
}

export async function writeVoiceCache(key: string, audio: string): Promise<void> {
  memory.set(key, audio);
  try {
    const bytes = Math.ceil((audio.length * 3) / 4);
    const now = Date.now();
    const index = (await get<CacheIndex>(INDEX_KEY)) ?? {};
    index[key] = { bytes, touchedAt: now };
    const ordered = Object.entries(index).sort((a, b) => a[1].touchedAt - b[1].touchedAt);
    let total = ordered.reduce((sum, [, value]) => sum + value.bytes, 0);
    while (total > MAX_BYTES && ordered.length > 1) {
      const oldest = ordered.shift();
      if (!oldest) break;
      total -= oldest[1].bytes;
      delete index[oldest[0]];
      memory.delete(oldest[0]);
      await del(itemKey(oldest[0]));
    }
    await set(itemKey(key), { audio, bytes, touchedAt: now } satisfies CacheEntry);
    await set(INDEX_KEY, index);
  } catch {
    // A voz continua funcionando sem persistência quando o armazenamento está cheio.
  }
}

export function audioBlobUrl(base64: string): string {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return URL.createObjectURL(new Blob([bytes], { type: "audio/mpeg" }));
}
