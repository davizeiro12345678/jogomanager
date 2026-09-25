import { describe, expect, it } from "vitest";

import {
  advanceTarget,
  buildCutsceneTimeline,
  estimateLineDuration,
  lineAt,
  sampleCutsceneTimeline,
  SHOTS,
  smoothstep,
  type CutsceneTimeline,
} from "./cutscene-timeline";
import { CUTSCENES, type Cutscene } from "@/content/cutscenes";

const scene = (id: string): Cutscene => {
  const found = CUTSCENES[id];
  if (!found) throw new Error(`cena ${id} não existe`);
  return found;
};

/** Cena curta de mentira, para as contas fecharem exato. */
const stub: Cutscene = {
  id: "stub",
  title: "Stub",
  art: "arrival",
  mood: "neutral",
  lines: [
    { who: "manager", text: "Oi." },
    { who: "narrator", text: "E então tudo mudou." },
  ],
};

describe("cutscene timeline", () => {
  it("lays the lines end to end without gaps or overlaps", () => {
    const timeline = buildCutsceneTimeline(scene("arrival"));
    expect(timeline.lines.length).toBeGreaterThan(0);
    for (let i = 1; i < timeline.lines.length; i += 1) {
      expect(timeline.lines[i]!.at).toBeCloseTo(
        timeline.lines[i - 1]!.at + timeline.lines[i - 1]!.duration,
        6,
      );
    }
    expect(timeline.duration).toBeCloseTo(
      timeline.lines.reduce((sum, line) => sum + line.duration, 0),
      6,
    );
  });

  it("keeps every line inside a readable window", () => {
    for (const id of Object.keys(CUTSCENES)) {
      const timeline = buildCutsceneTimeline(scene(id));
      for (const line of timeline.lines) {
        expect(line.duration).toBeGreaterThan(1.2);
        expect(line.duration).toBeLessThan(12);
        expect(line.text.length).toBeGreaterThan(0);
      }
      // uma cena não pode virar um filme de uma hora
      expect(timeline.duration).toBeLessThan(400);
    }
  });

  it("is deterministic: the same script always makes the same film", () => {
    const a = buildCutsceneTimeline(scene("anthem"));
    const b = buildCutsceneTimeline(scene("anthem"));
    expect(a).toEqual(b);
  });

  it("uses the voice duration when it exists and falls back otherwise", () => {
    const estimated = buildCutsceneTimeline(stub);
    expect(estimated.lines.every((line) => !line.voiced)).toBe(true);
    const voiced = buildCutsceneTimeline(stub, [3.5, undefined]);
    expect(voiced.lines[0]!.voiced).toBe(true);
    expect(voiced.lines[1]!.voiced).toBe(false);
    // a voz real estica a fala além da estimativa de leitura
    expect(voiced.lines[0]!.duration).toBeGreaterThan(3);
    expect(voiced.lines[0]!.duration).toBeLessThan(estimated.lines[0]!.duration + 4);
  });

  it("walks the scene forward one line at a time", () => {
    const timeline = buildCutsceneTimeline(stub);
    expect(sampleCutsceneTimeline(timeline, 0).lineIndex).toBe(0);
    expect(sampleCutsceneTimeline(timeline, timeline.lines[1]!.at + 0.01).lineIndex).toBe(1);
    // antes do fim ainda não está terminado
    expect(sampleCutsceneTimeline(timeline, timeline.duration - 0.01).finished).toBe(false);
    expect(sampleCutsceneTimeline(timeline, timeline.duration).finished).toBe(true);
    // e nunca volta atrás
    let last = -1;
    for (let t = 0; t <= timeline.duration + 1; t += 0.05) {
      const index = sampleCutsceneTimeline(timeline, t).lineIndex;
      expect(index).toBeGreaterThanOrEqual(last);
      last = index;
    }
  });

  it("types the text gradually and finishes before the line ends", () => {
    const timeline = buildCutsceneTimeline(stub);
    const line = timeline.lines[0]!;
    const start = sampleCutsceneTimeline(timeline, line.at);
    expect(start.typed).toBe(0);
    const middle = sampleCutsceneTimeline(timeline, line.at + line.duration * 0.4);
    expect(middle.typed).toBeGreaterThan(0);
    expect(middle.typed).toBeLessThan(line.text.length);
    const end = sampleCutsceneTimeline(timeline, line.at + line.duration * 0.9);
    expect(end.typed).toBe(line.text.length);
  });

  it("eases the camera instead of jumping", () => {
    const timeline = buildCutsceneTimeline(stub);
    const line = timeline.lines[0]!;
    const dolly = (u: number) =>
      sampleCutsceneTimeline(timeline, line.at + line.duration * u).dolly;
    expect(dolly(0)).toBe(0);
    // quase no fim da fala (o fim exato já é o corte para a fala seguinte)
    expect(dolly(0.999)).toBeCloseTo(1, 3);
    expect(dolly(0.5)).toBeCloseTo(0.5, 5);
    // velocidade zero nas pontas: o primeiro passo é menor que o do meio
    expect(dolly(0.1)).toBeLessThan(0.1);
    expect(dolly(0.9)).toBeGreaterThan(0.9);
    expect(smoothstep(-5)).toBe(0);
    expect(smoothstep(5)).toBe(1);
  });

  it("completes the typing on the first skip and moves on with the second", () => {
    const timeline = buildCutsceneTimeline(stub);
    const first = timeline.lines[0]!;
    // no meio da digitação: o toque só completa o texto
    const midTyping = advanceTarget(timeline, first.at + first.duration * 0.2, 1);
    expect(midTyping).toBeCloseTo(first.at + first.duration * first.typedUntil, 6);
    // com o texto pronto: pula para a próxima fala
    const ready = advanceTarget(timeline, first.at + first.duration * 0.5, first.text.length);
    expect(ready).toBeCloseTo(timeline.lines[1]!.at, 6);
    // na última fala: pula para o fim
    const last = timeline.lines[timeline.lines.length - 1]!;
    expect(advanceTarget(timeline, last.at + 0.1, last.text.length)).toBeCloseTo(
      timeline.duration,
      6,
    );
  });

  it("alternates framing across the scene", () => {
    const timeline = buildCutsceneTimeline(scene("promotion"));
    const used = new Set(timeline.lines.map((line) => line.shot));
    expect(used.size).toBeGreaterThan(1);
    for (const line of timeline.lines) {
      expect(SHOTS).toContain(line.shot);
    }
  });

  it("clamps negative and past-the-end time", () => {
    const timeline = buildCutsceneTimeline(stub);
    expect(sampleCutsceneTimeline(timeline, -10).lineIndex).toBe(0);
    expect(sampleCutsceneTimeline(timeline, 9999).lineIndex).toBe(timeline.lines.length - 1);
    expect(sampleCutsceneTimeline(timeline, 9999).finished).toBe(true);
    expect(lineAt(timeline, -1).index).toBe(0);
  });

  it("prices longer text as a longer line", () => {
    const short = estimateLineDuration({ who: "manager", text: "Certo." });
    const long = estimateLineDuration({ who: "manager", text: "Certo. ".repeat(40) });
    expect(long).toBeGreaterThan(short);
  });
});
