import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sceneVoice, voiceWithin, SCENE_VOICE_WAIT_MS } from "./cutscene-voice";
import { readVoiceCache, writeVoiceCache } from "./audio-cache";

vi.mock("./audio-cache", () => ({ readVoiceCache: vi.fn(), writeVoiceCache: vi.fn() }));

describe("optional cutscene voice", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(readVoiceCache).mockReset().mockResolvedValue(null);
    vi.mocked(writeVoiceCache).mockReset().mockResolvedValue(undefined);
  });
  afterEach(() => vi.useRealTimers());

  it("lets dialogue continue when narration never answers", async () => {
    const request = voiceWithin(new Promise<string | null>(() => {}));
    await vi.advanceTimersByTimeAsync(SCENE_VOICE_WAIT_MS);
    expect(await request).toBeNull();
  });
  it("contains voice failures and clears the deadline when audio arrives", async () => {
    expect(await voiceWithin(Promise.reject(new Error("offline")))).toBeNull();
    expect(await voiceWithin(Promise.resolve("audio"))).toBe("audio");
    expect(vi.getTimerCount()).toBe(0);
  });
  it("shares cache and transport work between playback and lookahead", async () => {
    const loader = vi.fn().mockResolvedValue("audio");
    const a = sceneVoice(loader, "dedupe-test", 0);
    const b = sceneVoice(loader, "dedupe-test", 0);
    expect(a).toBe(b);
    expect(await a).toBe("audio");
    expect(loader).toHaveBeenCalledTimes(1);
    expect(readVoiceCache).toHaveBeenCalledTimes(1);
  });
  it("plays cached audio without a network request", async () => {
    vi.mocked(readVoiceCache).mockResolvedValueOnce("cached-audio");
    const loader = vi.fn();
    expect(await sceneVoice(loader, "cached-test", 1)).toBe("cached-audio");
    expect(loader).not.toHaveBeenCalled();
  });
  it("does not wait for IndexedDB writes before playing audio", async () => {
    vi.mocked(writeVoiceCache).mockImplementationOnce(() => new Promise(() => {}));
    expect(await sceneVoice(vi.fn().mockResolvedValue("ready"), "write-test", 0)).toBe("ready");
  });
  it("expires hung transport requests so a later attempt can recover", async () => {
    const loader = vi
      .fn()
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockResolvedValue("recovered");
    const stalled = sceneVoice(loader, "recovery-test", 0);
    await vi.advanceTimersByTimeAsync(SCENE_VOICE_WAIT_MS);
    expect(await stalled).toBeNull();
    expect(await sceneVoice(loader, "recovery-test", 0)).toBe("recovered");
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
