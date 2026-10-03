/** Event-based commentary with bounded latency and interruptible playback.
 * Cosmetic randomness never touches the simulation's deterministic RNG. */
import {
  lineCount,
  narrationLang,
  narrationLine,
  broadcastRole,
  SPEECH_TAG,
  supportsRemoteNarration,
  type NarrationContext,
  type NarrationEvent,
  type NarrationLang,
} from "./narration-lines";
import { audioBlobUrl, readVoiceCache, writeVoiceCache } from "./audio-cache";
import { NARRATION_VOICE_REVISION } from "./narration-voice";
import { voicesForLanguage } from "./speech-voices";
import { boundedNumber } from "@/lib/accessibility-preferences";
export type { NarrationEvent } from "./narration-lines";
export interface NarratorOptions {
  lang: string;
  enabled: boolean;
  rate?: number;
  realistic?: boolean;
  volume?: number;
  captionOnly?: boolean;
  voiceURI?: string;
  onCaption?: (text: string | null) => void;
}
const pendingAudio = new Map<string, Promise<string | null>>();
const MIN_GAP: Partial<Record<NarrationEvent, number>> = {
  shot: 4500,
  chance: 7000,
  foul: 9000,
  card: 3000,
  redCard: 1000,
  save: 3500,
  corner: 10000,
  sub: 8000,
};
const priority = (event: NarrationEvent) =>
  event === "goal" || event === "redCard" || event === "fulltime";
