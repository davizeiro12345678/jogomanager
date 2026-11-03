import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { recordCanvas, replayVideoFile, shareReplayVideo } from "./replay-video";

class Recorder {
  static instances: Recorder[] = [];
  static formats = ["video/webm;codecs=vp9"];
  static isTypeSupported(type: string) {
    return this.formats.includes(type);
  }
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  state = "inactive";
  mimeType: string;
  constructor(_stream: unknown, options?: MediaRecorderOptions) {
    this.mimeType = options?.mimeType ?? "video/webm";
    Recorder.instances.push(this);
  }
  start() {
    this.state = "recording";
  }
  stop = vi.fn(() => {
    this.state = "inactive";
    queueMicrotask(() => {
      this.ondataavailable?.({ data: new Blob(["video"]) });
      this.onstop?.();
    });
  });
}
function canvas() {
  const track = { stop: vi.fn() };
  const captureStream = vi.fn(() => ({ getTracks: () => [track] }));
  return { canvas: { captureStream } as unknown as HTMLCanvasElement, track };
}
beforeEach(() => {
  Recorder.instances = [];
  Recorder.formats = ["video/webm;codecs=vp9"];
  vi.stubGlobal("MediaRecorder", Recorder);
});
afterEach(() => vi.unstubAllGlobals());

describe("replay recording ownership", () => {
  it("finalizes once and releases the stream; repeated stop reuses its result", async () => {
    const fixture = canvas();
    const recording = recordCanvas(fixture.canvas);
    const pending = recording.stop();
    expect(recording.stop()).toBe(pending);
    const blob = await pending;
    expect(await blob.text()).toBe("video");
    expect(blob.type).toBe("video/webm;codecs=vp9");
    expect(fixture.track.stop).toHaveBeenCalled();
    expect(Recorder.instances[0]!.stop).toHaveBeenCalledOnce();
  });
  it("releases abandoned captures and discards their data", async () => {
    const fixture = canvas();
    const recording = recordCanvas(fixture.canvas);
    recording.cancel();
    await expect(recording.stop()).rejects.toMatchObject({ name: "AbortError" });
    expect(fixture.track.stop).toHaveBeenCalled();
  });
  it("reports encoder errors without leaking capture tracks", async () => {
    const fixture = canvas();
    const recording = recordCanvas(fixture.canvas);
    Recorder.instances[0]!.onerror?.(new Event("error"));
    await expect(recording.stop()).rejects.toThrow("recording_failed");
    expect(fixture.track.stop).toHaveBeenCalled();
  });
  it("uses supported MP4 and names the actual file format", async () => {
    Recorder.formats = ["video/mp4"];
    const recording = recordCanvas(canvas().canvas);
    const file = replayVideoFile(await recording.stop(), "Final: São Paulo / Santos");
    expect(file.name).toBe("final-sao-paulo-santos.mp4");
    expect(file.type).toBe("video/mp4");
  });
  it("releases tracks if encoder construction fails", () => {
    const fixture = canvas();
    vi.stubGlobal(
      "MediaRecorder",
      class {
        static isTypeSupported() {
          return true;
        }
        constructor() {
          throw new Error("not_supported");
        }
      },
    );
    expect(() => recordCanvas(fixture.canvas)).toThrow("not_supported");
    expect(fixture.track.stop).toHaveBeenCalledOnce();
  });
});

describe("native replay sharing", () => {
  const file = () => new File(["video"], "replay.webm", { type: "video/webm" });
  it("passes only the chosen video to the native picker", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const video = file();
    expect(await shareReplayVideo(video, { canShare: () => true, share })).toBe("shared");
    expect(share).toHaveBeenCalledWith({ files: [video], title: "Replay do JogoManager" });
  });
  it("leaves unsupported formats available for download", async () => {
    const share = vi.fn();
    expect(await shareReplayVideo(file(), { canShare: () => false, share })).toBe("unsupported");
    expect(share).not.toHaveBeenCalled();
  });
  it("treats picker cancellation as a normal outcome", async () => {
    const share = vi.fn().mockRejectedValue(new DOMException("Cancelled", "AbortError"));
    expect(await shareReplayVideo(file(), { canShare: () => true, share })).toBe("cancelled");
  });
  it("handles a denied sharing policy without losing the video", async () => {
    const share = vi.fn().mockRejectedValue(new DOMException("Policy", "NotAllowedError"));
    expect(await shareReplayVideo(file(), { canShare: () => true, share })).toBe("unavailable");
  });
});
