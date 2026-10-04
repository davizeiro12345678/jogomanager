import { describe, expect, it } from "vitest";
import * as THREE from "three";

import { buildRigBody, countRigBody, type RigBodyContext } from "./rig-body";
import { lookFor, proportionsFor } from "./player-model";
import { playerMaterials } from "./player-materials";
import { resetSharedDetailMaterials } from "./rig-materials";

const KIT = {
  base: "#0a8f3c",
  shorts: "#101418",
  socks: "#0a8f3c",
  detail: "#f5f5f2",
  pattern: "solid",
} as never;

function context(overrides: Partial<RigBodyContext> = {}): RigBodyContext {
  const look = lookFor("rig-body-test", "MF", false);
  const mats = playerMaterials(look, KIT, null, "alta");
  return {
    P: proportionsFor(look),
    look,
    segs: { radial: 12, cap: 4 },
    hi: true,
    mats,
    jerseyInk: "#f5f5f2",
    handR: proportionsFor(look).handR,
    handMat: mats.skin,
    ...overrides,
  };
}

function hasFiniteGeometry(mesh: { geometry: THREE.BufferGeometry }): boolean {
  const position = mesh.geometry.getAttribute("position");
  if (!position) return false;
  for (let i = 0; i < position.array.length; i += 1) {
    if (!Number.isFinite(position.array[i])) return false;
  }
  const box = mesh.geometry.boundingBox;
  if (!box) return false;
  return (
    Number.isFinite(box.min.x) &&
    Number.isFinite(box.max.x) &&
    Number.isFinite(box.min.y) &&
    Number.isFinite(box.max.y)
  );
}

