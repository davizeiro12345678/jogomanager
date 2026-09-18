/**
 * Narração da partida.
 *
 * Prioriza voz realista (ElevenLabs, gerada no servidor) e cai para a voz do
 * navegador (Web Speech API) quando o áudio remoto não está disponível.
 * As falas entram numa fila para nunca se sobreporem — exceto gol, que
 * interrompe tudo porque é o lance mais importante.
 */

import {
  lineCount,
  narrationLang,
  narrationLine,
  SPEECH_TAG,
  type NarrationEvent,
  type NarrationLang,
} from "./narration-lines";

export type { NarrationEvent } from "./narration-lines";

export interface NarratorOptions {
  /** Tag de idioma da interface (ex.: "pt-BR"). */
  lang: string;
  enabled: boolean;
  rate?: number;
  /** Usa voz realista quando disponível. */
  realistic?: boolean;
  volume?: number;
}

/** Cache global de áudios já gerados — cada frase custa uma chamada de API. */
const audioCache = new Map<string, string>();
const MAX_CACHE = 80;

/** Espaçamento mínimo entre falas do mesmo tipo (ms). */
const MIN_GAP: Partial<Record<NarrationEvent, number>> = {
  shot: 7000,
  chance: 9000,
  foul: 12000,
  card: 6000,
  save: 5000,
  corner: 14000,
  sub: 10000,
};

interface QueueItem {
  event: NarrationEvent;
  text: string;
  lang: NarrationLang;
  variant: number;
  team: string;
}

export class Narrator {
  private lang: NarrationLang;
  private enabled: boolean;
  private rate: number;
  private realistic: boolean;
  private volume: number;
  private lastByEvent = new Map<NarrationEvent, number>();
  private synth: SpeechSynthesis | null;
  private audio: HTMLAudioElement | null = null;
  private queue: QueueItem[] = [];
  private busy = false;
  private disposed = false;
  /** Desliga a voz realista após uma falha para não insistir em erro. */
  private remoteBroken = false;

  constructor(opts: NarratorOptions) {
    this.lang = narrationLang(opts.lang);
    this.enabled = opts.enabled;
    this.rate = opts.rate ?? 1.05;
    this.realistic = opts.realistic ?? true;
    this.volume = opts.volume ?? 1;
    this.synth =
      typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;
  }

  setLang(lang: string) {
    this.lang = narrationLang(lang);
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (!on) this.stopAll();
  }

  setRealistic(on: boolean) {
    this.realistic = on;
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.audio) this.audio.volume = this.volume;
  }

  private stopAll() {
    this.queue = [];
    this.busy = false;
    this.synth?.cancel();
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }
  }

  /** Seleciona voz do navegador cujo idioma bate com o da narração. */
  private voice(): SpeechSynthesisVoice | null {
    if (!this.synth) return null;
    const voices = this.synth.getVoices();
    if (!voices.length) return null;
    const tag = SPEECH_TAG[this.lang].toLowerCase();
    const base = tag.split("-")[0]!;
    return (
      voices.find((v) => v.lang.toLowerCase().replace("_", "-") === tag) ??
      voices.find((v) => v.lang.toLowerCase().startsWith(base)) ??
      null
    );
  }

  private speakLocal(item: QueueItem): Promise<void> {
    return new Promise((resolve) => {
      if (!this.synth || this.volume === 0) {
        resolve();
        return;
      }
      const utter = new SpeechSynthesisUtterance(item.text);
      utter.lang = SPEECH_TAG[item.lang];
      utter.volume = this.volume;
      utter.rate = item.event === "goal" ? this.rate * 1.08 : this.rate;
      utter.pitch = item.event === "goal" ? 1.2 : 1;
      const v = this.voice();
      if (v) utter.voice = v;
      utter.onend = () => resolve();
      utter.onerror = () => resolve();
      this.synth.speak(utter);
      // Segurança: se o evento não disparar, libera a fila mesmo assim.
      window.setTimeout(resolve, 9000);
    });
  }

  private playBase64(mp3: string): Promise<void> {
    return new Promise((resolve) => {
      const el = new Audio(`data:audio/mpeg;base64,${mp3}`);
      el.volume = this.volume;
      this.audio = el;
      el.onended = () => resolve();
      el.onerror = () => resolve();
      void el.play().catch(() => resolve());
      window.setTimeout(resolve, 12000);
    });
  }

  private async speakRemote(item: QueueItem): Promise<boolean> {
    const key = `${item.lang}|${item.event}|${item.variant}|${item.team}`;
    const cached = audioCache.get(key);
    if (cached) {
      await this.playBase64(cached);
      return true;
    }
    try {
      const { narrateEvent } = await import("@/lib/tts.functions");
      const res = await narrateEvent({
        data: { lang: item.lang, event: item.event, team: item.team, variant: item.variant },
      });
      if (!res.ok) {
        this.remoteBroken = true;
        return false;
      }
      if (audioCache.size >= MAX_CACHE) {
        const first = audioCache.keys().next().value;
        if (first) audioCache.delete(first);
      }
      audioCache.set(key, res.audio);
      if (!this.enabled || this.disposed) return true;
      await this.playBase64(res.audio);
      return true;
    } catch {
      this.remoteBroken = true;
      return false;
    }
  }

  private async drain() {
    if (this.busy) return;
    this.busy = true;
    try {
      while (this.queue.length && this.enabled && !this.disposed) {
        const item = this.queue.shift()!;
        let spoke = false;
        if (this.realistic && !this.remoteBroken) spoke = await this.speakRemote(item);
        if (!spoke && this.enabled && !this.disposed) await this.speakLocal(item);
      }
    } finally {
      this.busy = false;
    }
  }

  /** Enfileira uma fala para o evento; `goal` tem prioridade máxima. */
  speak(event: NarrationEvent, team: string) {
    if (!this.enabled || this.disposed) return;

    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const gap = MIN_GAP[event];
    if (gap) {
      const last = this.lastByEvent.get(event) ?? -Infinity;
      if (now - last < gap) return;
    }
    this.lastByEvent.set(event, now);

    // nunca repete a frase anterior do mesmo lance: com muitas variações, ouvir
    // a mesma fala duas vezes seguidas é o que mais quebra a imersão
    const total = lineCount(this.lang, event);
    const prev = this.lastVariant.get(event);
    let variant = Math.floor(Math.random() * total);
    if (total > 1 && variant === prev) variant = (variant + 1) % total;
    this.lastVariant.set(event, variant);
    const item: QueueItem = {
      event,
      lang: this.lang,
      variant,
      team,
      text: narrationLine(this.lang, event, team, variant),
    };

    if (event === "goal" || event === "fulltime") {
      // Lance decisivo: corta o que estiver tocando e fala agora.
      this.queue = [];
      this.synth?.cancel();
      if (this.audio) {
        this.audio.pause();
        this.audio = null;
      }
      this.queue.push(item);
    } else {
      if (this.queue.length >= 3) return;
      this.queue.push(item);
    }
    void this.drain();
  }

  /** Texto da última fala útil para legenda (opcional). */
  dispose() {
    this.disposed = true;
    this.stopAll();
  }
}
