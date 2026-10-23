import type { FormationKey, Position } from "./types";

export interface Slot {
  pos: Position;
  x: number; // -1 = próprio gol, 1 = gol adversário
  z: number; // -1 = esquerda, 1 = direita
  label: string;
}

const keeper: Slot = { pos: "GK", x: -0.94, z: 0, label: "GOL" };
function shape(lines: Array<[Position, number, number, string]>): Slot[] {
  return [
    { ...keeper },
    ...lines.flatMap(([pos, count, x, label]) =>
      Array.from({ length: count }, (_, i) => ({
        pos,
        x,
        z: count === 1 ? 0 : -0.76 + (i * 1.52) / (count - 1),
        label,
      })),
    ),
  ];
}

export const FORMATIONS: Record<FormationKey, Slot[]> = {
  "4-5-1": shape([
    ["DF", 4, -0.66, "DEF"],
    ["MF", 5, -0.12, "MEI"],
    ["FW", 1, 0.52, "ATA"],
  ]),
  "5-3-2": shape([
    ["DF", 5, -0.67, "DEF"],
    ["MF", 3, -0.15, "MEI"],
    ["FW", 2, 0.52, "ATA"],
  ]),
  "3-4-3": shape([
    ["DF", 3, -0.68, "ZAG"],
    ["MF", 4, -0.12, "MEI"],
    ["FW", 3, 0.5, "ATA"],
  ]),
  "4-1-4-1": shape([
    ["DF", 4, -0.66, "DEF"],
    ["MF", 1, -0.36, "VOL"],
    ["MF", 4, 0.05, "MEI"],
    ["FW", 1, 0.55, "ATA"],
  ]),
  "4-4-2-losango": shape([
    ["DF", 4, -0.66, "DEF"],
    ["MF", 1, -0.36, "VOL"],
    ["MF", 2, -0.05, "MC"],
    ["MF", 1, 0.25, "MEI"],
    ["FW", 2, 0.55, "ATA"],
  ]),
  "4-3-1-2": shape([
    ["DF", 4, -0.66, "DEF"],
    ["MF", 3, -0.2, "MC"],
    ["MF", 1, 0.22, "MEI"],
    ["FW", 2, 0.55, "ATA"],
  ]),
  "5-4-1": shape([
    ["DF", 5, -0.7, "DEF"],
    ["MF", 4, -0.12, "MEI"],
    ["FW", 1, 0.52, "ATA"],
  ]),
  "3-4-2-1": shape([
    ["DF", 3, -0.68, "ZAG"],
    ["MF", 4, -0.18, "MEI"],
    ["MF", 2, 0.24, "MEI"],
    ["FW", 1, 0.6, "ATA"],
  ]),
  "4-3-3": [
    { pos: "GK", x: -0.94, z: 0, label: "GOL" },
    { pos: "DF", x: -0.62, z: -0.72, label: "LE" },
    { pos: "DF", x: -0.68, z: -0.24, label: "ZAG" },
    { pos: "DF", x: -0.68, z: 0.24, label: "ZAG" },
    { pos: "DF", x: -0.62, z: 0.72, label: "LD" },
    { pos: "MF", x: -0.3, z: 0, label: "VOL" },
    { pos: "MF", x: -0.05, z: -0.35, label: "MC" },
    { pos: "MF", x: -0.05, z: 0.35, label: "MC" },
    { pos: "FW", x: 0.4, z: -0.78, label: "PE" },
    { pos: "FW", x: 0.55, z: 0, label: "CA" },
    { pos: "FW", x: 0.4, z: 0.78, label: "PD" },
  ],
  "4-4-2": [
    { pos: "GK", x: -0.94, z: 0, label: "GOL" },
    { pos: "DF", x: -0.62, z: -0.74, label: "LE" },
    { pos: "DF", x: -0.68, z: -0.25, label: "ZAG" },
    { pos: "DF", x: -0.68, z: 0.25, label: "ZAG" },
    { pos: "DF", x: -0.62, z: 0.74, label: "LD" },
    { pos: "MF", x: -0.15, z: -0.76, label: "ME" },
    { pos: "MF", x: -0.22, z: -0.24, label: "MC" },
    { pos: "MF", x: -0.22, z: 0.24, label: "MC" },
    { pos: "MF", x: -0.15, z: 0.76, label: "MD" },
    { pos: "FW", x: 0.5, z: -0.22, label: "ATA" },
    { pos: "FW", x: 0.5, z: 0.22, label: "ATA" },
  ],
  "3-5-2": [
    { pos: "GK", x: -0.94, z: 0, label: "GOL" },
    { pos: "DF", x: -0.68, z: -0.45, label: "ZAG" },
    { pos: "DF", x: -0.72, z: 0, label: "ZAG" },
    { pos: "DF", x: -0.68, z: 0.45, label: "ZAG" },
    { pos: "MF", x: -0.2, z: -0.85, label: "ALA" },
    { pos: "MF", x: -0.3, z: -0.28, label: "VOL" },
    { pos: "MF", x: -0.32, z: 0.28, label: "VOL" },
    { pos: "MF", x: -0.2, z: 0.85, label: "ALA" },
    { pos: "MF", x: 0.15, z: 0, label: "MEI" },
    { pos: "FW", x: 0.52, z: -0.22, label: "ATA" },
    { pos: "FW", x: 0.52, z: 0.22, label: "ATA" },
  ],
  "4-2-3-1": [
    { pos: "GK", x: -0.94, z: 0, label: "GOL" },
    { pos: "DF", x: -0.62, z: -0.74, label: "LE" },
    { pos: "DF", x: -0.68, z: -0.25, label: "ZAG" },
    { pos: "DF", x: -0.68, z: 0.25, label: "ZAG" },
    { pos: "DF", x: -0.62, z: 0.74, label: "LD" },
    { pos: "MF", x: -0.38, z: -0.2, label: "VOL" },
    { pos: "MF", x: -0.38, z: 0.2, label: "VOL" },
    { pos: "MF", x: 0.1, z: -0.72, label: "PE" },
    { pos: "MF", x: 0.12, z: 0, label: "MEI" },
    { pos: "MF", x: 0.1, z: 0.72, label: "PD" },
    { pos: "FW", x: 0.55, z: 0, label: "CA" },
  ],
};

export const MENTALITIES = ["Retrancado", "Defensivo", "Equilibrado", "Ofensivo", "Ataque total"];

export const PRESSING = ["Bloco baixo", "Padrão", "Pressão alta"];
export const WIDTHS = ["Estreito", "Padrão", "Aberto"];
export const TEMPOS = ["Lento", "Padrão", "Acelerado"];
export const FORMATION_KEYS: FormationKey[] = [
  "4-3-3",
  "4-4-2",
  "3-5-2",
  "4-2-3-1",
  "4-5-1",
  "5-3-2",
  "3-4-3",
  "4-1-4-1",
  "4-4-2-losango",
  "4-3-1-2",
  "5-4-1",
  "3-4-2-1",
];
