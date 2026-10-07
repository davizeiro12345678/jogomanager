import type { SceneArt } from "@/content/cutscenes";
import { reportSilent } from "@/lib/silent-errors";

/** Optional local ambience, started only by the user's sound button.
 * One short noise buffer, two oscillators, no downloads or career side effects. */
export class CinematicSound {
  private readonly context: AudioContext;
  private readonly volume: GainNode;
  private readonly sources: (AudioBufferSourceNode | OscillatorNode)[] = [];
  private disposed = false;
  static create(art: SceneArt): CinematicSound | null {
    if (typeof window === "undefined" || !window.AudioContext) return null;
    try {
      return new CinematicSound(art);
    } catch (error) {
      reportSilent("cutscene.audio", error, {
        classification: "degradation",
        feature: "ambience",
        phase: "create",
        dedupeKey: "ambience-create",
      });
      return null;
    }
  }
  private constructor(art: SceneArt) {
    this.context = new AudioContext();
    this.volume = this.context.createGain();
    this.volume.gain.value = 0.13;
    this.volume.connect(this.context.destination);
    const outdoor = [
      "trophy",
      "celebration",
      "pitchentry",
      "arrival",
      "bus",
      "training",
      "tunnel",
    ].includes(art);
    const buffer = this.context.createBuffer(
      1,
      this.context.sampleRate * 2,
      this.context.sampleRate,
    );
    const samples = buffer.getChannelData(0);
    let state = 163;
    for (let i = 0; i < samples.length; i++) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      samples[i] = ((state / 4294967296) * 2 - 1) * 0.3;
    }
    const noise = this.context.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const filter = this.context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = outdoor ? 750 : 180;
    noise.connect(filter);
    filter.connect(this.volume);
    noise.start();
    this.sources.push(noise);
    if (outdoor) {
      const swell = this.context.createOscillator();
      const amount = this.context.createGain();
      swell.frequency.value = art === "trophy" || art === "celebration" ? 0.23 : 0.1;
      amount.gain.value = 0.03;
      swell.connect(amount);
      amount.connect(this.volume.gain);
      swell.start();
      this.sources.push(swell);
    }
    void this.context.resume().catch((error) => {
      reportSilent("cutscene.audio", error, {
        classification: "ignorable",
        feature: "ambience",
        phase: "resume",
        dedupeKey: "ambience-resume",
      });
    });
  }
  setPaused(paused: boolean) {
    if (this.disposed) return;
    if (paused)
      void this.context.suspend().catch((error) => {
        reportSilent("cutscene.audio", error, {
          classification: "ignorable",
          feature: "ambience",
          phase: "suspend",
          dedupeKey: "ambience-suspend",
        });
      });
    else
      void this.context.resume().catch((error) => {
        reportSilent("cutscene.audio", error, {
          classification: "ignorable",
          feature: "ambience",
          phase: "resume",
          dedupeKey: "ambience-resume",
        });
      });
  }
  accent(tension: number, festive: boolean) {
    if (this.disposed) return;
    const now = this.context.currentTime;
    this.volume.gain.cancelScheduledValues(now);
    this.volume.gain.setTargetAtTime(festive ? 0.19 : 0.1 + Math.min(1, tension) * 0.035, now, 0.6);
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.sources.forEach((source) => source.stop());
    this.volume.disconnect();
    void this.context.close().catch((error) => {
      reportSilent("cutscene.audio", error, {
        classification: "ignorable",
        feature: "ambience",
        phase: "close",
        dedupeKey: "ambience-close",
      });
    });
  }
}
