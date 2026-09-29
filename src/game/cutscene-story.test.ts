// ============================================================================
//  cutscene-story.test.ts
//  Contratos do arco de história: roteiros válidos, direção determinística e
//  sorteio contextual. Uma cena quebrada aqui vira tela quebrada na carreira,
//  então cada regra nova entra com teste travando QUANDO ela dispara.
// ============================================================================

import { describe, expect, it } from "vitest";

import { CUTSCENES, SPEAKER_LABEL, STORY_SCENE_IDS, type Cutscene } from "@/content/cutscenes";
import {
  directScene,
  lightFor,
  shotIndexFor,
  sizeFor,
  type LineEmotion,
} from "@/game/cutscene-director";
import { buildCutsceneTimeline, SHOTS } from "@/game/cutscene-timeline";
import { memoryFrom, selectStoryScene } from "@/game/cutscene-selector";
import type { CareerState } from "@/game/types";

function career(patch: Record<string, unknown> = {}): CareerState {
  return {
    version: 3,
    leagueId: "bra-a",
    clubId: "fla",
    managerName: "Teste",
    season: 1,
    round: 10,
    tactics: { formation: "4-3-3", mentality: 2, pressing: 1, width: 1, tempo: 1 },
    training: "equilibrado",
    lineup: [],
    bench: [],
    fixtures: [],
    players: {},
    results: [],
    finances: { budget: 50, spent: 0, income: 0 },
    approval: 60,
    objective: 4,
    news: [],
    trophies: [],
    history: [],
    fanApproval: 60,
    pressure: 25,
    staff: { assistente: 2, preparador: 2, medico: 2, olheiro: 2 },
    sponsor: 1,
    ticketPrice: 45,
    capacity: 60000,
    streak: 0,
    offers: [],
    jobOffers: [],
    scoutReports: [],
    managerHistory: [],
    sacked: false,
    ...patch,
  } as CareerState;
}

function loss(clubId: string, round: number, home: boolean) {
  return {
    round,
    home: home ? clubId : "pal",
    away: home ? "pal" : clubId,
    hg: home ? 0 : 2,
    ag: home ? 2 : 0,
  };
}

describe("roteiros do arco de história", () => {
  it("declara 16 cenas e todas existem no catálogo", () => {
    expect(STORY_SCENE_IDS.length).toBe(22);
    for (const id of STORY_SCENE_IDS) {
      expect(CUTSCENES[id], `cena ${id}`).toBeDefined();
    }
  });

  it("toda cena tem falas válidas com locutor conhecido", () => {
    for (const id of STORY_SCENE_IDS) {
      const scene: Cutscene = CUTSCENES[id]!;
      expect(scene.id).toBe(id);
      expect(scene.title.length).toBeGreaterThan(0);
      expect(scene.lines.length).toBeGreaterThanOrEqual(2);
      for (const line of scene.lines) {
        expect(SPEAKER_LABEL[line.who], `${id}: locutor ${line.who}`).toBeDefined();
        expect(line.text.trim().length, `${id}: texto vazio`).toBeGreaterThan(10);
      }
    }
  });

  it("o arco cobre os marcos da carreira (abertura, crise, queda, volta)", () => {
    const ids = new Set<string>(STORY_SCENE_IDS);
    for (const must of [
      "season-kickoff",
      "crisis-meeting",
      "ultimatum",
      "sacking-night",
      "job-interview",
      "rebuild-day-one",
      "legend-retirement",
    ]) {
      expect(ids.has(must), `marco ${must}`).toBe(true);
    }
  });
});

describe("direção cinematográfica", () => {
  const calm: LineEmotion = { tension: 0.1, warmth: 0.1, urgency: 0.1 };
  const tense: LineEmotion = { tension: 0.8, warmth: 0.1, urgency: 0.2 };

  it("o narrador fica sempre no plano geral", () => {
    expect(sizeFor("narrator", tense, false)).toBe("geral");
    expect(sizeFor("narrator", tense, true)).toBe("geral");
  });

  it("o clímax vira close (menos o narrador)", () => {
    expect(sizeFor("manager", calm, true)).toBe("close");
    expect(sizeFor("captain", calm, true)).toBe("close");
  });

  it("tensão alta aproxima a câmera, calma mantém o plano do personagem", () => {
    expect(sizeFor("manager", tense, false)).toBe("proximo");
    expect(sizeFor("manager", calm, false)).toBe("medio");
  });

  it("a luz segue a emoção dominante", () => {
    expect(lightFor({ tension: 0.8, warmth: 0, urgency: 0 }, "bad")).toBe("dramatica");
    expect(lightFor({ tension: 0, warmth: 0.8, urgency: 0 }, "good")).toBe("festa");
    expect(lightFor(calm, "neutral")).toBe("neutra");
  });

  it("a mesma cena gera sempre a mesma direção", () => {
    const a = directScene(CUTSCENES["ultimatum"]!);
    const b = directScene(CUTSCENES["ultimatum"]!);
    expect(a).toEqual(b);
    expect(a.lines.length).toBe(CUTSCENES["ultimatum"]!.lines.length);
    expect(a.lines[a.climax]!.beat).toBe(true);
  });

  it("o clímax cai no fim da cena, onde a revelação mora", () => {
    for (const id of STORY_SCENE_IDS) {
      const direction = directScene(CUTSCENES[id]!);
      const lastThird = Math.floor((direction.lines.length * 2) / 3);
      expect(direction.climax, id).toBeGreaterThanOrEqual(Math.max(0, lastThird - 1));
    }
  });

  it("escolhe enquadramentos válidos e estáveis", () => {
    const direction = directScene(CUTSCENES["sacking-night"]!);
    for (const line of direction.lines) {
      const first = shotIndexFor(line, "sacking-night", SHOTS);
      const second = shotIndexFor(line, "sacking-night", SHOTS);
      expect(first).toBe(second);
      expect(first).toBeGreaterThanOrEqual(0);
      expect(first).toBeLessThan(SHOTS.length);
    }
  });

  it("a timeline dirigida continua contínua e legível", () => {
    for (const id of STORY_SCENE_IDS) {
      const timeline = buildCutsceneTimeline(CUTSCENES[id]!);
      expect(timeline.duration).toBeLessThan(400);
      for (const line of timeline.lines) {
        expect(line.duration).toBeGreaterThan(1.2);
        expect(line.duration).toBeLessThan(12);
        expect(SHOTS).toContain(line.shot);
      }
    }
  });
});

