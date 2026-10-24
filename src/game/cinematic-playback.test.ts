import { describe, expect, it, vi } from "vitest";
import { playCinematicVoice } from "./cinematic-playback";

describe("cinematic voice ownership around browser play promises", () => {
  it("silences playback that completes after the viewer pauses or hides the tab", async () => {
    let visibleAndRunning = true;
    let finish!: () => void;
    const audio = {
      ended: false,
      pause: vi.fn(),
      play: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      ),
    };
    const pending = playCinematicVoice(audio, () => visibleAndRunning);
    visibleAndRunning = false;
    finish();
    expect(await pending).toBe(false);
    expect(audio.pause).toHaveBeenCalledOnce();
  });

  it("rejects an obsolete line even if its delayed playback resolves successfully", async () => {
    let currentLine = "first";
    let finish!: () => void;
    const audio = {
      ended: false,
      pause: vi.fn(),
      play: () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    };
    const pending = playCinematicVoice(audio, () => currentLine === "first");
    currentLine = "second";
    finish();
    expect(await pending).toBe(false);
    expect(audio.pause).toHaveBeenCalledOnce();
  });

  it("does not replay an ended clip or start an already paused line, while allowing its active owner", async () => {
    const audio = { ended: true, pause: vi.fn(), play: vi.fn(async () => undefined) };
    expect(await playCinematicVoice(audio, () => true)).toBe(false);
    audio.ended = false;
    expect(await playCinematicVoice(audio, () => false)).toBe(false);
    expect(audio.play).not.toHaveBeenCalled();
    expect(await playCinematicVoice(audio, () => true)).toBe(true);
    expect(audio.play).toHaveBeenCalledOnce();
    expect(audio.pause).not.toHaveBeenCalled();
  });
});
