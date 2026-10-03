import { describe, expect, it } from "vitest";

import { buildTeamSetup } from "./quickMatch";
import { MatchSim } from "./sim";
import { ReplayRecorder, ReplaySim, type Replay } from "./replay";
import {
  emptyActionContext,
  emptyContactContext,
  emptyVersionedVisualData,
  getDominantFoot,
  getActionPhase,
  migrateVisualData,
  VISUAL_CONTEXT_VERSION,
  type ActionContext,
  type ContactContext,
  type VersionedVisualData,
} from "./visual-context";

function create(seed = "visual-context-test") {
  return new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), seed);
}

// Funcao auxiliar para verificar se dois VersionedVisualData sao iguais
function expectVisualDataEqual(actual: VersionedVisualData, expected: VersionedVisualData): void {
  expect(actual.version).toBe(expected.version);
  expect(actual.actionContexts.length).toBe(expected.actionContexts.length);
  expect(actual.contactContexts.length).toBe(expected.contactContexts.length);

  for (let i = 0; i < actual.actionContexts.length; i++) {
    const actualAction = actual.actionContexts[i];
    const expectedAction = expected.actionContexts[i];

    if (actualAction === null && expectedAction === null) {
      continue;
    }

    expect(actualAction).not.toBeNull();
    expect(expectedAction).not.toBeNull();

    if (actualAction && expectedAction) {
      expect(actualAction.action).toBe(expectedAction.action);
      expect(actualAction.actionT).toBe(expectedAction.actionT);
      expect(actualAction.actionDur).toBe(expectedAction.actionDur);
      expect(actualAction.phase).toBe(expectedAction.phase);
      expect(actualAction.dominantFoot).toBe(expectedAction.dominantFoot);
      expect(actualAction.usedFoot).toBe(expectedAction.usedFoot);

      // Verifica target (pode ser null)
      if (actualAction.target && expectedAction.target) {
        expect(actualAction.target.x).toBe(expectedAction.target.x);
        expect(actualAction.target.z).toBe(expectedAction.target.z);
      } else {
        expect(actualAction.target).toBeNull();
        expect(expectedAction.target).toBeNull();
      }

      // Verifica contactPoint (pode ser null)
      if (actualAction.contactPoint && expectedAction.contactPoint) {
        expect(actualAction.contactPoint.x).toBe(expectedAction.contactPoint.x);
        expect(actualAction.contactPoint.z).toBe(expectedAction.contactPoint.z);
        expect(actualAction.contactPoint.height).toBe(expectedAction.contactPoint.height);
      } else {
        expect(actualAction.contactPoint).toBeNull();
        expect(expectedAction.contactPoint).toBeNull();
      }
    }
  }

  for (let i = 0; i < actual.contactContexts.length; i++) {
    const actualContact = actual.contactContexts[i];
    const expectedContact = expected.contactContexts[i];

    if (actualContact === null && expectedContact === null) {
      continue;
    }

    expect(actualContact).not.toBeNull();
    expect(expectedContact).not.toBeNull();

    if (actualContact && expectedContact) {
      expect(actualContact.type).toBe(expectedContact.type);
      expect(actualContact.groundFoot).toBe(expectedContact.groundFoot);
      expect(actualContact.force).toBe(expectedContact.force);
      expect(actualContact.bodyPoint).toBe(expectedContact.bodyPoint);
      expect(actualContact.contactPlayerId).toBe(expectedContact.contactPlayerId);

      if (actualContact.relativeVelocity && expectedContact.relativeVelocity) {
        expect(actualContact.relativeVelocity.vx).toBe(expectedContact.relativeVelocity.vx);
        expect(actualContact.relativeVelocity.vz).toBe(expectedContact.relativeVelocity.vz);
      } else {
        expect(actualContact.relativeVelocity).toBeNull();
        expect(expectedContact.relativeVelocity).toBeNull();
      }
    }
  }
}

// -----------------------------------------------------------------------------
// Testes de utilitarios
// -----------------------------------------------------------------------------