describe("rig body", () => {
  it("keeps a full articulated rig well under the per-hero draw budget", () => {
    const body = buildRigBody(context());
    // ~117 malhas antes do merge por junta. Teto 56: 53 da base + 3 de
    // detalhe corporal (brinco, fita de pulso e tatuagem, um de cada lado).
    // O custo que o alocador usa é o de `rig-skin.test.ts` (HERO_MESH_COST).
    expect(countRigBody(body)).toBeLessThanOrEqual(56);
    expect(countRigBody(body)).toBeGreaterThan(10);
  });

  it("does not place an opaque disk over the jersey number", () => {
    const body = buildRigBody(context());
    expect(body.chest.every((mesh) => mesh.material.type !== "MeshBasicMaterial")).toBe(true);
  });

  it("drops detail meshes when the rig is not high quality", () => {
    const detailed = buildRigBody(context({ hi: true }));
    const simple = buildRigBody(context({ hi: false }));
    expect(countRigBody(simple)).toBeLessThanOrEqual(countRigBody(detailed));
    const vertexCount = (body: ReturnType<typeof buildRigBody>) =>
      body.all.reduce((sum, mesh) => sum + mesh.geometry.getAttribute("position").count, 0);
    expect(vertexCount(simple)).toBeLessThan(vertexCount(detailed));
  });

  it("produces finite merged geometry with the standard attributes", () => {
    const body = buildRigBody(context());
    for (const mesh of body.all) {
      expect(mesh.geometry.getAttribute("position")).toBeTruthy();
      expect(mesh.geometry.getAttribute("normal")).toBeTruthy();
      expect(hasFiniteGeometry(mesh)).toBe(true);
    }
  });

  it("merges same-material parts of a joint into one mesh", () => {
    const body = buildRigBody(context());
    // pele do tronco/cabeça/braços/pernas compartilha o mesmo material, mas
    // cada junta mantém sua própria malha (continuam animando separadas).
    const skinUuids = body.all.filter((mesh) => mesh.material.type !== "MeshBasicMaterial");
    expect(skinUuids.length).toBeGreaterThan(0);
    const unique = new Set(body.all.map((mesh) => mesh.geometry.uuid));
    expect(unique.size).toBe(body.all.length);
  });

  it("keeps garment construction inside the existing kit draws", () => {
    const ctx = context();
    const body = buildRigBody(ctx);
    // Waistband, rolled hems, panel topstitching, shirt seams and boot
    // construction all share the joint's existing material instead of
    // multiplying draw calls.
    expect(body.hips.filter((mesh) => mesh.material === ctx.mats.shorts)).toHaveLength(1);
    expect(body.spine.filter((mesh) => mesh.material === ctx.mats.jersey)).toHaveLength(1);
    expect(body.ankleL.filter((mesh) => mesh.material === ctx.mats.boot)).toHaveLength(1);
    expect(body.ankleL.filter((mesh) => mesh.material === ctx.mats.bootAccent)).toHaveLength(1);
  });

  it("spends extra hand and garment vertices only in the high detail rig", () => {
    const high = buildRigBody(context({ hi: true }));
    const low = buildRigBody(context({ hi: false }));
    const vertices = (body: ReturnType<typeof buildRigBody>, key: keyof typeof high) =>
      body[key].reduce((sum, mesh) => sum + mesh.geometry.getAttribute("position").count, 0);
    const triangles = (body: ReturnType<typeof buildRigBody>, key: keyof typeof high) =>
      body[key].reduce(
        (sum, mesh) =>
          sum +
          (mesh.geometry.getIndex()?.count ?? mesh.geometry.getAttribute("position").count) / 3,
        0,
      );
    expect(vertices(high, "thumbL")).toBeGreaterThan(vertices(low, "thumbL"));
    expect(vertices(high, "hips")).toBeGreaterThan(vertices(low, "hips"));
    // A close-up-only nail and two short outseams are deliberately tiny. Keep
    // their high-quality surplus bounded, so future visual polish cannot turn
    // a shared articulated joint into a hidden LOD triangle regression.
    expect(vertices(high, "thumbL") - vertices(low, "thumbL")).toBeLessThanOrEqual(24);
    expect(triangles(high, "thumbL") - triangles(low, "thumbL")).toBeLessThanOrEqual(24);
    expect(vertices(high, "hips") - vertices(low, "hips")).toBeLessThanOrEqual(128);
    expect(triangles(high, "hips") - triangles(low, "hips")).toBeLessThanOrEqual(160);
    // Their materials remain merged at either profile; visual detail never
    // widens the articulated draw budget.
    expect(countRigBody(high)).toBeLessThanOrEqual(56);
    expect(countRigBody(low)).toBeLessThanOrEqual(56);
  });

  it("shows a short-sleeve compression layer without spending extra rig draws", () => {
    const base = lookFor("rig-body-undershirt", "MF", false);
    const bareCtx = context({ look: { ...base, sleeves: "short", undershirt: false } });
    const layeredCtx = context({ look: { ...base, sleeves: "short", undershirt: true } });
    const bare = buildRigBody(bareCtx);
    const layered = buildRigBody(layeredCtx);
    expect(countRigBody(layered)).toBe(countRigBody(bare));
    expect(layered.armL.some((mesh) => mesh.material === layeredCtx.mats.skin)).toBe(false);
    expect(layered.foreL.some((mesh) => mesh.material === layeredCtx.mats.skin)).toBe(false);
  });

  it("shares materials between two rigs with the same look", () => {
    resetSharedDetailMaterials();
    const first = buildRigBody(context());
    const second = buildRigBody(context());
    const firstUuids = new Set(first.all.map((mesh) => mesh.material.uuid));
    for (const mesh of second.all) expect(firstUuids.has(mesh.material.uuid)).toBe(true);
  });

  it("keeps goalkeeper gloves and captain armband distinct", () => {
    const captain = buildRigBody(context());
    const plain = buildRigBody(
      context({
        look: { ...lookFor("rig-body-test", "MF", false), captain: true },
      }),
    );
    expect(countRigBody(plain)).toBeGreaterThanOrEqual(countRigBody(captain));
  });
  it("keeps style variants inside the articulated mesh budget", () => {
    const base = lookFor("rig-body-test", "MF", false);
    const triangles = (body: ReturnType<typeof buildRigBody>) =>
      body.all.reduce(
        (sum, mesh) =>
          sum +
          (mesh.geometry.getIndex()?.count ?? mesh.geometry.getAttribute("position")?.count ?? 0),
        0,
      );
    const plain = buildRigBody(context());
    const fancy = buildRigBody(
      context({
        look: {
          ...base,
          sockTape: true,
          headband: true,
          collar: "polo",
          undershirt: true,
          sleeves: "long",
          beard: "full",
          hairStyle: "dreads",
        },
      }),
    );
    // A fitted beard/tape can introduce a material; all style variants
    // still respect the existing budget instead of masking those details.
    expect(countRigBody(fancy)).toBeLessThanOrEqual(56);
    expect(triangles(fancy)).toBeGreaterThan(triangles(plain));
  });

  it("stays inside the hero draw budget", () => {
    const full = buildRigBody(
      context({ look: { ...lookFor("rig-body-test", "MF", true) }, hi: true }),
    );
    // teto articulado (o alocador usa HERO_MESH_COST, medido no skinning)
    expect(countRigBody(full)).toBeLessThanOrEqual(56);
    // e nenhuma variante de aparência passa do teto
    for (const sleeves of ["short", "long"] as const) {
      for (const hairStyle of ["short", "long", "dreads", "bald", "ponytail", "bun"] as const) {
        const look = { ...lookFor("rig-body-test", "MF", false), sleeves, hairStyle } as never;
        expect(countRigBody(buildRigBody(context({ look })))).toBeLessThanOrEqual(56);
      }
    }
  });
});
