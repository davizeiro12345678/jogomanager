import { readFileSync } from "node:fs";
import { halfTimePlan } from "../../src/game/ai-halftime.ts";
const NOTE = [
  "aperta a marcação para recuperar a bola",
  "recua e fecha o meio",
  "abre a linha para fechar as pontas",
  "joga mais direto para fugir da pressão",
  "se lança ao ataque",
  "administra a vantagem",
];
const { instance } = await WebAssembly.instantiate(readFileSync(process.argv[2]!), {});
const wasm = instance.exports.halfTimePlan as (...a: number[]) => number;
const cases: number[][] = [];
for (const og of [0, 1, 3])
  for (const fg of [0, 1, 3])
    for (const os of [0, 2, 5])
      for (const fs of [0, 5, 6, 12])
        for (const fp of [40, 57, 58, 70])
          for (const pr of [0, 1, 2])
            for (const me of [0, 2, 4])
              for (const wi of [0, 1, 2])
                for (const te of [0, 2])
                  for (const fw of [1, 2])
                    for (const fpr of [1, 2])
                      cases.push([og, os, 100 - fp, fg, fs, fp, pr, me, wi, te, fw, fpr]);
let mismatch = 0;
for (const c of cases) {
  const [og, os, op, fg, fs, fp, pr, me, wi, te, fw, fpr] = c as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const ts = halfTimePlan(
    { goals: og, shots: os, possession: op },
    { goals: fg, shots: fs, possession: fp },
    { pressing: pr, mentality: me, width: wi, tempo: te } as never,
    { width: fw, pressing: fpr } as never,
  );
  const r = wasm(...c);
  const t = ts.tactics as unknown as Record<string, number>;
  const notes = NOTE.filter((_, i) => (r >> 16) & (1 << i));
  if (
    t.pressing !== (r & 15) ||
    t.mentality !== ((r >> 4) & 15) ||
    t.width !== ((r >> 8) & 15) ||
    t.tempo !== ((r >> 12) & 15) ||
    notes.join("|") !== ts.notes.join("|")
  )
    mismatch++;
}
const N = 200;
function time(fn: () => void) {
  const s = performance.now();
  for (let k = 0; k < N; k++) fn();
  return performance.now() - s;
}
time(() => {});
const tsMs = time(() => {
  for (const c of cases) {
    const [og, os, op, fg, fs, fp, pr, me, wi, te, fw, fpr] = c as number[];
    halfTimePlan(
      { goals: og!, shots: os!, possession: op! },
      { goals: fg!, shots: fs!, possession: fp! },
      { pressing: pr!, mentality: me!, width: wi!, tempo: te! } as never,
      { width: fw!, pressing: fpr! } as never,
    );
  }
});
const wMs = time(() => {
  for (const c of cases) {
    const r = wasm(...c);
    NOTE.filter((_, i) => (r >> 16) & (1 << i));
  }
});
console.log(
  JSON.stringify({
    cases: cases.length,
    mismatch,
    calls: cases.length * N,
    tsMs: +tsMs.toFixed(1),
    wasmMs: +wMs.toFixed(1),
  }),
);
