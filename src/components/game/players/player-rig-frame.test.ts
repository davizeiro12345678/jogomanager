import { expect, it, vi } from "vitest";
import * as THREE from "three";
import { buildTeamSetup } from "@/game/quickMatch";
import { MatchSim } from "@/game/sim";
import { lookFor, proportionsFor } from "@/game/player-model";
import { faceMorphology } from "@/game/player-morphology";
import { playerMaterials } from "@/game/player-materials";
import { buildRigSkin } from "@/game/rig-skin";
import { AthleteCloth } from "@/game/athlete-cloth";
import { usePlayerRigFrame } from "./player-rig-frame";

const harness = vi.hoisted(() => ({
  frame: null as null | ((state: unknown, dt: number) => void),
}));
vi.mock("@react-three/fiber", () => ({
  useFrame: (frame: typeof harness.frame) => {
    harness.frame = frame;
  },
}));
// Run the real render callback against real bones without opening WebGL.
// React only supplies per-component persistent storage to this hook.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useMemo: (factory: () => unknown) => factory(),
  useRef: (current: unknown) => ({ current }),
}));

function RigFrameHarness(input: Parameters<typeof usePlayerRigFrame>[0]) {
  usePlayerRigFrame(input);
  return null;
}

it("writes the same authored impact to real rig bones at 10/20/30/60 Hz without changing the match", () => {
  const contacts: number[][] = [];
  for (const hz of [10, 20, 30, 60]) {
    const sim = new MatchSim(
      buildTeamSetup("fla"),
      buildTeamSetup("pal"),
      "render-impact-real-rig",
    );
    const player = sim.players.find((candidate) => candidate.pos !== "GK")!;
    player.x = 0;
    player.z = 0;
    player.vx = 0;
    player.vz = 0;
    player.action = "shotPower";
    player.actionDur = 1;
    player.actionT = 1;
    sim.ball.x = 0;
    sim.ball.z = 20;
    sim.ball.height = 0.11;
    const look = lookFor(player.pid, player.pos);
    const P = proportionsFor(look);
    const kit = {
      base: "#0a8f3c",
      shorts: "#101418",
      socks: "#0a8f3c",
      detail: "#f5f5f2",
      pattern: "solid",
    } as never;
    const mats = playerMaterials(look, kit, null, "alta");
    const skin = buildRigSkin(
      {
        P,
        look,
        segs: { radial: 12, cap: 4 },
        hi: false,
        mats,
        jerseyInk: "#fff",
        handR: P.handR,
        handMat: mats.skin,
      },
      [0, 0, 0],
    );
    const root = new THREE.Group();
    root.add(skin.root);
    const bones = Object.fromEntries(
      Object.entries(skin.boneOf).map(([name, bone]) => [name, { current: bone }]),
    );
    let frames = 0;
    RigFrameHarness({
      scene: {
        player,
        sim,
        goalPulse: { current: 0 },
        goalFocus: undefined,
        look,
        proportions: P,
        facialShape: faceMorphology(look.seed),
        quality: "alta",
        portrait: false,
        denseGeometry: false,
        hi: false,
        shadows: false,
        paused: false,
        previewClip: undefined,
        previewAt: undefined,
        wet: 0,
        onPoseReady: () => {
          frames++;
        },
      },
      resources: {
        root: { current: root },
        shadowRef: { current: null },
        bones: bones as never,
        painted: { current: false },
        lodState: { current: null },
        castState: { current: null },
        nearMeshes: { current: [] },
        bootMeshes: { current: [] },
        skin,
        cloth: new AthleteCloth(skin, P, false),
      },
    });
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 2, 8);
    camera.updateMatrixWorld();
    const state = { camera, clock: { elapsedTime: 0 } };
    for (let i = 0; i <= hz * 0.4; i++) {
      const t = i / hz;
      state.clock.elapsedTime = t;
      player.actionT = 1 - t;
      const canonical = JSON.stringify({
        player,
        ball: sim.ball,
        time: sim.time,
        stats: sim.stats,
      });
      harness.frame!(state, i === 0 ? 0 : 1 / hz);
      expect(JSON.stringify({ player, ball: sim.ball, time: sim.time, stats: sim.stats })).toBe(
        canonical,
      );
      root.updateMatrixWorld(true);
      expect(skin.bones.every((bone) => bone.matrixWorld.elements.every(Number.isFinite))).toBe(
        true,
      );
    }
    expect(frames).toBe(hz * 0.4 + 1);
    contacts.push([
      skin.boneOf.legL.rotation.x,
      skin.boneOf.legR.rotation.x,
      skin.boneOf.kneeL.rotation.x,
      skin.boneOf.kneeR.rotation.x,
    ]);
    expect(contacts.at(-1)!.some((angle) => Math.abs(angle) > 0.1)).toBe(true);
    skin.dispose();
    sim.dispose();
  }
  for (const contact of contacts)
    for (let joint = 0; joint < contact.length; joint++)
      expect(contact[joint]).toBeCloseTo(contacts[0]![joint]!, 11);
});
