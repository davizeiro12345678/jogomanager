// ============================================================================
//  graphics-modules.test.ts
//  Contratos dos módulos novos de gráfico: correção de cor, superfície dos
//  atletas e vigia de orçamento de cena. Todos são puros (sem WebGL), então
//  rodam em qualquer máquina e travam regressão de custo.
// ============================================================================

import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { censusScene, tagCensus } from "@/game/scene-census";
import { DrawWatch, formatDrawReport } from "@/game/graphics/draw-watch";
import {
  applyRecipe as applyRecipePublic,
  gradeFor,
  gradeKey,
  gradeLut,
  gradeLutBytes,
  clearGradeLuts,
  LUT_SIZE,
} from "@/game/graphics/grade";
import {
  surfaceFromSteps,
  surfaceKey,
  surfaceState,
  surfaceSteps,
  describeSurface,
  applySurface,
} from "@/game/graphics/player-surface";

function sceneWith(buckets: Record<string, number>): THREE.Object3D {
  const root = new THREE.Group();
  for (const [bucket, count] of Object.entries(buckets)) {
    const group = new THREE.Group();
    tagCensus(group, bucket as never);
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial());
      group.add(mesh);
    }
    root.add(group);
  }
  return root;
}

describe("correção de cor (LUT)", () => {
  it("a curva é monotônica e mantém preto e branco nos extremos", () => {
    const recipe = gradeFor("noite", "chuva", "match");
    const black = applyRecipePublic(0, 0, 0, recipe);
    const white = applyRecipePublic(1, 1, 1, recipe);
    // preto pode ganhar a elevação de sombra, mas nunca virar cinza claro
    expect(Math.max(...black)).toBeLessThan(0.12);
    // branco continua branco (não estoura nem escurece)
    expect(Math.min(...white)).toBeGreaterThan(0.82);
    // monotônica: mais entrada, mais saída
    const a = applyRecipePublic(0.25, 0.25, 0.25, recipe)[0]!;
    const b = applyRecipePublic(0.5, 0.5, 0.5, recipe)[0]!;
    const c = applyRecipePublic(0.75, 0.75, 0.75, recipe)[0]!;
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
  });

  it("horário e clima mudam a receita", () => {
    const dia = gradeFor("dia", "limpo", "match");
    const noite = gradeFor("noite", "chuva", "drama");
    expect(gradeKey("dia", "limpo", "match")).not.toBe(gradeKey("noite", "chuva", "drama"));
    expect(noite.temperature).toBeGreaterThan(dia.temperature);
  });

  it("gera uma textura 3D do tamanho certo e a memoriza", () => {
    clearGradeLuts();
    const first = gradeLut("dia", "limpo", "match");
    const second = gradeLut("dia", "limpo", "match");
    expect(first).toBe(second);
    expect(first.image.width).toBe(LUT_SIZE);
    expect(first.image.data!.length).toBe(LUT_SIZE ** 3 * 4);
    expect(gradeLutBytes()).toBeGreaterThan(0);
    expect(first.isData3DTexture).toBe(true);
  });

  it("o cache tem teto e não cresce sem limite", () => {
    clearGradeLuts();
    for (const time of ["dia", "entardecer", "noite"] as const) {
      for (const weather of ["limpo", "nublado", "chuva", "neve"] as const) {
        for (const moment of ["match", "replay", "drama"] as const) {
          gradeLut(time, weather, moment);
        }
      }
    }
    // 36 combinações, cache máximo de 12
    expect(gradeLutBytes() / (LUT_SIZE ** 3 * 4)).toBeLessThanOrEqual(12);
  });
});

