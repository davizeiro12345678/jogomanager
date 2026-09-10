/**
 * Narração da partida via Web Speech API (síntese de voz do navegador).
 * Sem dependências externas; escolhe a voz que combina com o idioma da interface.
 * Pode ser ligada/desligada pelo jogador e respeita o volume.
 */

export type NarrationEvent = "goal" | "save" | "shot" | "foul" | "card" | "kickoff" | "halftime" | "fulltime";

const LINES: Record<string, Record<NarrationEvent, string[]>> = {
  "pt-BR": {
    goal: ["GOOOL! {team} balança a rede!", "É GOOOL do {team}!", "GOOOOL! Que momento para o {team}!"],
    save: ["Que defesa do goleiro do {team}!", "Espalma o goleiro! Grande defesa do {team}!"],
    shot: ["{team} finaliza!", "Chance para o {team}!"],
    foul: ["Falta marcada contra o {team}.", "O árbitro apita falta do {team}."],
    card: ["Cartão para o {team}!", "O árbitro tira o cartão para o {team}."],
    kickoff: ["Começa a partida!", "Bola rolando!"],
    halftime: ["Fim do primeiro tempo.", "Intervalo de jogo."],
    fulltime: ["Fim de jogo!", "Apita o árbitro, final de partida!"],
  },
  en: {
    goal: ["GOAL! {team} find the net!", "It's a goal for {team}!", "GOAL! What a moment for {team}!"],
    save: ["What a save by the {team} keeper!", "Brilliant stop from {team}!"],
    shot: ["{team} take a shot!", "A chance for {team}!"],
    foul: ["Foul given against {team}.", "The referee blows for a foul by {team}."],
    card: ["A card for {team}!", "The referee reaches for the pocket — {team}."],
    kickoff: ["The match is underway!", "Kick-off!"],
    halftime: ["Half-time.", "The whistle goes for the break."],
    fulltime: ["Full-time!", "The referee ends the match!"],
  },
  es: {
    goal: ["¡GOOOL del {team}!", "¡GOL! ¡Marca el {team}!"],
    save: ["¡Qué parada del portero del {team}!", "¡Gran atajada del {team}!"],
    shot: ["¡Dispara el {team}!", "¡Ocación para el {team}!"],
    foul: ["Falta del {team}.", "El árbitro pita falta del {team}."],
    card: ["¡Tarjeta para el {team}!"],
    kickoff: ["¡Arranca el partido!", "¡Rueda el balón!"],
    halftime: ["Final de la primera parte.", "Descanso."],
    fulltime: ["¡Final del partido!"],
  },
};

export interface NarratorOptions {
  lang: string;
  enabled: boolean;
  rate?: number;
  /** Usa voz realista (ElevenLabs) quando disponível; cai para a voz do navegador. */
  realistic?: boolean;
}

/** Cache global de áudios já gerados — cada frase custa uma chamada de API. */
const audioCache = new Map<string, string>();
const MAX_CACHE = 60;

export class Narrator {
  private lang: string;
  private enabled: boolean;
  private rate: number;
  private realistic: boolean;
  private lastSpeak = 0;
  private synth: SpeechSynthesis | null;
  private audio: HTMLAudioElement | null = null;
  /** Desliga a voz realista após uma falha para não insistir em erro. */
  private remoteBroken = false;

  constructor(opts: NarratorOptions) {
    this.lang = opts.lang;
    this.enabled = opts.enabled;
    this.rate = opts.rate ?? 1.05;
    this.realistic = opts.realistic ?? true;
    this.synth = typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;
  }

  setLang(lang: string) {
    this.lang = lang;
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (!on) this.stop();
  }

  setRealistic(on: boolean) {
    this.realistic = on;
  }

  private stop() {
    this.synth?.cancel();
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }
  }

  /** Seleciona voz cujo idioma bate com o da interface. */
  private voice(): SpeechSynthesisVoice | null {
    if (!this.synth) return null;
    const voices = this.synth.getVoices();
    if (!voices.length) return null;
    const tag = this.lang.toLowerCase();
    const base = tag.split("-")[0] ?? tag;
    return (
      voices.find((v) => v.lang.toLowerCase() === tag) ??
      voices.find((v) => v.lang.toLowerCase().startsWith(base)) ??
      null
    );
  }

  private speakLocal(text: string, event: NarrationEvent) {
    if (!this.synth) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = this.lang;
    utter.rate = event === "goal" ? this.rate * 1.05 : this.rate;
    utter.pitch = event === "goal" ? 1.15 : 1;
    const v = this.voice();
    if (v) utter.voice = v;
    if (event === "goal") this.synth.cancel();
    this.synth.speak(utter);
  }

  private playBase64(mp3: string, event: NarrationEvent) {
    if (!this.enabled) return;
    if (event === "goal") this.stop();
    const el = new Audio(`data:audio/mpeg;base64,${mp3}`);
    el.volume = 1;
    this.audio = el;
    void el.play().catch(() => {
      // Autoplay bloqueado: volta para a voz do navegador.
      this.speakLocal("", event);
    });
  }

  private async speakRemote(text: string, event: NarrationEvent) {
    const key = `${this.lang}|${text}`;
    const cached = audioCache.get(key);
    if (cached) {
      this.playBase64(cached, event);
      return;
    }
    try {
      const { narrateLine } = await import("@/lib/tts.functions");
      const res = await narrateLine({ data: { text } });
      if (!res.ok) {
        this.remoteBroken = true;
        this.speakLocal(text, event);
        return;
      }
      if (audioCache.size >= MAX_CACHE) {
        const first = audioCache.keys().next().value;
        if (first) audioCache.delete(first);
      }
      audioCache.set(key, res.audio);
      this.playBase64(res.audio, event);
    } catch {
      this.remoteBroken = true;
      this.speakLocal(text, event);
    }
  }

  speak(event: NarrationEvent, team: string) {
    if (!this.enabled) return;
    const now = performance.now();
    // Intervalo mínimo para não sobrepor falas em lances rápidos.
    if (event !== "goal" && now - this.lastSpeak < 5000) return;
    this.lastSpeak = now;

    const base = this.lang.split("-")[0] ?? this.lang;
    const pack = (LINES[this.lang] ?? LINES[base] ?? LINES["en"])!;
    if (!pack) return;
    const pool = pack[event];
    if (!pool?.length) return;
    const text = (pool[Math.floor(Math.random() * pool.length)] ?? "").replace("{team}", team);
    if (!text) return;

    if (this.realistic && !this.remoteBroken) {
      void this.speakRemote(text, event);
      return;
    }
    this.speakLocal(text, event);
  }

  dispose() {
    this.stop();
  }
}

