import { readVoiceCache, writeVoiceCache } from "./audio-cache";

export type SceneVoiceLoader = (scene: string, line: number) => Promise<string | null>;
const pending = new Map<string, Promise<string | null>>();
export const SCENE_VOICE_WAIT_MS = 1800;

/** A slow or hung optional service cannot hold the dialogue indefinitely. */
export function voiceWithin(request: Promise<string | null>, timeout = SCENE_VOICE_WAIT_MS) {
  return new Promise<string | null>((resolve) => {
    const timer = setTimeout(() => resolve(null), timeout);
    void request
      .catch(() => null)
      .then((audio) => {
        clearTimeout(timer);
        resolve(audio);
      });
  });
}

/** Includes cache lookup in the deduplicated request; persistence never delays playback. */
export function sceneVoice(loader: SceneVoiceLoader | undefined, scene: string, line: number) {
  if (!loader) return Promise.resolve(null);
  const key = `scene|${scene}|${line}`;
  const existing = pending.get(key);
  if (existing) return existing;
  const request = (async () => {
    const cached = await voiceWithin(readVoiceCache(key));
    if (cached) return cached;
    const audio = await voiceWithin(Promise.resolve().then(() => loader(scene, line)));
    if (audio) void writeVoiceCache(key, audio).catch(() => undefined);
    return audio;
  })()
    .catch(() => null)
    .finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}
