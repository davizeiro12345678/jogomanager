import { describe, expect, it } from "vitest";
import * as THREE from "three";

import {
  censusBudgetUse,
  censusDraws,
  censusFitsBudget,
  censusScene,
  createNonHeroDrawCounter,
  formatCensus,
  tagCensus,
} from "./scene-census";

function mesh(triangles = 1, castShadow = false): THREE.Mesh {
  // caixa unitária: 12 triângulos por caixa
  const geometry = new THREE.BoxGeometry();
  geometry.deleteAttribute("uv");
  const object = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  object.castShadow = castShadow;
  void triangles;
  return object;
}

function instanced(count: number): THREE.InstancedMesh {
  const object = new THREE.InstancedMesh(
    new THREE.BoxGeometry(),
    new THREE.MeshBasicMaterial(),
    count,
  );
  return object;
}

describe("scene census", () => {
  it("matches non-hero draw and shadow budgets without reading material or geometry", () => {
    const scene = new THREE.Scene();
    const heroes = new THREE.Group();
    tagCensus(heroes, "player");
    heroes.add(mesh(1, true));
    const nested = mesh(1, true);
    tagCensus(nested, "props");
    heroes.add(nested);
    const low = mesh(1, true);
    tagCensus(low, "playerLow");
    const hidden = new THREE.Group();
    hidden.visible = false;
    hidden.add(mesh(1, true));
    scene.add(heroes, low, hidden, instanced(0));
    const full = censusScene(scene);
    const expected =
      full.total.draws +
      full.total.shadowCasters -
      full.buckets.player.draws -
      full.buckets.player.shadowCasters;
    const counter = createNonHeroDrawCounter();
    expect(counter(scene)).toBe(expected);
    Object.defineProperty(low, "geometry", {
      get: () => {
        throw new Error("expensive geometry accessed");
      },
    });
    Object.defineProperty(low, "material", {
      get: () => {
        throw new Error("expensive material accessed");
      },
    });
    expect(counter(scene)).toBe(expected);
    low.visible = false;
    expect(counter(scene)).toBe(expected - 2);
    expect(counter(new THREE.Scene())).toBe(0);
  });
  it("estimates unique visible geometry and texture memory without multiplying shared assets", () => {
    const scene = new THREE.Scene();
    const geometry = new THREE.BoxGeometry();
    const texture = new THREE.DataTexture(new Uint8Array(4 * 4 * 4), 4, 4);
    const material = new THREE.MeshBasicMaterial({ map: texture });
    const first = new THREE.Mesh(geometry, material);
    const second = new THREE.Mesh(geometry, material);
    tagCensus(first, "props");
    tagCensus(second, "props");
    scene.add(first, second);

    const geometryBytes = Object.values(geometry.attributes).reduce(
      (sum, attribute) => sum + attribute.array.byteLength,
      geometry.index?.array.byteLength ?? 0,
    );
    const census = censusScene(scene);
    expect(census.total.geometryBytes).toBe(geometryBytes);
    expect(census.total.textureBytes).toBe(4 * 4 * 4);
    expect(census.total.draws).toBe(2);
  });

  it("classifies renderables by the nearest tagged ancestor", () => {
    const scene = new THREE.Scene();
    const players = new THREE.Group();
    tagCensus(players, "player");
    players.add(mesh(), mesh());
    const crowd = new THREE.Group();
    tagCensus(crowd, "crowd");
    crowd.add(instanced(300));
    scene.add(players, crowd, mesh());

    const census = censusScene(scene);
    expect(censusDraws(census, "player")).toBe(2);
    expect(censusDraws(census, "crowd")).toBe(1);
    expect(censusDraws(census, "other")).toBe(1);
    expect(census.total.draws).toBe(4);
  });

  it("counts instanced triangles per live instance and ignores empty batches", () => {
    const scene = new THREE.Scene();
    const crowd = new THREE.Group();
    tagCensus(crowd, "crowd");
    crowd.add(instanced(300));
    crowd.add(instanced(0));
    scene.add(crowd);

    const census = censusScene(scene);
    expect(census.buckets.crowd.triangles).toBe(300 * 12);
    expect(census.total.triangles).toBe(300 * 12);
  });

  it("skips invisible objects but keeps their tagged ancestors", () => {
    const scene = new THREE.Scene();
    const grass = new THREE.Group();
    tagCensus(grass, "grass");
    const hidden = mesh();
    hidden.visible = false;
    grass.add(hidden, mesh());
    scene.add(grass);

    const census = censusScene(scene);
    expect(censusDraws(census, "grass")).toBe(1);
  });

  it("tracks shadow casters and distinct materials", () => {
    const scene = new THREE.Scene();
    const goal = new THREE.Group();
    tagCensus(goal, "goal");
    goal.add(mesh(1, true), mesh(1, true), mesh(1, false));
    scene.add(goal);

    const census = censusScene(scene);
    expect(census.buckets.goal.shadowCasters).toBe(2);
    expect(census.materials).toBe(3);
  });

  it("compares against the tier draw-call contract", () => {
    const scene = new THREE.Scene();
    const players = new THREE.Group();
    tagCensus(players, "player");
    for (let i = 0; i < 300; i += 1) players.add(mesh());
    scene.add(players);

    const census = censusScene(scene);
    expect(censusFitsBudget(census, "alta")).toBe(false);
    expect(censusFitsBudget(census, "cinema")).toBe(true);
    expect(censusBudgetUse(census, "alta")).toBeCloseTo(300 / 260, 5);
    expect(formatCensus(census)).toBe("player 300");
  });

  it("keeps a child tag from leaking into sibling branches", () => {
    const scene = new THREE.Scene();
    const root = new THREE.Group();
    tagCensus(root, "props");
    const nested = new THREE.Group();
    tagCensus(nested, "ball");
    nested.add(mesh());
    root.add(nested, mesh());
    scene.add(root);

    const census = censusScene(scene);
    expect(censusDraws(census, "ball")).toBe(1);
    expect(censusDraws(census, "props")).toBe(1);
  });
});
