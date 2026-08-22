import type { FormationKey, Position } from "./types";

export interface Slot {
  pos: Position;
  x: number; // -1 = próprio gol, 1 = gol adversário
  z: number; // -1 = esquerda, 1 = direita
  label: string;
}

export const FORMATIONS: Record<FormationKey, Slot[]> = {
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

export const MENTALITIES = [
  "Retrancado",
  "Defensivo",
  "Equilibrado",
  "Ofensivo",
  "All out attack",
];

export const PRESSING = ["Bloco baixo", "Padrão", "Pressão alta"];
export const WIDTHS = ["Estreito", "Padrão", "Aberto"];
export const TEMPOS = ["Lento", "Padrão", "Acelerado"];
