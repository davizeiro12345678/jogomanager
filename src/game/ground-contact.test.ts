import { describe, expect, it } from "vitest";

import { emptyPose, type Pose } from "./animation-core";
import {
  airborneFactor,
  clampPoseAnatomy,
  JOINT_LIMITS,
  poseExceedsLimits,
  solveGroundContact,
  solveLegChain,
} from "./ground-contact";
import { proportionsFor, lookFor } from "./player-model";

const P = proportionsFor(lookFor("teste-1", "MF"));

function standing(): Pose {
  return emptyPose();
}

describe("cinemática direta da perna", () => {
  it("em pé, a sola fica exatamente onde a hierarquia do rig a coloca", () => {
    const chain = solveLegChain(P, standing(), "L");
    // hips(P.hipY) → legRoot(-hipH*0.4) → thigh → shin → footH
    const expected = P.hipY - P.hipH * 0.4 - P.thigh - P.shin - P.footH;
    expect(chain.sole.y).toBeCloseTo(expected, 6);
    // e esse valor é NEGATIVO: é exatamente o afundamento que existia antes
    expect(expected).toBeLessThan(0);
  });

  it("joelho dobrado encurta a perna e sobe a sola", () => {
    const bent = standing();
    bent.kneeL = -1.2;
    const straight = solveLegChain(P, standing(), "L").sole.y;
    const flexed = solveLegChain(P, bent, "L").sole.y;
    expect(flexed).toBeGreaterThan(straight);
  });
});

describe("plantio no gramado", () => {
  it("corrige o afundamento herdado do offset da raiz da perna", () => {
    const r = solveGroundContact({ P, pose: standing(), dt: 1 });
    expect(r.lowestSole).toBeLessThan(0);
    expect(r.rootY).toBeCloseTo(-r.lowestSole, 3);
  });

  it("agachar não enterra o atleta", () => {
    const crouch = standing();
    crouch.hipY = -0.3;
    crouch.kneeL = -1.1;
    crouch.kneeR = -1.1;
    crouch.legLPitch = 0.7;
    crouch.legRPitch = 0.7;
    const r = solveGroundContact({ P, pose: crouch, dt: 1 });
    const soleAfter = r.lowestSole + r.rootY;
    expect(soleAfter).toBeCloseTo(0, 3);
  });

  it("inclinação do corpo não levanta nem enterra o pé de apoio", () => {
    for (const lean of [-0.2, -0.05, 0.12, 0.22]) {
      const r = solveGroundContact({ P, pose: standing(), leanX: lean, dt: 1 });
      expect(r.lowestSole + r.rootY).toBeCloseTo(0, 3);
    }
  });

  it("no ar, o atleta não é colado no gramado, mas nunca afunda", () => {
    const jump = standing();
    jump.hipY = 0.32;
    const r = solveGroundContact({ P, pose: jump, airborne: 1, dt: 1 });
    expect(r.rootY).toBeLessThanOrEqual(0.001);
    expect(r.lowestSole + r.rootY).toBeGreaterThanOrEqual(-0.001);
  });

  it("o pé apoiado fica paralelo ao gramado e o pé no ar mantém o clipe", () => {
    const stride = standing();
    stride.legLPitch = 0.9; // perna esquerda à frente, no ar
    stride.kneeL = -0.8;
    stride.ankleR = 0.35; // pé direito apoiado, ponta caída
    const r = solveGroundContact({ P, pose: stride, dt: 1 });
    expect(r.contactR).toBeGreaterThan(r.contactL);
    expect(Math.abs(r.ankleRFix)).toBeGreaterThan(Math.abs(r.ankleLFix));
  });

  it("o resultado é suavizado entre quadros, sem solavanco", () => {
    const a = solveGroundContact({ P, pose: standing(), previousRootY: 0, dt: 1 / 60 });
    const b = solveGroundContact({ P, pose: standing(), dt: 1 });
    expect(Math.abs(a.rootY)).toBeLessThan(Math.abs(b.rootY));
  });

  it("nunca devolve valores absurdos, mesmo com pose corrompida", () => {
    const broken = standing();
    broken.hipY = Number.NaN;
    clampPoseAnatomy(broken);
    const r = solveGroundContact({ P, pose: broken, dt: 1 });
    expect(Number.isFinite(r.rootY)).toBe(true);
    expect(Math.abs(r.rootY)).toBeLessThan(1);
  });
});

describe("limites anatômicos", () => {
  it("impede joelho invertido", () => {
    const p = standing();
    p.kneeL = 1.9;
    clampPoseAnatomy(p);
    expect(p.kneeL).toBeLessThanOrEqual(JOINT_LIMITS.kneeL![1]);
  });

  it("zera NaN em vez de propagar para a matriz do osso", () => {
    const p = standing();
    p.spine = Number.NaN;
    p.armLPitch = Number.POSITIVE_INFINITY;
    clampPoseAnatomy(p);
    expect(p.spine).toBe(0);
    expect(Number.isFinite(p.armLPitch)).toBe(true);
  });

  it("a pose travada não acusa mais excesso", () => {
    const p = standing();
    p.elbowL = -8;
    p.ankleR = 4;
    p.headYaw = -6;
    expect(poseExceedsLimits(p).length).toBeGreaterThan(0);
    clampPoseAnatomy(p);
    expect(poseExceedsLimits(p)).toEqual([]);
  });

  it("uma pose plausível passa intacta", () => {
    const p = standing();
    p.legLPitch = 0.6;
    p.kneeL = -1.0;
    p.ankleL = 0.2;
    const before = { ...p };
    clampPoseAnatomy(p);
    expect(p).toEqual(before);
  });
});

describe("detecção de voo", () => {
  it("clipes aéreos são reconhecidos pelo nome", () => {
    expect(airborneFactor("jumpHeader", 0)).toBeGreaterThan(0.5);
    expect(airborneFactor("gkDiveLeft", 0)).toBeGreaterThan(0.5);
  });

  it("correr no chão não é considerado voo", () => {
    expect(airborneFactor("run", 0)).toBe(0);
    expect(airborneFactor("sprint", 0.02)).toBeLessThan(0.1);
  });
});