describe("Visual Context Utilities", () => {
  describe("getDominantFoot", () => {
    it("returns deterministic dominant foot for a given seed", () => {
      expect(getDominantFoot("test-seed-1")).toBe(getDominantFoot("test-seed-1"));
      expect(getDominantFoot("test-seed-2")).toBe(getDominantFoot("test-seed-2"));
    });

    it("distributes evenly between left and right", () => {
      const results: Record<"left" | "right", number> = { left: 0, right: 0 };
      for (let i = 0; i < 1000; i++) {
        const foot = getDominantFoot(`player-${i}`);
        results[foot]++;
      }
      // Deve ter uma distribuicao aproximadamente igual
      expect(results.left).toBeGreaterThan(400);
      expect(results.right).toBeGreaterThan(400);
    });
  });

  describe("getActionPhase", () => {
    it("returns correct phase for anticipation (0-15%)", () => {
      expect(getActionPhase(0)).toBe("anticipation");
      expect(getActionPhase(0.1)).toBe("anticipation");
      expect(getActionPhase(0.14)).toBe("anticipation");
    });

    it("returns correct phase for action (15-45%)", () => {
      expect(getActionPhase(0.15)).toBe("action");
      expect(getActionPhase(0.3)).toBe("action");
      expect(getActionPhase(0.44)).toBe("action");
    });

    it("returns correct phase for contact (45-65%)", () => {
      expect(getActionPhase(0.45)).toBe("contact");
      expect(getActionPhase(0.5)).toBe("contact");
      expect(getActionPhase(0.64)).toBe("contact");
    });

    it("returns correct phase for followThrough (65-85%)", () => {
      expect(getActionPhase(0.65)).toBe("followThrough");
      expect(getActionPhase(0.7)).toBe("followThrough");
      expect(getActionPhase(0.84)).toBe("followThrough");
    });

    it("returns correct phase for recovery (85-100%)", () => {
      expect(getActionPhase(0.85)).toBe("recovery");
      expect(getActionPhase(0.9)).toBe("recovery");
      expect(getActionPhase(1.0)).toBe("recovery");
    });
  });

  describe("empty functions", () => {
    it("emptyActionContext returns valid empty context", () => {
      const ctx = emptyActionContext();
      expect(ctx.action).toBeNull();
      expect(ctx.actionT).toBe(0);
      expect(ctx.actionDur).toBe(0);
      expect(ctx.phase).toBe("anticipation");
      expect(ctx.dominantFoot).toBe("right");
    });

    it("emptyContactContext returns valid empty context", () => {
      const ctx = emptyContactContext();
      expect(ctx.type).toBe("none");
      expect(ctx.groundFoot).toBeNull();
      expect(ctx.force).toBe(0);
      expect(ctx.bodyPoint).toBeNull();
    });

    it("emptyVersionedVisualData returns valid empty data", () => {
      const data = emptyVersionedVisualData(22);
      expect(data.version).toBe(VISUAL_CONTEXT_VERSION);
      expect(data.actionContexts.length).toBe(22);
      expect(data.contactContexts.length).toBe(22);
    });
  });
});

// -----------------------------------------------------------------------------
// Testes de determinismo do contexto visual
// -----------------------------------------------------------------------------

describe("Visual Context Determinism", () => {
  it("generates the same visual context from the same seed", () => {
    const first = create("determinism-test-1");
    const second = create("determinism-test-1");

    // Avança ambos os sims para o mesmo ponto
    for (let i = 0; i < 100; i++) {
      first.step(0.5);
      second.step(0.5);
    }

    const firstContext = first.generateVisualContext();
    const secondContext = second.generateVisualContext();

    expectVisualDataEqual(firstContext, secondContext);
  });

  it("generates different visual context from different seeds", () => {
    const first = create("determinism-test-2a");
    const second = create("determinism-test-2b");

    // Avança ambos os sims para o mesmo ponto
    for (let i = 0; i < 100; i++) {
      first.step(0.5);
      second.step(0.5);
    }

    // Compara o contexto inteiro ao longo de uma janela de jogo. A checagem
    // antiga olhava um único instante e um único campo (`dominantFoot`, que é
    // derivado do pid e portanto igual nas duas sementes): o resultado dependia
    // de quantos jogadores por acaso estavam em ação naquele passo, e qualquer
    // mudança de elenco derrubava o teste sem que houvesse bug algum.
    let different = false;
    for (let step = 0; step < 400 && !different; step++) {
      first.step(0.5);
      second.step(0.5);
      const a = first.generateVisualContext();
      const b = second.generateVisualContext();
      different = JSON.stringify(a) !== JSON.stringify(b);
    }

    expect(different).toBe(true);
  });

  it("visual context does not affect match outcome", () => {
    const first = create("outcome-test-1");
    const second = create("outcome-test-1");

    // Executa partida completa em ambos
    while (!first.finished) first.step(0.5);
    while (!second.finished) second.step(0.5);

    // Gera contexto visual no final
    const firstContext = first.generateVisualContext();
    const secondContext = second.generateVisualContext();

    // Verifica que o placar e o mesmo
    expect(first.stats).toEqual(second.stats);

    // Verifica que o contexto visual e o mesmo
    expectVisualDataEqual(firstContext, secondContext);
  });
});

// -----------------------------------------------------------------------------
// Testes de migracao de versao
// -----------------------------------------------------------------------------