describe("sorteio contextual", () => {
  const week = { gf: 1, ga: 1, round: 10, opponentId: "pal" };

  it("demissão dispara a noite da demissão (não a despedida genérica)", () => {
    const before = career({ sacked: false });
    const after = career({ sacked: true });
    expect(selectStoryScene({ before, after, week }, memoryFrom(after))).toBe("sacking-night");
  });

  it("novo clube depois de demitido dispara a reconstrução", () => {
    const before = career({ sacked: true, clubId: "fla" });
    const after = career({ sacked: false, clubId: "pal" });
    expect(selectStoryScene({ before, after, week }, memoryFrom(after))).toBe("rebuild-day-one");
  });

  it("pressão extrema dispara o ultimato; pressão alta com jejum, a crise", () => {
    const crisis = career({
      pressure: 90,
      results: [loss("fla", 8, true), loss("fla", 9, false), loss("fla", 10, true)],
    });
    expect(selectStoryScene({ before: crisis, after: crisis, week }, memoryFrom(crisis))).toBe(
      "ultimatum",
    );
    const mild = career({
      pressure: 65,
      results: [loss("fla", 8, true), loss("fla", 9, false), loss("fla", 10, true)],
      seenScenes: ["captain-split"],
    });
    expect(selectStoryScene({ before: mild, after: mild, week }, memoryFrom(mild))).toBe(
      "crisis-meeting",
    );
  });

  it("placar do visitante é lido do lado certo (não inverte vitória e derrota)", () => {
    // três derrotas fora de casa: hg é do mandante, ag é meu
    const after = career({
      pressure: 65,
      seenScenes: ["captain-split"],
      results: [loss("fla", 8, false), loss("fla", 9, false), loss("fla", 10, false)],
    });
    expect(selectStoryScene({ before: after, after, week }, memoryFrom(after))).toBe(
      "crisis-meeting",
    );
  });

  it("início de temporada dispara a abertura", () => {
    const after = career({ round: 1, season: 2 });
    expect(selectStoryScene({ before: after, after, week }, memoryFrom(after))).toBe(
      "season-kickoff",
    );
  });

  it("marcos não repetem e humor não volta em semana seguida", () => {
    const after = career({ round: 1, season: 1, seenScenes: ["season-kickoff"] });
    expect(selectStoryScene({ before: after, after, week }, memoryFrom(after))).not.toBe(
      "season-kickoff",
    );
    const hot = career({ pressure: 90 });
    expect(
      selectStoryScene({ before: hot, after: hot, week }, memoryFrom(hot, "ultimatum")),
    ).not.toBe("ultimatum");
  });

  it("semifinal e final de copa disparam a véspera de decisão", () => {
    const after = career({
      cups: [
        {
          id: "national",
          name: "Copa",
          stage: 3,
          ties: [],
          out: false,
          winner: null,
          everyRounds: 2,
        },
      ],
    });
    expect(selectStoryScene({ before: after, after, week }, memoryFrom(after))).toBe(
      "cup-final-eve",
    );
  });

  it("elenco eliminado da copa não ganha véspera de decisão", () => {
    const after = career({
      cups: [
        {
          id: "national",
          name: "Copa",
          stage: 3,
          ties: [],
          out: true,
          winner: null,
          everyRounds: 2,
        },
      ],
    });
    expect(selectStoryScene({ before: after, after, week }, memoryFrom(after))).not.toBe(
      "cup-final-eve",
    );
  });

  it("semana tranquila no meio da tabela não força cena", () => {
    const after = career({ round: 11, pressure: 30, streak: 0 });
    expect(selectStoryScene({ before: after, after, week }, memoryFrom(after))).toBeUndefined();
  });
});
