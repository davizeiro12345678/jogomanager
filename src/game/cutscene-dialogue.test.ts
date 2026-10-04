import { describe, expect, it } from "vitest";
import type { Cutscene, CutsceneLine } from "@/content/cutscenes";
import { cinematicCueFor } from "./cinematic-cue";
import { cinematicExpressionAt } from "./cinematic-expression";
import { cutsceneBranch } from "./cutscene-choice";
import { directScene } from "./cutscene-director";

const dialogue: CutsceneLine[] = [
  {
    who: "captain",
    text: "O grupo quer uma direção clara para o clássico, professor.",
  },
  {
    who: "manager",
    text: "Escolha como falar com o elenco.",
    choices: [
      {
        label: "Pregar respeito e confiança",
        hint: "Seguro para o grupo",
        response: [
          { who: "manager", text: "Confio no grupo. Respeito máximo, coragem para jogar." },
          { who: "captain", text: "Entendido. Vamos levar isso para o campo." },
        ],
        effect: { morale: 4, approval: 2, headline: "Treinador reforça confiança no elenco" },
      },
      {
        label: "Impor a hierarquia",
        hint: "A cobrança vem antes do conforto",
        response: [
          { who: "manager", text: "Aqui o grupo responde no treino e no campo." },
          { who: "captain", text: "Entendido, professor." },
        ],
        effect: { morale: -2, approval: 2, headline: "Treinador reforça a hierarquia" },
      },
    ],
  },
];

describe("cutscene dialogue reactions", () => {
  it("keeps an authored branch and save effect intact while reading relationship and personality", () => {
    const original = JSON.stringify(dialogue);
    const connected = cutsceneBranch(dialogue, 1, 0, {
      participants: {
        captain: {
          playerId: "captain-1",
          relationship: { trust: 95, respect: 90 },
          personality: "determinado",
        },
      },
    })!;
    const guarded = cutsceneBranch(dialogue, 1, 1, {
      participants: {
        captain: {
          playerId: "captain-1",
          relationship: { trust: 14, respect: 9 },
          personality: "temperamental",
        },
      },
    })!;

    expect(connected.lines[2]).toBe(dialogue[1]!.choices![0]!.response[0]);
    expect(connected.lines[3]).toBe(dialogue[1]!.choices![0]!.response[1]);
    expect(connected.effect).toEqual(dialogue[1]!.choices![0]!.effect);
    expect(connected.reaction).toMatchObject({
      responder: "captain",
      playerId: "captain-1",
      personality: "determinado",
      relationship: "connected",
    });
    expect(guarded.reaction).toMatchObject({
      responder: "captain",
      personality: "temperamental",
      relationship: "strained",
    });
    expect(connected.reaction!.receptivity).toBeGreaterThan(guarded.reaction!.receptivity);
    expect(connected.reaction!.warmth).toBeGreaterThan(guarded.reaction!.warmth);
    expect(connected.reaction!.tension).toBeLessThan(guarded.reaction!.tension);
    expect(connected.reaction!.support).toBeGreaterThan(connected.reaction!.resistance);
    expect(connected.reaction!.moraleDelta).toBeGreaterThan(0);
    expect(connected.reaction!.trustDelta).toBeGreaterThan(0);
    expect(guarded.reaction!.resistance).toBeGreaterThan(guarded.reaction!.support);
    expect(guarded.reaction!.moraleDelta).toBeLessThan(0);
    expect(guarded.reaction!.trustDelta).toBeLessThan(0);
    expect(JSON.stringify(dialogue)).toBe(original);
    expect(cutsceneBranch(dialogue, 1, 0)).not.toHaveProperty("reaction");
  });

  it("normalizes malformed scores at the boundary instead of expanding the save contract", () => {
    const branch = cutsceneBranch(dialogue, 1, 0, {
      participants: {
        captain: {
          playerId: "captain-1",
          relationship: { trust: 500, respect: Number.NaN },
          personality: "líder",
        },
      },
    })!;
    expect(branch.reaction).toMatchObject({ trust: 100, respect: 50, personality: "líder" });
  });

  it("turns a relationship-aware reply into a synchronized listener microreaction", () => {
    const branch = cutsceneBranch(dialogue, 1, 0, {
      participants: {
        captain: {
          playerId: "captain-1",
          relationship: { trust: 95, respect: 90 },
          personality: "determinado",
        },
      },
    })!;
    const reply = branch.lines[2]!;
    const scene: Cutscene = {
      id: "dialogue-reaction",
      title: "Resposta",
      art: "dressing",
      mood: "neutral",
      lines: [dialogue[0]!, reply],
    };
    const direction = directScene(scene);
    const cue = cinematicCueFor("dialogue-reaction:reply", reply, direction.lines[1]!, "neutral", {
      previousLine: dialogue[0],
      choiceReaction: branch.reaction,
    });
    expect(cue.turn).toMatchObject({
      previousSpeaker: "captain",
      listener: "captain",
      kind: "support",
      relationship: "connected",
    });

    const listener = cinematicExpressionAt(1.8, 21, false, 0.4, cue, 0.85);
    const idleOnly = cinematicExpressionAt(1.8, 21, false, 0.4, { ...cue, turn: undefined }, 0.85);
    expect(listener.headRoll).not.toBeCloseTo(idleOnly.headRoll, 6);
    expect(listener.gazeY).not.toBeCloseTo(idleOnly.gazeY, 8);
    expect(Object.values(listener).every(Number.isFinite)).toBe(true);
  });
});
