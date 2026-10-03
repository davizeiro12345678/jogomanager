// ============================================================================
//  animation-catalog.test.ts
//  Testes para o catálogo de animações e sistema de seleção de clipes.
// ============================================================================

import { beforeAll, describe, expect, it } from "vitest";

import { initializeAnimationCatalog as registerClips } from "./register-animations";
import {
  ANIMATION_CATALOG,
  selectClipFromContext,
  canTransition,
  calculateBlendWeight,
  createAnnotatedClip,
  createClipMetadata,
  STANDARD_MARKERS,
  FAMILY_METADATA,
} from "./animation-catalog";
import { emptyPose, type AnnotatedClip, type Clip, type ClipCtx } from "./animation-core";

// ============================================================================
// Setup
// ============================================================================

// Mock dos clipes para teste
const mockClip: Clip = (c: ClipCtx) => emptyPose();

// Registra os clipes antes dos testes
beforeAll(() => {
  registerClips();
});

// ============================================================================
// Testes de registro de clipes
// ============================================================================

describe("registerClips", () => {
  it("deve registrar todos os clipes no catálogo", () => {
    // Conta o número total de clipes registrados
    const totalClips = Object.values(ANIMATION_CATALOG).reduce(
      (total, familyClips) => total + Object.keys(familyClips).length,
      0,
    );

    // Deve ter pelo menos 100 clipes registrados (base + extra + extra2)
    expect(totalClips).toBeGreaterThanOrEqual(140);
  });

  it("deve ter todas as famílias definidas", () => {
    const expectedFamilies = [
      "locomotion",
      "ballControl",
      "passing",
      "shooting",
      "defense",
      "goalkeeper",
      "celebration",
      "recovery",
      "idle",
    ];

    for (const family of expectedFamilies) {
      expect(ANIMATION_CATALOG[family as keyof typeof ANIMATION_CATALOG]).toBeDefined();
      expect(
        Object.keys(ANIMATION_CATALOG[family as keyof typeof ANIMATION_CATALOG]).length,
      ).toBeGreaterThan(0);
    }
  });

  it("deve registrar clipes de locomoção", () => {
    const locomotionClips = ANIMATION_CATALOG.locomotion;
    // "idle" pertence à família idle, não à locomoção.
    expect(ANIMATION_CATALOG.idle["idle"]).toBeDefined();
    expect(locomotionClips["walk"]).toBeDefined();
    expect(locomotionClips["jog"]).toBeDefined();
    expect(locomotionClips["run"]).toBeDefined();
    expect(locomotionClips["sprint"]).toBeDefined();
  });

  it("deve registrar clipes de controle de bola", () => {
    const ballControlClips = ANIMATION_CATALOG.ballControl;
    expect(ballControlClips["dribbleLight"]).toBeDefined();
    expect(ballControlClips["dribbleFast"]).toBeDefined();
    expect(ballControlClips["feint"]).toBeDefined();
    expect(ballControlClips["elastico"]).toBeDefined();
  });

  it("deve registrar clipes de passes", () => {
    const passingClips = ANIMATION_CATALOG.passing;
    expect(passingClips["passShort"]).toBeDefined();
    expect(passingClips["passLong"]).toBeDefined();
    expect(passingClips["cross"]).toBeDefined();
  });

  it("deve registrar clipes de finalização", () => {
    const shootingClips = ANIMATION_CATALOG.shooting;
    expect(shootingClips["shotLow"]).toBeDefined();
    expect(shootingClips["shotPower"]).toBeDefined();
    expect(shootingClips["header"]).toBeDefined();
    expect(shootingClips["bicycle"]).toBeDefined();
  });

  it("deve registrar clipes de defesa", () => {
    const defenseClips = ANIMATION_CATALOG.defense;
    expect(defenseClips["slideTackle"]).toBeDefined();
    expect(defenseClips["standTackle"]).toBeDefined();
    expect(defenseClips["block"]).toBeDefined();
    expect(defenseClips["intercept"]).toBeDefined();
  });

  it("deve registrar clipes de goleiro", () => {
    const goalkeeperClips = ANIMATION_CATALOG.goalkeeper;
    expect(goalkeeperClips["gkStance"]).toBeDefined();
    expect(goalkeeperClips["gkSaveLow"]).toBeDefined();
    expect(goalkeeperClips["gkSaveHigh"]).toBeDefined();
    expect(goalkeeperClips["gkDiveLeft"]).toBeDefined();
    expect(goalkeeperClips["gkDiveRight"]).toBeDefined();
  });
});

// ============================================================================
// Testes de metadados
// ============================================================================

