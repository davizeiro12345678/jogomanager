import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Narrator } from "./narrator";
import { voicesForLanguage } from "./speech-voices";
const mocks = vi.hoisted(() => ({ remote: vi.fn(), read: vi.fn(), write: vi.fn() }));
vi.mock("@/lib/tts.functions", () => ({ narrateEvent: mocks.remote }));
vi.mock("./audio-cache", () => ({
  readVoiceCache: mocks.read,
  writeVoiceCache: mocks.write,
  audioBlobUrl: () => "blob:voice-test",
}));
const voice = (lang: string, id = lang) =>
  ({ lang, name: id, voiceURI: id, default: false, localService: true }) as SpeechSynthesisVoice;
class Utterance {
  constructor(public text: string) {}
  lang = "";
  voice: SpeechSynthesisVoice | null = null;
  volume = 1;
  rate = 1;
  pitch = 1;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
}
const audioInstances: FakeAudio[] = [];
class FakeAudio {
  src = "";
  preload = "";
  volume = 1;
  playbackRate = 1;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  play = vi.fn(async () => undefined);
  pause = vi.fn();
  constructor() {
    audioInstances.push(this);
  }
}
let installed: SpeechSynthesisVoice[];
let synth: {
  getVoices: () => SpeechSynthesisVoice[];
  speak: ReturnType<typeof vi.fn>;
  cancel: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
};
const active: Narrator[] = [];
function narrator(extra: Partial<ConstructorParameters<typeof Narrator>[0]> = {}) {
  const caption = vi.fn();
  const n = new Narrator({
    lang: "pt-BR",
    enabled: true,
    realistic: false,
    onCaption: caption,
    ...extra,
  });
  active.push(n);
  return { n, caption };
}
beforeEach(() => {
  vi.useFakeTimers();
  installed = [voice("pt-BR"), voice("en-GB"), voice("fr-FR")];
  synth = {
    getVoices: () => installed,
    speak: vi.fn(),
    cancel: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal("window", { speechSynthesis: synth });
  vi.stubGlobal("SpeechSynthesisUtterance", Utterance);
  vi.stubGlobal("Audio", FakeAudio);
  mocks.read.mockReset().mockResolvedValue(null);
  mocks.write.mockReset().mockResolvedValue(undefined);
  mocks.remote.mockReset().mockResolvedValue({ ok: false, reason: "unavailable" });
  audioInstances.length = 0;
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
});
afterEach(() => {
  active.splice(0).forEach((n) => n.dispose());
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe("live commentary lifecycle", () => {
  it("interrupts a routine utterance immediately for a goal and ignores its stale onend", async () => {
    const { n, caption } = narrator();
    n.speak("shot", "Aurora");
    await vi.advanceTimersByTimeAsync(1);
    const old = synth.speak.mock.calls[0]![0] as Utterance,
      end = old.onend;
    n.speak("goal", "Estrela");
    await vi.advanceTimersByTimeAsync(1);
    expect(synth.speak).toHaveBeenCalledTimes(2);
    expect(synth.cancel).toHaveBeenCalled();
    expect((synth.speak.mock.calls[1]![0] as Utterance).text).toContain("Estrela");
    end?.();
    await vi.advanceTimersByTimeAsync(1);
    expect(caption.mock.calls.at(-1)?.[0]).toContain("Estrela");
  });
  it("never plays a late remote response over a newer goal", async () => {
    let finish!: (value: { ok: true; audio: string }) => void;
    mocks.remote.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    mocks.read.mockImplementation(async (key: string) =>
      key.includes("|goal|") ? "goal-audio" : null,
    );
    const { n, caption } = narrator({ realistic: true });
    n.speak("shot", "Old");
    await vi.advanceTimersByTimeAsync(5);
    n.speak("goal", "New");
    await vi.advanceTimersByTimeAsync(5);
    expect(audioInstances).toHaveLength(1);
    expect(audioInstances[0]!.play).toHaveBeenCalledOnce();
    finish({ ok: true, audio: "late-audio" });
    await vi.advanceTimersByTimeAsync(5);
    expect(audioInstances).toHaveLength(1);
    expect(audioInstances[0]!.pause).not.toHaveBeenCalled();
    expect(caption.mock.calls.at(-1)?.[0]).toContain("New");
  });
  it("cancels on pause, disable, language change and disposal without replaying queued commentary", async () => {
    const { n, caption } = narrator();
    n.speak("shot", "A");
    n.speak("corner", "B");
    await vi.advanceTimersByTimeAsync(1);
    n.setPaused(true);
    n.speak("goal", "paused");
    await vi.advanceTimersByTimeAsync(20000);
    expect(synth.speak).toHaveBeenCalledTimes(1);
    expect(caption.mock.calls.at(-1)?.[0]).toBeNull();
    n.setPaused(false);
    n.setLang("fr");
    n.speak("goal", "C");
    await vi.advanceTimersByTimeAsync(1);
    expect((synth.speak.mock.calls[1]![0] as Utterance).lang).toBe("fr");
    n.setEnabled(false);
    n.speak("goal", "disabled");
    n.dispose();
    await vi.advanceTimersByTimeAsync(20000);
    expect(synth.speak).toHaveBeenCalledTimes(2);
  });
  it("keeps readable translated captions when the chosen language has no voice", async () => {
    const { n, caption } = narrator({ lang: "ur", realistic: true });
    n.speak("goal", "Aurora");
    await vi.advanceTimersByTimeAsync(100);
    expect(synth.speak).not.toHaveBeenCalled();
    expect(mocks.remote).not.toHaveBeenCalled();
    expect(caption.mock.calls.at(-1)?.[0]).toContain("گول");
    await vi.advanceTimersByTimeAsync(2000);
    expect(caption.mock.calls.at(-1)?.[0]).toContain("Aurora");
  });
  it("deduplicates routine events, avoids the previous variant and honours captions-only mode", async () => {
    const { n, caption } = narrator({ captionOnly: true });
    n.speak("save", "A");
    n.speak("save", "A");
    await vi.advanceTimersByTimeAsync(100);
    expect(caption.mock.calls.filter(([text]) => text !== null)).toHaveLength(1);
    expect(synth.speak).not.toHaveBeenCalled();
    expect(mocks.remote).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(9000);
    n.speak("save", "A");
    const lines = caption.mock.calls.filter(([text]) => text !== null).map(([text]) => text);
    expect(lines).toHaveLength(2);
    expect(lines[0]).not.toBe(lines[1]);
  });
  it("waits for asynchronously installed voices and applies volume, rate and voice selection", async () => {
    installed = [];
    const { n } = narrator({ voiceURI: "custom", volume: 0.4, rate: 1.2 });
    n.speak("kickoff", "A");
    await vi.advanceTimersByTimeAsync(1);
    expect(synth.speak).not.toHaveBeenCalled();
    installed = [voice("pt-BR", "custom")];
    const changed = synth.addEventListener.mock.calls.find(
      ([type]) => type === "voiceschanged",
    )![1] as () => void;
    changed();
    await vi.advanceTimersByTimeAsync(1);
    const utter = synth.speak.mock.calls[0]![0] as Utterance;
    expect(utter.voice?.voiceURI).toBe("custom");
    expect(utter.volume).toBe(0.4);
    expect(utter.rate).toBeCloseTo(1.176);
    expect(synth.removeEventListener).toHaveBeenCalled();
  });
});
describe("speech language matching", () => {
  it("keeps Chinese scripts separate and avoids prefix collisions", () => {
    const voices = [voice("zh-TW"), voice("zh-CN"), voice("nso-ZA"), voice("no-NO")];
    expect(voicesForLanguage(voices, "zh-Hant").map((v) => v.lang)).toEqual(["zh-TW"]);
    expect(voicesForLanguage(voices, "no").map((v) => v.lang)).toEqual(["no-NO"]);
  });
});
