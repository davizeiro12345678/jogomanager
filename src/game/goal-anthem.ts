/**
 * Hino do clube em gol importante: fanfarra curta sintetizada (sem arquivo de
 * áudio), com melodia determinística por clube. Toca no máximo uma vez a cada
 * 12 s para não sobrepor gols seguidos.
 */
let ctx: AudioContext | null = null;
let lastAt = 0;

const SCALE = [0, 2, 4, 5, 7, 9, 11, 12];

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function playGoalAnthem(clubId: string, volume = 0.16) {
  if (typeof window === "undefined" || document.hidden) return;
  const now = performance.now();
  if (now - lastAt < 12_000) return;
  lastAt = now;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    const ac = ctx;
    const master = ac.createGain();
    master.gain.value = volume;
    master.connect(ac.destination);
    let h = hash(clubId);
    const root = 220 * 2 ** ((h % 5) / 12);
    const t0 = ac.currentTime + 0.05;
    // 8 notas solenes + acorde final
    const notes: number[] = [0, 4, 7];
    for (let i = 0; i < 5; i++) {
      h = Math.imul(h, 1103515245) + 12345;
      notes.push(SCALE[(h >>> 16) % SCALE.length]!);
    }
    notes.push(12);
    notes.forEach((step, i) => {
      const start = t0 + i * 0.32;
      const len = i === notes.length - 1 ? 1.6 : 0.3;
      for (const [mult, type, gain] of [
        [1, "sawtooth", 0.5],
        [2, "triangle", 0.25],
      ] as const) {
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.type = type;
        o.frequency.value = root * 2 ** (step / 12) * mult;
        g.gain.setValueAtTime(0, start);
        g.gain.linearRampToValueAtTime(gain, start + 0.03);
        g.gain.exponentialRampToValueAtTime(0.001, start + len);
        o.connect(g).connect(master);
        o.start(start);
        o.stop(start + len + 0.05);
      }
    });
  } catch {
    // Áudio indisponível: o gol segue normalmente.
  }
}