describe("Clip Metadata", () => {
  it("deve ter metadados válidos para clipes de locomoção", () => {
    const idleClip = ANIMATION_CATALOG.idle["idle"]!;
    expect(idleClip.metadata.family).toBe("idle");
    expect(idleClip.metadata.loop).toBe(true);
    expect(idleClip.metadata.priority).toBeGreaterThanOrEqual(0);
    expect(idleClip.metadata.interruptible).toBe(true);
  });

  it("deve ter metadados válidos para clipes de chute", () => {
    const shotClip = ANIMATION_CATALOG.shooting["shotPower"]!;
    expect(shotClip.metadata.family).toBe("shooting");
    expect(shotClip.metadata.loop).toBe(false);
    expect(shotClip.metadata.duration).toBeDefined();
    expect(shotClip.metadata.priority).toBeGreaterThan(0.5);
    expect(shotClip.metadata.markers).toBeDefined();
    expect(shotClip.metadata.markers!.length).toBeGreaterThan(0);
    expect(shotClip.metadata.dominantFoot).toBe("right");
  });

  it("deve ter marcadores de contato para chutes", () => {
    const shotClip = ANIMATION_CATALOG.shooting["shotLow"]!;
    const contactMarker = shotClip.metadata.markers!.find((m) => m.phase === "contact");
    expect(contactMarker).toBeDefined();
    expect(contactMarker!.contactType).toBe("ball");
  });

  it("deve ter pé dominante definido para ações", () => {
    const passClip = ANIMATION_CATALOG.passing["passLong"]!;
    expect(passClip.metadata.dominantFoot).toBe("right");

    const bicycleClip = ANIMATION_CATALOG.shooting["bicycle"]!;
    expect(bicycleClip.metadata.dominantFoot).toBe("both");
  });

  it("deve ter duração definida para clipes não-loop", () => {
    const tackleClip = ANIMATION_CATALOG.defense["slideTackle"]!;
    expect(tackleClip.metadata.loop).toBe(false);
    expect(tackleClip.metadata.duration).toBeDefined();
    expect(tackleClip.metadata.duration!).toBeGreaterThan(0);
  });
});

// ============================================================================
// Testes de seleção de clipes
// ============================================================================

describe("selectClipFromContext", () => {
  it("deve selecionar idle quando parado", () => {
    const result = selectClipFromContext({
      speed: 0,
      stopped: true,
      hasBall: false,
      ballDist: 10,
      stamina: 100,
      defending: false,
    });
    expect(result.family).toBe("idle");
    expect(result.name).toBe("idle");
  });

  it("deve selecionar walk para velocidade baixa", () => {
    const result = selectClipFromContext({
      speed: 1,
      stopped: false,
      hasBall: false,
      ballDist: 10,
      stamina: 100,
      defending: false,
    });
    expect(result.family).toBe("locomotion");
    expect(result.name).toBe("walk");
  });

  it("deve selecionar jog para velocidade média", () => {
    const result = selectClipFromContext({
      speed: 3,
      stopped: false,
      hasBall: false,
      ballDist: 10,
      stamina: 100,
      defending: false,
    });
    expect(result.family).toBe("locomotion");
    expect(result.name).toBe("jog");
  });

  it("deve selecionar run para velocidade alta", () => {
    const result = selectClipFromContext({
      speed: 6,
      stopped: false,
      hasBall: false,
      ballDist: 10,
      stamina: 100,
      defending: false,
    });
    expect(result.family).toBe("locomotion");
    expect(result.name).toBe("run");
  });

  it("deve selecionar sprint para velocidade muito alta", () => {
    const result = selectClipFromContext({
      speed: 8,
      stopped: false,
      hasBall: false,
      ballDist: 10,
      stamina: 100,
      defending: false,
    });
    expect(result.family).toBe("locomotion");
    expect(result.name).toBe("sprint");
  });

  it("deve selecionar ação de chute pelo nome", () => {
    const result = selectClipFromContext({
      action: "shotPower",
      speed: 0,
      stopped: false,
      hasBall: true,
      ballDist: 5,
      stamina: 100,
      defending: false,
    });
    expect(result.family).toBe("shooting");
    expect(result.name).toBe("shotPower");
  });

  it("deve selecionar ação de passe pelo nome", () => {
    const result = selectClipFromContext({
      action: "passLong",
      speed: 0,
      stopped: false,
      hasBall: true,
      ballDist: 5,
      stamina: 100,
      defending: false,
    });
    expect(result.family).toBe("passing");
    expect(result.name).toBe("passLong");
  });

  it("deve selecionar ação de defesa pelo nome", () => {
    const result = selectClipFromContext({
      action: "slideTackle",
      speed: 0,
      stopped: false,
      hasBall: false,
      ballDist: 5,
      stamina: 100,
      defending: true,
    });
    expect(result.family).toBe("defense");
    expect(result.name).toBe("slideTackle");
  });

  it("deve selecionar ação de goleiro pelo nome", () => {
    const result = selectClipFromContext({
      action: "gkDiveLeft",
      speed: 0,
      stopped: false,
      hasBall: false,
      ballDist: 5,
      stamina: 100,
      defending: true,
      isGK: true,
    });
    expect(result.family).toBe("goalkeeper");
    expect(result.name).toBe("gkDiveLeft");
  });

  it("deve selecionar ação de dribble pelo nome", () => {
    const result = selectClipFromContext({
      action: "dribbleFast",
      speed: 5,
      stopped: false,
      hasBall: true,
      ballDist: 2,
      stamina: 100,
      defending: false,
    });
    expect(result.family).toBe("ballControl");
    expect(result.name).toBe("dribbleFast");
  });
});

