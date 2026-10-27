import { afterEach, expect, it, vi } from "vitest";
import * as THREE from "three";
import type { RootState } from "@react-three/fiber";
import type { SimView } from "./sim";

const hooks = vi.hoisted(() => ({
  frames: [] as ((state: unknown, dt: number) => void)[],
  updates: [] as unknown[],
}));
vi.mock("@react-three/fiber", () => ({
  useFrame: (callback: (state: unknown, dt: number) => void) => hooks.frames.push(callback),
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useEffect: () => undefined,
  useMemo: <T>(factory: () => T) => factory(),
  useRef: <T>(current: T) => ({ current }),
  useState: <T>(initial: T | (() => T)) => [
    typeof initial === "function" ? (initial as () => T)() : initial,
    (value: unknown) => hooks.updates.push(value),
  ],
}));
import { MatchPlayers } from "../components/game/players/MatchPlayers";
import { kitFor } from "./kits";
import { resolveRuntimeSceneBudget } from "./runtime-scene-budget";

afterEach(() => {
  hooks.frames.length = 0;
  hooks.updates.length = 0;
});
it("demotes the articulated rig when the mobile scene has no headroom, while retaining the instanced team", () => {
  const scene = new THREE.Scene();
  for (let i = 0; i < 85; i++)
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()));
  const sim = {
    home: { clubId: "fla" },
    away: { clubId: "pal" },
    players: [],
  } as unknown as SimView;
  const tree = MatchPlayers({
    sim,
    homeKit: kitFor("fla", "#cc0000", "#000000"),
    awayKit: kitFor("pal", "#006633", "#ffffff"),
    goalPulse: { current: 0 },
    goalFocus: { current: null },
    quality: "media",
    mode: "broadcast",
    replay: false,
    budget: resolveRuntimeSceneBudget("media", 0, true),
  });
  const state = { scene, camera: new THREE.PerspectiveCamera() } as RootState;
  hooks.frames[0]!(state, 0.01);
  hooks.frames[0]!(state, 0.6);
  expect(hooks.updates).toContain(0);
  expect(tree.props.children[0].props.sim).toBe(sim);
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      object.material.dispose();
    }
  });
});
