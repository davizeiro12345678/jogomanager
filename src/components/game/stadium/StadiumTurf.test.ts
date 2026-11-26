import { act, createRoot, extend } from "@react-three/fiber";
import { createElement, Fragment } from "react";
import {
  CircleGeometry,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
} from "three";
import { expect, it, vi } from "vitest";
import type { SimView } from "@/game/sim-contracts";
import { Pitch } from "./StadiumTurf";
import { turfDetailTextures } from "./textures/turf-detail";

vi.mock("./GrassChunks", () => ({ GrassChunks: () => null }));
vi.mock("./StadiumGoals", () => ({ Goal: () => null, CornerFlags: () => null }));

it("keeps procedural turf detail through preset promotion and releases it at the last downgrade", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  extend({
    CircleGeometry,
    Group,
    InstancedMesh,
    Mesh,
    MeshBasicMaterial,
    MeshStandardMaterial,
    PlaneGeometry,
  });
  const root = createRoot(new EventTarget());
  const sim = { home: { clubId: "test-home" } } as SimView;
  const pitches = (quality: "baixa" | "media", second = false) =>
    createElement(
      Fragment,
      null,
      createElement(Pitch, { key: "first", quality, sim, wet: 0, mow: "stripes", webgl2: true }),
      second
        ? createElement(Pitch, {
            key: "second",
            quality: "media",
            sim,
            wet: 0,
            mow: "stripes",
            webgl2: true,
          })
        : null,
    );
  const gl = {
    domElement: new EventTarget(),
    render() {},
    setPixelRatio() {},
    setSize() {},
  };

  try {
    await act(async () => {
      await root.configure({ gl, frameloop: "never" });
      root.render(pitches("baixa"));
    });
    await act(async () => {
      root.render(pitches("media"));
    });
    const { normal } = turfDetailTextures();
    const dispose = vi.spyOn(normal, "dispose");
    await act(async () => {
      root.render(pitches("media", true));
    });
    await act(async () => {
      root.render(pitches("media"));
    });
    expect(dispose).not.toHaveBeenCalled();
    await act(async () => {
      root.render(pitches("baixa"));
    });
    expect(dispose).toHaveBeenCalledTimes(1);
  } finally {
    await act(async () => root.unmount());
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  }
});