// ============================================================================
// Testes de transição entre clipes
// ============================================================================

describe("canTransition", () => {
  it("deve permitir transição de idle para walk", () => {
    const idleClip = ANIMATION_CATALOG.idle["idle"]!;
    const walkClip = ANIMATION_CATALOG.locomotion["walk"]!;

    const ctx = {
      action: null,
      speed: 1,
      hasBall: false,
      ballDist: 10,
      stamina: 100,
      defending: false,
      stopped: false,
    };

    expect(canTransition(idleClip, walkClip, ctx)).toBe(true);
  });

  it("deve permitir transição de walk para jog", () => {
    const walkClip = ANIMATION_CATALOG.locomotion["walk"]!;
    const jogClip = ANIMATION_CATALOG.locomotion["jog"]!;

    const ctx = {
      action: null,
      speed: 3,
      hasBall: false,
      ballDist: 10,
      stamina: 100,
      defending: false,
      stopped: false,
    };

    expect(canTransition(walkClip, jogClip, ctx)).toBe(true);
  });

  it("deve permitir transição para ação de alta prioridade", () => {
    const jogClip = ANIMATION_CATALOG.locomotion["jog"]!;
    const shotClip = ANIMATION_CATALOG.shooting["shotPower"]!;

    const ctx = {
      action: "shotPower",
      speed: 2,
      hasBall: true,
      ballDist: 5,
      stamina: 100,
      defending: false,
      stopped: false,
      actionT: 0,
      actionDur: 0.8,
    };

    expect(canTransition(jogClip, shotClip, ctx)).toBe(true);
  });

  it("não deve permitir transição de ação não interruptível no meio", () => {
    const shotClip = ANIMATION_CATALOG.shooting["shotPower"]!;
    const jogClip = ANIMATION_CATALOG.locomotion["jog"]!;

    const ctx = {
      action: "shotPower",
      speed: 2,
      hasBall: true,
      ballDist: 5,
      stamina: 100,
      defending: false,
      stopped: false,
      actionT: 0.5,
      actionDur: 0.8,
    };

    // Não deve permitir transição no meio de uma ação não interruptível
    expect(canTransition(shotClip, jogClip, ctx)).toBe(false);
  });

  it("deve permitir transição de ação não interruptível no final", () => {
    const shotClip = ANIMATION_CATALOG.shooting["shotPower"]!;
    const jogClip = ANIMATION_CATALOG.locomotion["jog"]!;

    const ctx = {
      action: "shotPower",
      speed: 2,
      hasBall: true,
      ballDist: 5,
      stamina: 100,
      defending: false,
      stopped: false,
      actionT: 0.95,
      actionDur: 0.8,
    };

    // Deve permitir transição nos últimos 10%
    expect(canTransition(shotClip, jogClip, ctx)).toBe(true);
  });

  it("não deve permitir transição para clipe de prioridade menor", () => {
    const shotClip = ANIMATION_CATALOG.shooting["shotPower"]!;
    const walkClip = ANIMATION_CATALOG.locomotion["walk"]!;

    const ctx = {
      action: "shotPower",
      speed: 2,
      hasBall: true,
      ballDist: 5,
      stamina: 100,
      defending: false,
      stopped: false,
      actionT: 0,
      actionDur: 0.8,
    };

    // shotPower tem prioridade 0.9, walk tem prioridade 0.1
    expect(canTransition(shotClip, walkClip, ctx)).toBe(false);
  });
});

// ============================================================================
// Testes de peso de blend
// ============================================================================