const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
interface QueueItem {
  event: NarrationEvent;
  text: string;
  lang: NarrationLang;
  speechTag: string;
  variant: number;
  team: string;
  created: number;
  context?: NarrationContext;
}
export class Narrator {
  private lang: NarrationLang;
  private speechTag: string;
  private enabled: boolean;
  private paused = false;
  private rate: number;
  private realistic: boolean;
  private volume: number;
  private captionOnly: boolean;
  private voiceURI: string;
  private lastByEvent = new Map<NarrationEvent, number>();
  private lastVariant = new Map<NarrationEvent, number>();
  private synth: SpeechSynthesis | null;
  private audio: HTMLAudioElement | null = null;
  private utterance: SpeechSynthesisUtterance | null = null;
  private queue: QueueItem[] = [];
  private generation = 0;
  private busyGeneration: number | null = null;
  private cancelPlayback: (() => void) | null = null;
  private disposed = false;
  private remoteFailures = 0;
  private onCaption: NarratorOptions["onCaption"];
  constructor(opts: NarratorOptions) {
    this.lang = narrationLang(opts.lang);
    this.speechTag = opts.lang || SPEECH_TAG[this.lang];
    this.enabled = opts.enabled;
    this.rate = boundedNumber(opts.rate, 1.05, 0.7, 1.5);
    this.realistic = opts.realistic ?? true;
    this.volume = boundedNumber(opts.volume, 0.85, 0, 1);
    this.captionOnly = opts.captionOnly ?? false;
    this.voiceURI = opts.voiceURI ?? "";
    this.onCaption = opts.onCaption;
    this.synth =
      typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;
  }
  setLang(tag: string) {
    if (tag === this.speechTag) return;
    this.stopAll();
    this.lang = narrationLang(tag);
    this.speechTag = tag || SPEECH_TAG[this.lang];
    this.remoteFailures = 0;
    this.lastByEvent.clear();
    this.lastVariant.clear();
  }
  setEnabled(on: boolean) {
    this.enabled = on;
    if (!on) this.stopAll();
  }
  setPaused(paused: boolean) {
    if (this.paused === paused) return;
    this.paused = paused;
    if (paused) this.stopAll();
  }
  setRealistic(on: boolean) {
    this.realistic = on;
  }
  setCaptionOnly(on: boolean) {
    if (this.captionOnly !== on) {
      this.stopAll();
      this.captionOnly = on;
    }
  }
  setVoice(uri: string) {
    if (uri !== this.voiceURI) {
      this.stopAll();
      this.voiceURI = uri;
    }
  }
  setRate(rate: number) {
    this.rate = boundedNumber(rate, 1.05, 0.7, 1.5);
    if (this.audio) this.audio.playbackRate = this.rate;
  }
  setVolume(volume: number) {
    this.volume = boundedNumber(volume, 0.85, 0, 1);
    if (this.audio) this.audio.volume = this.volume;
    if (this.utterance) this.utterance.volume = this.volume;
    if (this.volume === 0) {
      this.synth?.cancel();
      this.audio?.pause();
      this.cancelPlayback?.();
    }
  }
  private valid(token: number) {
    return token === this.generation && this.enabled && !this.paused && !this.disposed;
  }
  private stopAll() {
    this.generation++;
    this.queue = [];
    this.busyGeneration = null;
    this.audio?.pause();
    if (this.utterance) this.synth?.cancel();
    this.cancelPlayback?.();
    this.cancelPlayback = null;
    this.audio = null;
    this.utterance = null;
    this.onCaption?.(null);
  }
  private hold(ms: number, token: number): Promise<void> {
    return new Promise((resolve) => {
      if (!this.valid(token)) return resolve();
      const finish = () => {
        clearTimeout(timer);
        if (this.cancelPlayback === finish) this.cancelPlayback = null;
        resolve();
      };
      const timer = setTimeout(finish, ms);
      this.cancelPlayback = finish;
    });
  }
  private async availableVoices(token: number): Promise<SpeechSynthesisVoice[]> {
    if (!this.synth) return [];
    if (this.synth.getVoices().length) return this.synth.getVoices();
    // System voices may arrive after the first user gesture.
    await new Promise<void>((resolve) => {
      const finish = () => {
        clearTimeout(timer);
        this.synth?.removeEventListener("voiceschanged", changed);
        if (this.cancelPlayback === finish) this.cancelPlayback = null;
        resolve();
      };
      const changed = () => {
        if (this.synth?.getVoices().length) finish();
      };
      const timer = setTimeout(finish, 1000);
      this.cancelPlayback = finish;
      this.synth?.addEventListener("voiceschanged", changed);
    });
    return this.valid(token) ? this.synth.getVoices() : [];
  }
  private async speakLocal(item: QueueItem, token: number): Promise<boolean> {
    if (!this.synth || this.volume === 0) return false;
    const voices = voicesForLanguage(await this.availableVoices(token), item.speechTag);
    const role = broadcastRole(item.event);
    const roleVoice = voices[role === "referee" ? 1 : role === "narrator" ? 2 : 0] ?? voices[0];
    const voice = voices.find((v) => v.voiceURI === this.voiceURI) ?? roleVoice;
    if (!voice || !this.valid(token)) return false;
    await new Promise<void>((resolve) => {
      const utter = new SpeechSynthesisUtterance(item.text);
      utter.lang = item.speechTag;
      utter.voice = voice;
      utter.volume = this.volume;
      const explosive = priority(item.event) || item.event === "post",
        excited = item.event === "save" || item.event === "chance";
      utter.rate = Math.min(1.65, this.rate * (explosive ? 1.06 : excited ? 1.02 : 0.98));
      utter.pitch = explosive ? 1.12 : excited ? 1.05 : 1;
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        utter.onend = null;
        utter.onerror = null;
        if (this.utterance === utter) this.utterance = null;
        if (this.cancelPlayback === finish) this.cancelPlayback = null;
        resolve();
      };
      const timer = setTimeout(() => {
        if (this.valid(token)) this.synth?.cancel();
        finish();
      }, 16000 / this.rate);
      utter.onend = finish;
      utter.onerror = finish;
      this.utterance = utter;
      this.cancelPlayback = finish;
      try {
        this.synth!.speak(utter);
      } catch {
        finish();
      }
    });
    return true;
  }
  private playBase64(mp3: string, token: number): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.valid(token) || this.volume === 0) return resolve(false);
      const url = audioBlobUrl(mp3),
        el = new Audio();
      el.src = url;
      el.preload = "auto";
      el.volume = this.volume;
      el.playbackRate = this.rate;
      this.audio = el;
      let settled = false;
      const finish = (played = false) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        el.onended = null;
        el.onerror = null;
        el.pause();
        URL.revokeObjectURL(url);
        if (this.audio === el) this.audio = null;
        if (this.cancelPlayback === cancel) this.cancelPlayback = null;
        resolve(played);
      };
      const cancel = () => finish(false);
      const timer = setTimeout(cancel, 16000 / this.rate);
      el.onended = () => finish(true);
      el.onerror = cancel;
      this.cancelPlayback = cancel;
      void el.play().catch(cancel);
    });
  }
  private async speakRemote(item: QueueItem, token: number): Promise<boolean> {
    if (!supportsRemoteNarration(item.lang)) return false;
    const key = `${NARRATION_VOICE_REVISION}|${item.lang}|${broadcastRole(item.event)}|${item.event}|${item.variant}|${item.team}|${JSON.stringify(item.context ?? {})}`;
    try {
      const cached = await readVoiceCache(key);
      if (!this.valid(token)) return true;
      if (cached) return await this.playBase64(cached, token);
      let request = pendingAudio.get(key);
      if (!request) {
        const remoteLang = item.lang;
        request = import("@/lib/tts.functions")
          .then(async ({ narrateEvent }) => {
            const result = await narrateEvent({
              data: {
                lang: remoteLang,
                event: item.event,
                team: item.team.slice(0, 28),
                variant: item.variant,
                context: item.context,
              },
            });
            return result.ok ? result.audio : null;
          })
          .catch(() => null);
        pendingAudio.set(key, request);
        const active = request;
        void request
          .then(async (audio) => {
            if (audio) await writeVoiceCache(key, audio);
          })
          .catch(() => undefined)
          .finally(() => {
            if (pendingAudio.get(key) === active) pendingAudio.delete(key);
          });
      }
      const audio = await Promise.race([request, this.hold(1800, token).then(() => null)]);
      // Cancel this generation's latency timer only: an old response must not
      // cancel the audio or caption hold of a newer, decisive event.
      if (!this.valid(token)) return true;
      this.cancelPlayback?.();
      if (!audio) {
        this.remoteFailures++;
        return false;
      }
      this.remoteFailures = 0;
      return await this.playBase64(audio, token);
    } catch {
      if (this.valid(token)) this.remoteFailures++;
      return false;
    }
  }
  private async drain() {
    const token = this.generation;
    if (this.busyGeneration === token || !this.valid(token)) return;
    this.busyGeneration = token;
    try {
      while (this.queue.length && this.valid(token)) {
        const item = this.queue.shift()!;
        if (now() - item.created > (priority(item.event) ? 18000 : 8000)) continue;
        const started = now();
        this.onCaption?.(item.text);
        let spoke = false;
        if (!this.captionOnly && this.volume > 0) {
          if (this.realistic && this.remoteFailures < 2 && supportsRemoteNarration(item.lang))
            spoke = await this.speakRemote(item, token);
          if (!spoke && this.valid(token)) spoke = await this.speakLocal(item, token);
        }
        if (!this.valid(token)) return;
        const readable = spoke ? 1400 : Math.min(8000, Math.max(3500, item.text.length * 48));
        if (now() - started < readable) await this.hold(readable - (now() - started), token);
        if (this.valid(token)) this.onCaption?.(null);
      }
    } finally {
      if (this.busyGeneration === token) this.busyGeneration = null;
    }
  }
  speak(event: NarrationEvent, team: string, context?: NarrationContext) {
    if (!this.valid(this.generation)) return;
    const created = now(),
      gap = MIN_GAP[event];
    if (gap && created - (this.lastByEvent.get(event) ?? -Infinity) < gap) return;
    this.lastByEvent.set(event, created);
    const total = lineCount(this.lang, event),
      previous = this.lastVariant.get(event);
    let variant = Math.floor(Math.random() * total);
    if (total > 1 && variant === previous) variant = (variant + 1) % total;
    this.lastVariant.set(event, variant);
    const item: QueueItem = {
      event,
      lang: this.lang,
      speechTag: this.speechTag,
      variant,
      team,
      created,
      text: narrationLine(this.lang, event, team, variant, context),
      ...(context ? { context } : {}),
    };
    if (priority(event)) this.stopAll();
    if (this.queue.length >= 2) this.queue.shift();
    this.queue.push(item);
    void this.drain();
  }
  dispose() {
    this.disposed = true;
    this.stopAll();
  }
}