describe("Version Migration", () => {
  it("migrates null/undefined to empty visual data", () => {
    const migrated = migrateVisualData(null, 22);
    expect(migrated.version).toBe(VISUAL_CONTEXT_VERSION);
    expect(migrated.actionContexts.length).toBe(22);
    expect(migrated.contactContexts.length).toBe(22);
  });

  it("migrates partial data with current version", () => {
    const partialData: Partial<VersionedVisualData> = {
      version: VISUAL_CONTEXT_VERSION,
      actionContexts: [emptyActionContext()],
    };

    const migrated = migrateVisualData(partialData, 22);
    expect(migrated.version).toBe(VISUAL_CONTEXT_VERSION);
    expect(migrated.actionContexts.length).toBe(22);
    expect(migrated.contactContexts.length).toBe(22);
  });

  it("migrates old version to current version", () => {
    const oldData = {
      version: 1,
      actionContexts: [emptyActionContext()],
      contactContexts: [emptyContactContext()],
    };

    const migrated = migrateVisualData(oldData, 22);
    expect(migrated.version).toBe(VISUAL_CONTEXT_VERSION);
    expect(migrated.actionContexts.length).toBe(22);
    expect(migrated.contactContexts.length).toBe(22);
  });
});

// -----------------------------------------------------------------------------
// Testes de replay com contexto visual
// -----------------------------------------------------------------------------

describe("Replay with Visual Context", () => {
  it("records visual context data in replay frames", () => {
    const sim = create("replay-recording-test");
    const recorder = new ReplayRecorder(sim);

    // Avança a simulacao e grava frames
    for (let i = 0; i < 10; i++) {
      sim.step(0.5);
      recorder.sample();
    }

    const replay = recorder.build("Test Replay");

    // Verifica que os frames tem dados visuais
    expect(replay.frames.length).toBeGreaterThan(0);

    for (const frame of replay.frames) {
      expect(frame.v).toBeDefined();
      if (frame.v) {
        expect(frame.v.version).toBe(VISUAL_CONTEXT_VERSION);
        expect(frame.v.actionContexts.length).toBe(22);
        expect(frame.v.contactContexts.length).toBe(22);
      }
    }
  });

  it("ReplaySim can play back recorded visual context", () => {
    const sim = create("replay-playback-test");
    const recorder = new ReplayRecorder(sim);

    // Avança e grava
    for (let i = 0; i < 10; i++) {
      sim.step(0.5);
      recorder.sample();
    }

    const replay = recorder.build("Test Replay");
    const replaySim = new ReplaySim(replay);

    // Avança o replay
    replaySim.step(0.5);

    // Verifica que pode gerar contexto visual
    const context = replaySim.generateVisualContext();
    expect(context.version).toBe(VISUAL_CONTEXT_VERSION);
    expect(context.actionContexts.length).toBe(22);
  });

  it("old replays without visual data still work", () => {
    // Cria um replay antigo sem dados visuais
    const flaSetup = buildTeamSetup("fla");
    const palSetup = buildTeamSetup("pal");

    // Cria meta para 22 jogadores (11 de cada time)
    const meta: Replay["meta"] = [];
    for (const p of flaSetup.players.slice(0, 11)) {
      meta.push({
        id: `home-${p.id}`,
        side: "home" as const,
        name: p.name,
        number: p.number,
        pos: p.pos,
        pid: p.id,
      });
    }
    for (const p of palSetup.players.slice(0, 11)) {
      meta.push({
        id: `away-${p.id}`,
        side: "away" as const,
        name: p.name,
        number: p.number,
        pos: p.pos,
        pid: p.id,
      });
    }

    const oldReplay: Replay = {
      id: "old-replay",
      createdAt: Date.now(),
      title: "Old Replay",
      home: flaSetup,
      away: palSetup,
      meta,
      frames: [
        {
          t: 0,
          b: [0, 0, 0] as [number, number, number],
          p: Array<number>(22 * 4).fill(0),
          a: Array<Replay["frames"][number]["a"][number]>(22).fill(null),
          hg: 0,
          ag: 0,
          poss: "home" as const,
        },
        {
          t: 1,
          b: [1, 0, 0] as [number, number, number],
          p: Array<number>(22 * 4).fill(0),
          a: Array<Replay["frames"][number]["a"][number]>(22).fill(null),
          hg: 0,
          ag: 0,
          poss: "home" as const,
        },
      ],
      score: [0, 0] as [number, number],
    };

    // Deve conseguir criar ReplaySim sem erros
    expect(() => new ReplaySim(oldReplay)).not.toThrow();

    const replaySim = new ReplaySim(oldReplay);
    replaySim.step(0.5);

    // Deve gerar contexto visual vazio (com fallback)
    const context = replaySim.generateVisualContext();
    expect(context.version).toBe(VISUAL_CONTEXT_VERSION);
  });
});