describe("calculateBlendWeight", () => {
  it("deve devolver 0 para progresso 0", () => {
    const from = ANIMATION_CATALOG.idle["idle"]!;
    const to = ANIMATION_CATALOG.locomotion["walk"]!;
    const ctx = {
      speed: 1,
      hasBall: false,
      ballDist: 10,
      stamina: 100,
      defending: false,
      stopped: false,
    };

    expect(calculateBlendWeight(from, to, ctx, 0)).toBe(0);
  });

  it("deve devolver 1 para progresso 1", () => {
    const from = ANIMATION_CATALOG.idle["idle"]!;
    const to = ANIMATION_CATALOG.locomotion["walk"]!;
    const ctx = {
      speed: 1,
      hasBall: false,
      ballDist: 10,
      stamina: 100,
      defending: false,
      stopped: false,
    };

    expect(calculateBlendWeight(from, to, ctx, 1)).toBe(1);
  });

  it("deve devolver 0.5 para progresso 0.5", () => {
    const from = ANIMATION_CATALOG.idle["idle"]!;
    const to = ANIMATION_CATALOG.locomotion["walk"]!;
    const ctx = {
      speed: 1,
      hasBall: false,
      ballDist: 10,
      stamina: 100,
      defending: false,
      stopped: false,
    };

    expect(calculateBlendWeight(from, to, ctx, 0.5)).toBe(0.5);
  });
});

// ============================================================================
// Testes de utilitários
// ============================================================================

describe("createClipMetadata", () => {
  it("deve criar metadados com valores padrão da família", () => {
    const metadata = createClipMetadata("locomotion");
    expect(metadata.family).toBe("locomotion");
    expect(metadata.loop).toBe(true);
    expect(metadata.priority).toBe(0.1);
    expect(metadata.interruptible).toBe(true);
  });

  it("deve sobrescrever valores com overrides", () => {
    const metadata = createClipMetadata("shooting", {
      duration: 1.0,
      priority: 0.95,
      loop: false,
    });
    expect(metadata.family).toBe("shooting");
    expect(metadata.loop).toBe(false);
    expect(metadata.duration).toBe(1.0);
    expect(metadata.priority).toBe(0.95);
  });
});

describe("createAnnotatedClip", () => {
  it("deve criar um clipe anotado com metadados", () => {
    const annotated = createAnnotatedClip("testClip", mockClip, "locomotion", {
      loop: true,
      priority: 0.1,
    });

    expect(annotated.clip).toBe(mockClip);
    expect(annotated.metadata.family).toBe("locomotion");
    expect(annotated.metadata.loop).toBe(true);
    expect(annotated.metadata.priority).toBe(0.1);
  });
});

// ============================================================================
// Testes de continuidade de pose
// ============================================================================

describe("Pose Continuity", () => {
  it("deve manter continuidade entre idle e walk", () => {
    const idleClip = ANIMATION_CATALOG.idle["idle"]!;
    const walkClip = ANIMATION_CATALOG.locomotion["walk"]!;

    const ctx: ClipCtx = { t: 0, u: 0, speed: 0, stride: 0, seed: 0 };

    const idlePose = idleClip.clip(ctx);
    const walkPose = walkClip.clip(ctx);

    // Os clipes devem produzir poses válidas
    expect(idlePose).toBeDefined();
    expect(walkPose).toBeDefined();
    expect(Object.keys(idlePose).length).toBeGreaterThan(0);
    expect(Object.keys(walkPose).length).toBeGreaterThan(0);
  });

  it("deve produzir poses consistentes para o mesmo contexto", () => {
    const shotClip = ANIMATION_CATALOG.shooting["shotLow"]!;

    const ctx: ClipCtx = { t: 0.5, u: 0.5, speed: 0, stride: 0, seed: 42 };

    const pose1 = shotClip.clip(ctx);
    const pose2 = shotClip.clip(ctx);

    // Mesmas entradas devem produzir mesmas saídas (determinístico)
    expect(pose1).toEqual(pose2);
  });
});

// ============================================================================
// Testes de cobertura de famílias
// ============================================================================

describe("Family Coverage", () => {
  it("deve ter clipes em todas as famílias principais", () => {
    const families = Object.keys(ANIMATION_CATALOG) as Array<keyof typeof ANIMATION_CATALOG>;

    for (const family of families) {
      const clips = ANIMATION_CATALOG[family];
      expect(Object.keys(clips).length).toBeGreaterThan(0);
    }
  });

  it("deve ter metadados válidos para todos os clipes", () => {
    const families = Object.values(ANIMATION_CATALOG) as Array<Record<string, AnnotatedClip>>;

    for (const familyClips of families) {
      for (const clip of Object.values(familyClips)) {
        expect(clip.metadata).toBeDefined();
        expect(clip.metadata.family).toBeDefined();
        expect(typeof clip.metadata.priority).toBe("number");
        expect(typeof clip.metadata.loop).toBe("boolean");
        expect(typeof clip.metadata.interruptible).toBe("boolean");
      }
    }
  });
});
