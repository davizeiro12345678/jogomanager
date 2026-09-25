import { describe, expect, it } from "vitest";
import * as THREE from "three";

import {
  censusBudgetUse,
  censusDraws,
  censusFitsBudget,
  censusScene,
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
