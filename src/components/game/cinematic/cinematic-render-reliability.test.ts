import { act, createElement } from "react";
import { createRoot, extend } from "@react-three/fiber";
import * as THREE from "three";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CinematicActor } from "./CinematicActor";
import { CinematicCrowd } from "./CinematicCrowd";
import { CinematicMotivatedLight } from "./CinematicMotivatedLight";
import { CinematicContext, type CinematicRuntimeState } from "./cinematic-runtime";

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  extend({
    Group: THREE.Group,
    Mesh: THREE.Mesh,
    InstancedMesh: THREE.InstancedMesh,
    BoxGeometry: THREE.BoxGeometry,
    LatheGeometry: THREE.LatheGeometry,
    TorusGeometry: THREE.TorusGeometry,
    CapsuleGeometry: THREE.CapsuleGeometry,
    SphereGeometry: THREE.SphereGeometry,
    MeshStandardMaterial: THREE.MeshStandardMaterial,
    PointLight: THREE.PointLight,
  });
});
afterEach(() => vi.unstubAllGlobals());
async function stage(child: ReturnType<typeof createElement>) {
  const canvas = {} as HTMLCanvasElement;
  const root = createRoot(canvas);
  const runtime: CinematicRuntimeState = {
    clock: { time: 0, dt: 0, lineTime: 0 },
    frames: new Set(),
    focus: new THREE.Vector3(),
    quality: "baixa",
    stopped: false,
    reduced: false,
  };
  await root.configure({
    gl: {
      render() {},
      setPixelRatio() {},
      setSize() {},
      domElement: canvas,
      shadowMap: {},
    } as unknown as THREE.WebGLRenderer,
    frameloop: "never",
    size: { width: 100, height: 100, top: 0, left: 0 },
  });
  let scene!: THREE.Scene;
  const render = async (next: ReturnType<typeof createElement> | null) => {
    await act(async () => {
      scene = root
        .render(createElement(CinematicContext.Provider, { value: runtime }, next))
        .getState().scene;
    });
  };
  await render(child);
  return { root, runtime, scene, render };
}

it("releases declarative trophy resources once while preserving explicit skin ownership", async () => {
  const mounted = await stage(
    createElement(CinematicActor, { x: 0, z: 0, color: "#ad3030", holdingTrophy: true }),
  );
  const geometry: THREE.BufferGeometry[] = [],
    materials: THREE.Material[] = [];
  const skinGeometry: THREE.BufferGeometry[] = [];
  let skeleton: THREE.Skeleton | undefined;
  mounted.scene.traverse((object) => {
    if (object instanceof THREE.SkinnedMesh) {
      skinGeometry.push(object.geometry);
      skeleton = object.skeleton;
    }
    if (object instanceof THREE.Mesh && !(object instanceof THREE.SkinnedMesh)) {
      geometry.push(object.geometry);
      materials.push(...(Array.isArray(object.material) ? object.material : [object.material]));
    }
  });
  expect(geometry.length).toBeGreaterThan(0);
  const geometryDisposals = [...new Set(geometry)].map((item) => vi.spyOn(item, "dispose"));
  const materialDisposals = [...new Set(materials)].map((item) => vi.spyOn(item, "dispose"));
  const skinDisposals = [...new Set(skinGeometry)].map((item) => vi.spyOn(item, "dispose"));
  const skeletonDisposal = vi.spyOn(skeleton!, "dispose");
  await mounted.render(null);
  geometryDisposals.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
  materialDisposals.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
  skinDisposals.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
  expect(skeletonDisposal).toHaveBeenCalledTimes(1);
  expect(mounted.runtime.frames.size).toBe(0);
  await act(async () => mounted.root.unmount());
});

it("keeps static crowd legs and their GPU buffer unchanged after initialization", async () => {
  const mounted = await stage(createElement(CinematicCrowd, { rows: 2, cols: 3, tint: "#ad3030" }));
  const meshes = mounted.scene.children[0]!.children as THREE.InstancedMesh[];
  mounted.runtime.frames.forEach((frame) => frame(0, 0));
  const legs = meshes[4]!,
    arms = meshes[3]!;
  const initialLegs = Array.from(legs.instanceMatrix.array),
    legVersion = legs.instanceMatrix.version;
  const legsWrite = vi.spyOn(legs, "setMatrixAt"),
    armsWrite = vi.spyOn(arms, "setMatrixAt");
  mounted.runtime.frames.forEach((frame) => frame(1, 1 / 30));
  expect(legsWrite).toHaveBeenCalledTimes(0);
  expect(armsWrite).toHaveBeenCalledTimes(12);
  expect(Array.from(legs.instanceMatrix.array)).toEqual(initialLegs);
  expect(legs.instanceMatrix.version).toBe(legVersion);
  await mounted.render(createElement(CinematicCrowd, { rows: 2, cols: 3, y: 6, tint: "#0033ee" }));
  mounted.runtime.frames.forEach((frame) => frame(1, 0));
  expect(legsWrite).toHaveBeenCalledTimes(12);
  expect(legs.instanceMatrix.version).toBe(legVersion + 1);
  expect(Array.from(legs.instanceMatrix.array)).not.toEqual(initialLegs);
  const color = new THREE.Color();
  const updatedColors = Array.from({ length: 6 }, (_, index) => {
    meshes[0]!.getColorAt(index, color);
    return color.getHexString();
  });
  expect(updatedColors).toContain("0033ee");
  expect(updatedColors).not.toContain("ad3030");
  await act(async () => mounted.root.unmount());
});

it("applies a changed practical-light color while paused and retains running fades", async () => {
  const lighting = (light: "quente" | "fria") =>
    createElement(CinematicMotivatedLight, {
      kind: "office",
      art: "dressing",
      mood: "neutral",
      light,
      quality: "media",
    });
  const mounted = await stage(lighting("quente"));
  mounted.runtime.stopped = true;
  mounted.runtime.frames.forEach((frame) => frame(0, 0));
  const source = mounted.scene.children[0] as THREE.PointLight;
  expect(source.color.getHexString()).toBe("ffc987");
  await mounted.render(lighting("fria"));
  mounted.runtime.frames.forEach((frame) => frame(0, 0));
  expect(source.color.getHexString()).toBe("a9c8ff");
  mounted.runtime.stopped = false;
  await mounted.render(lighting("quente"));
  mounted.runtime.frames.forEach((frame) => frame(1 / 60, 1 / 60));
  expect(source.color.getHexString()).not.toBe("a9c8ff");
  expect(source.color.getHexString()).not.toBe("ffc987");
  await act(async () => mounted.root.unmount());
});
