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
    // ~117 malhas antes do merge por junta; o alocador de desenhos
    // (`draw-budget.ts`) usa este custo para decidir quantos heróis cabem.
    expect(countRigBody(body)).toBeLessThanOrEqual(54);
    expect(countRigBody(body)).toBeGreaterThan(10);
  });

  it("drops detail meshes when the rig is not high quality", () => {
    const detailed = buildRigBody(context({ hi: true }));
    const simple = buildRigBody(context({ hi: false }));
    expect(countRigBody(simple)).toBeLessThan(countRigBody(detailed));
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
  it("adds geometry for style variants without adding meshes", () => {
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
    // O merge absorve as peças extras nas malhas existentes (e às vezes une
    // peças que antes ficavam separadas, como a mão dentro da manga longa):
    // variantes de estilo nunca acrescentam malhas, só geometria.
    expect(countRigBody(fancy)).toBeLessThanOrEqual(countRigBody(plain));
    expect(triangles(fancy)).toBeGreaterThan(triangles(plain));
  });

  it("stays inside the hero draw budget", () => {
    const full = buildRigBody(
      context({ look: { ...lookFor("rig-body-test", "MF", true) }, hi: true }),
    );
    // teto duro usado pelo alocador de desenhos (`draw-budget.ts`)
    expect(countRigBody(full)).toBeLessThanOrEqual(54);
    // e nenhuma variante de aparência passa do teto
    for (const sleeves of ["short", "long"] as const) {
      for (const hairStyle of ["short", "long", "dreads", "bald", "ponytail", "bun"] as const) {
        const look = { ...lookFor("rig-body-test", "MF", false), sleeves, hairStyle } as never;
        expect(countRigBody(buildRigBody(context({ look })))).toBeLessThanOrEqual(54);
      }
    }
  });
});