describe("superfície dos atletas", () => {
  it("suor e sujeira só aumentam com o tempo", () => {
    const start = surfaceState({ minute: 0, weather: "limpo" });
    const mid = surfaceState({ minute: 45, weather: "limpo" });
    const end = surfaceState({ minute: 90, weather: "limpo" });
    expect(start.sweat).toBeLessThan(mid.sweat);
    expect(mid.sweat).toBeLessThan(end.sweat);
    expect(start.dirt).toBeLessThan(end.dirt);
    expect(end.sweat).toBeLessThanOrEqual(1);
  });

  it("chuva molha desde o começo, tempo seco não", () => {
    expect(surfaceState({ minute: 5, weather: "chuva" }).wet).toBeGreaterThan(0.5);
    expect(surfaceState({ minute: 85, weather: "limpo" }).wet).toBe(0);
  });

  it("qualidade baixa desliga o detalhe de superfície", () => {
    const low = surfaceState({ minute: 90, weather: "chuva", quality: "baixa" });
    expect(low.sweat).toBe(0);
    expect(low.dirt).toBe(0);
  });

  it("a quantização é estável e limitada (protege o cache de materiais)", () => {
    const keys = new Set<string>();
    for (let minute = 0; minute <= 120; minute++) {
      for (const weather of ["limpo", "chuva"] as const) {
        const steps = surfaceSteps(surfaceState({ minute, weather }));
        keys.add(surfaceKey(steps));
        expect(steps.sweat).toBeLessThanOrEqual(2);
        expect(steps.dirt).toBeLessThanOrEqual(2);
        expect(steps.wet).toBeLessThanOrEqual(1);
      }
    }
    // no máximo 3 × 3 × 2 combinações, mesmo com 242 amostras
    expect(keys.size).toBeLessThanOrEqual(18);
  });

  it("ida e volta de degrau não inventa valor", () => {
    const steps = surfaceSteps(surfaceState({ minute: 70, weather: "chuva" }));
    const back = surfaceFromSteps(steps);
    expect(surfaceKey(surfaceSteps(back))).toBe(surfaceKey(steps));
  });

  it("aplicar superfície mexe só em escalares e mantém a faixa válida", () => {
    const material = new THREE.MeshPhysicalMaterial({ roughness: 0.7, clearcoat: 0.2, sheen: 0.4 });
    applySurface(material, { sweat: 1, dirt: 1, wet: 1, fatigue: 1 });
    expect(material.roughness).toBeGreaterThanOrEqual(0);
    expect(material.roughness).toBeLessThanOrEqual(1);
    expect(material.clearcoat).toBeLessThanOrEqual(1);
    expect(material.sheen).toBeLessThanOrEqual(1);
    expect(describeSurface({ sweat: 0.5, dirt: 0.25, wet: 0, fatigue: 0 })).toContain("suor 50%");
  });
});

describe("vigia de orçamento de cena", () => {
  it("atribui o custo ao bucket certo e aponta o culpado", () => {
    const scene = sceneWith({ crowd: 40, player: 12, grass: 3 });
    const watch = new DrawWatch("alta");
    const sample = watch.sample(scene, 0);
    expect(sample.draws).toBe(55);
    expect(sample.offenders[0]!.bucket).toBe("crowd");
    expect(sample.offenders[0]!.draws).toBe(40);
    expect(sample.allowed).toBe(260);
    expect(sample.overBudget).toBe(false);
  });

  it("estoura o orçamento do tier mais fraco com a mesma cena", () => {
    const scene = sceneWith({ crowd: 200, player: 90 });
    const watch = new DrawWatch("baixa");
    const sample = watch.sample(scene, 0);
    expect(sample.overBudget).toBe(true);
    expect(sample.headroom).toBeLessThan(0);
    expect(formatDrawReport(watch)).toMatch(/⚠/);
  });

  it("detecta tendência de alta (vazamento de malha)", () => {
    const watch = new DrawWatch("media");
    for (let i = 0; i < 12; i++) watch.sample(sceneWith({ props: 10 + i * 4 }), i);
    expect(watch.trend()).toBe("up");
    expect(watch.peak()).toBeGreaterThan(watch.history[0]!.draws);
  });

  it("histórico é limitado e reiniciável", () => {
    const watch = new DrawWatch("media", { maxSamples: 5 });
    for (let i = 0; i < 20; i++) watch.sample(sceneWith({ props: i }), i);
    expect(watch.history.length).toBe(5);
    watch.reset();
    expect(watch.history.length).toBe(0);
    expect(watch.last.draws).toBe(0);
  });

  it("conversão de censo em amostra não depende de WebGL", () => {
    const census = censusScene(sceneWith({ ball: 2 }));
    const watch = new DrawWatch("cinema");
    const sample = watch.describe(census, 42);
    expect(sample.t).toBe(42);
    expect(sample.draws).toBe(2);
  });
});
