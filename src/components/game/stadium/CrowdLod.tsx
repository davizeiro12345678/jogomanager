import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { CROWD_MOTION_GLSL } from "@/game/crowd-motion";
import { supporterGeometry } from "@/game/crowd-geometry";
import { crowdLodMaterial } from "@/game/crowd-lod-material";

import { resolveRuntimeSceneBudget, type RuntimeSceneBudget } from "@/game/runtime-scene-budget";
import { censusRef } from "@/game/scene-census";
import {
  CrowdFallbackBuffers,
  createCrowdVisibilityLayout,
  selectCrowdFallback,
} from "@/game/wasm/crowd-visibility";
import { CrowdWorkerClient } from "@/game/wasm/crowd-worker-client";
import { presentationWorkerCount } from "@/game/device-workload";
import { prepareSharedSeatBuffers } from "@/game/wasm/shared-seat-transforms";
import { acquirePresentationLanes } from "@/game/presentation-lanes";

type CrowdData = { positions: THREE.Vector3[]; colors: THREE.Color[]; skins: THREE.Color[] };
type CrowdTile = { indices: number[]; sphere: THREE.Sphere; distance: number };
type CrowdSeatUpload = Readonly<{
  matrices: Float32Array;
  colors: Float32Array;
  skins: Float32Array;
  styles: Float32Array;
}>;

const TILE_SECTORS = 12;
const TILE_RINGS = 3;
const MAX_CROWD_INSTANCES = 5_120;

function prepareSeatUpload(crowd: CrowdData): CrowdSeatUpload {
  const matrices = new Float32Array(crowd.positions.length * 16);
  const colors = new Float32Array(crowd.positions.length * 3);
  const skins = new Float32Array(crowd.positions.length * 3);
  const styles = new Float32Array(crowd.positions.length * 2);
  const dummy = new THREE.Object3D();
  for (let index = 0; index < crowd.positions.length; index += 1) {
    const position = crowd.positions[index]!;
    const height = 0.9 + (index % 7) * 0.025;
    dummy.position.copy(position);
    dummy.scale.set(height * (0.92 + (index % 3) * 0.06), height, height);
    dummy.rotation.set(0, Math.atan2(-position.x, -position.z), 0);
    dummy.updateMatrix();
    matrices.set(dummy.matrix.elements, index * 16);
    const color = crowd.colors[index]!;
    const offset = index * 3;
    colors[offset] = color.r;
    colors[offset + 1] = color.g;
    colors[offset + 2] = color.b;
    const skin = crowd.skins[index]!;
    skins[offset] = skin.r;
    skins[offset + 1] = skin.g;
    skins[offset + 2] = skin.b;
    styles[index * 2] = (index % 13) / 12;
    styles[index * 2 + 1] = (index % 11) / 10;
  }
  return { matrices, colors, skins, styles };
}

function copySeatAttribute(
  target: Float32Array,
  values: Float32Array,
  width: number,
  seat: number,
  instance: number,
) {
  const targetOffset = instance * width;
  const sourceOffset = seat * width;
  for (let channel = 0; channel < width; channel += 1)
    target[targetOffset + channel] = values[sourceOffset + channel]!;
}

function copySeatToInstance(
  mesh: THREE.InstancedMesh,
  seat: number,
  instance: number,
  source: CrowdSeatUpload,
) {
  copySeatAttribute(mesh.instanceMatrix.array as Float32Array, source.matrices, 16, seat, instance);
  mesh.instanceColor ??= new THREE.InstancedBufferAttribute(
    new Float32Array(mesh.instanceMatrix.count * 3),
    3,
  ).setUsage(THREE.DynamicDrawUsage);
  copySeatAttribute(mesh.instanceColor.array as Float32Array, source.colors, 3, seat, instance);
  copySeatAttribute(
    (mesh.geometry.getAttribute("crowdSkin") as THREE.InstancedBufferAttribute)
      .array as Float32Array,
    source.skins,
    3,
    seat,
    instance,
  );
  copySeatAttribute(
    (mesh.geometry.getAttribute("crowdStyle") as THREE.InstancedBufferAttribute)
      .array as Float32Array,
    source.styles,
    2,
    seat,
    instance,
  );
}

function crowdCard() {
  if (typeof document === "undefined") return new THREE.Texture();
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 128;
  const c = canvas.getContext("2d")!;
  c.fillStyle = "#ffffff";
  c.beginPath();
  c.ellipse(32, 20, 11, 14, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#ffffff";
  c.beginPath();
  c.ellipse(32, 12, 11, 7, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#ffffff";
  c.beginPath();
  c.moveTo(17, 37);
  c.lineTo(47, 37);
  c.lineTo(55, 81);
  c.lineTo(10, 81);
  c.closePath();
  c.fill();
  c.fillStyle = "#ffffff";
  c.fillRect(18, 81, 12, 42);
  c.fillRect(34, 81, 12, 42);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function tileIndex(position: THREE.Vector3) {
  const angle = Math.atan2(position.z, position.x);
  const sector = Math.min(
    TILE_SECTORS - 1,
    Math.max(0, Math.floor(((angle + Math.PI) / (Math.PI * 2)) * TILE_SECTORS)),
  );
  const ring = Math.min(TILE_RINGS - 1, Math.max(0, Math.floor((position.y - 2.4) / 6.2)));
  return ring * TILE_SECTORS + sector;
}

function buildTiles(positions: THREE.Vector3[]): CrowdTile[] {
  const buckets = Array.from({ length: TILE_SECTORS * TILE_RINGS }, () => [] as number[]);
  positions.forEach((position, index) => buckets[tileIndex(position)]!.push(index));
  return buckets
    .filter((indices) => indices.length > 0)
    .map((indices) => {
      const center = new THREE.Vector3();
      indices.forEach((index) => center.add(positions[index]!));
      center.multiplyScalar(1 / indices.length);
      let radius = 1;
      indices.forEach((index) => {
        radius = Math.max(radius, center.distanceTo(positions[index]!));
      });
      return { indices, sphere: new THREE.Sphere(center, radius + 1.8), distance: 0 };
    });
}

/**
 * The former LOD pass walked every spectator, rewrote all matrices and rebuilt
 * each bounding sphere four times per second. Seats are now spatial tiles: the
 * camera selects bounded stands, and fixed instance pools only receive visible
 * sectors that a viewer can actually read.
 */
export function CrowdLod({
  crowd,
  pulse,
  budget,
  supporters,
  webgl2 = true,
}: {
  crowd: CrowdData;
  pulse: React.MutableRefObject<number>;
  budget: Pick<
    RuntimeSceneBudget,
    "crowdInstances" | "crowdVisibleTiles" | "crowdUpdateSeconds" | "stage" | "tier"
  >;
  supporters?: import("@/game/career-world-types").SupporterMatchday | undefined;
  /** Native WebGPU keeps the same instance pools, without GLSL-only motion hooks. */
  webgl2?: boolean;
}) {
  const capacity = Math.min(
    MAX_CROWD_INSTANCES,
    resolveRuntimeSceneBudget(budget.tier).crowdInstances,
  );
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const meshRefs = useMemo(
    () =>
      [0, 1, 2].map((tier) => (mesh: THREE.InstancedMesh | null) => {
        const previous = refs.current[tier];
        if (previous && previous !== mesh) previous.dispose();
        refs.current[tier] = mesh;
        mesh?.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      }),
    [],
  );
  const tiles = useMemo(() => buildTiles(crowd.positions), [crowd.positions]);
  const layout = useMemo(
    () =>
      createCrowdVisibilityLayout(
        crowd.positions,
        tiles.map((tile) => ({
          indices: tile.indices,
          center: tile.sphere.center,
          radius: tile.sphere.radius,
        })),
      ),
    [crowd.positions, tiles],
  );
  const worker = useRef<CrowdWorkerClient | null>(null);
  const fallbackBuffers = useMemo(() => new CrowdFallbackBuffers(layout), [layout]);
  const hasSelection = useRef(false);
  const [seatState, setSeatState] = useState<{ crowd: CrowdData; buffers: CrowdSeatUpload } | null>(
    null,
  );
  const seatUpload = seatState?.crowd === crowd ? seatState.buffers : null;
  useEffect(() => {
    const controller = new AbortController();
    setSeatState(null);
    void prepareSharedSeatBuffers(crowd, controller.signal).then((buffers) => {
      if (!controller.signal.aborted)
        setSeatState({ crowd, buffers: buffers ?? prepareSeatUpload(crowd) });
    });
    return () => controller.abort();
  }, [crowd]);
  const planes = useMemo(() => new Float64Array(24), []);
  useEffect(() => {
    hasSelection.current = false;
    const controller = new AbortController();
    let release: (() => void) | null = null;
    if (
      seatUpload &&
      typeof Worker !== "undefined" &&
      presentationWorkerCount(navigator.hardwareConcurrency) > 0
    ) {
      void acquirePresentationLanes(1, controller.signal).then((lease) => {
        release = lease;
        if (!lease || controller.signal.aborted) {
          lease?.();
          return;
        }
        try {
          worker.current = new CrowdWorkerClient(layout, lease);
        } catch {
          lease();
          worker.current = null;
        }
      });
    }
    return () => {
      controller.abort();
      worker.current?.dispose();
      worker.current = null;
      release?.();
    };
  }, [layout, seatUpload]);
  const data = useMemo(() => {
    const card = crowdCard();
    const uniforms = {
      time: { value: 0 },
      pulse: { value: 0 },
      wave: { value: 0 },
      agitation: { value: 0 },
    };
    const materials = [0, 1, 2].map((tier) => {
      const legacy =
        typeof location !== "undefined" &&
        location.pathname.endsWith("/graphics-benchmark.html") &&
        new URLSearchParams(location.search).get("crowdLighting") === "legacy";
      const material = crowdLodMaterial(tier, card, legacy);
      if (webgl2)
        material.onBeforeCompile = (shader) => {
          shader.uniforms["crowdTime"] = uniforms.time;
          shader.uniforms["crowdPulse"] = uniforms.pulse;
          shader.uniforms["crowdWave"] = uniforms.wave;
          shader.uniforms["crowdAgitation"] = uniforms.agitation;
          shader.vertexShader = shader.vertexShader
            .replace(
              "#include <common>",
              "#include <common>\nuniform float crowdTime; uniform float crowdPulse; uniform float crowdWave; uniform float crowdAgitation; attribute vec3 crowdSkin; attribute vec2 crowdStyle; attribute float crowdRegion;\n" +
                CROWD_MOTION_GLSL,
            )
            .replace(
              "#include <beginnormal_vertex>",
              `#include <beginnormal_vertex>\n${tier < 2 ? "objectNormal = crowdArticulate(objectNormal, true);" : ""}`,
            )
            .replace(
              "#include <begin_vertex>",
              `#include <begin_vertex>
              float phase = instanceMatrix[3].x * 0.71 + instanceMatrix[3].z * 0.37;
              ${tier < 2 ? "transformed = crowdArticulate(transformed, false);" : ""}
              transformed.x += sin(crowdTime * 1.7 + phase) * 0.035 * max(0.0, position.y + 0.6);
              transformed.z += sin(crowdTime * 5.2 + phase) * crowdAgitation * 0.05 * max(0.0, position.y + 0.6);
              transformed.y += abs(sin(crowdTime * (5.8 + crowdStyle.x) + phase)) * crowdPulse * 0.24;
              // ola mexicana: corcova que viaja ao redor do anel (uma volta a
              // cada ~28 s); sutil no jogo corrido, erupção quando sai o gol
              float ang = atan(instanceMatrix[3].z, instanceMatrix[3].x);
              float dw = abs(mod(ang - crowdWave + 3.14159265, 6.2831853) - 3.14159265);
              transformed.y += exp(-dw * dw * 5.0) * (0.1 + crowdPulse * 0.6);`,
            );
          if (tier < 2)
            // color_vertex includes the instance tint when available; its vColor
            // is also valid during the first render before setColorAt allocates it.
            shader.vertexShader = shader.vertexShader.replace(
              "#include <color_vertex>",
              `#include <color_vertex>
           if (crowdRegion > 0.5 && crowdRegion < 1.5) vColor.rgb = crowdSkin;
           else if (crowdRegion > 1.5 && crowdRegion < 2.5) vColor.rgb = mix(vec3(0.021, 0.035, 0.049), vec3(0.15, 0.18, 0.22), crowdStyle.x);
           else if (crowdRegion > 2.5 && crowdRegion < 3.5) vColor.rgb = mix(vec3(0.012, 0.009, 0.007), vec3(0.23, 0.12, 0.047), crowdStyle.y);
           else if (crowdRegion > 3.5) vColor.rgb = mix(vColor.rgb, vec3(0.75), step(0.6, crowdStyle.x));`,
            );
          else
            shader.vertexShader = shader.vertexShader.replace(
              "#include <color_vertex>",
              `#include <color_vertex>
           if (uv.y > 0.70) vColor.rgb = mix(crowdSkin, vec3(0.024, 0.014, 0.009), step(0.89, uv.y));
           else if (uv.y < 0.37) vColor.rgb = vec3(0.028, 0.043, 0.06);`,
            );
        };
      return material;
    });
    const geometries = [
      supporterGeometry(true),
      supporterGeometry(false),
      new THREE.PlaneGeometry(0.64, 1.5).translate(0, -0.04, 0),
    ];
    geometries.forEach((geometry, tier) => {
      if (tier === 2) {
        geometry.setAttribute(
          "crowdRegion",
          new THREE.Float32BufferAttribute(
            new Float32Array(geometry.getAttribute("position").count),
            1,
          ),
        );
        geometry.setAttribute(
          "crowdLimb",
          new THREE.Float32BufferAttribute(
            new Float32Array(geometry.getAttribute("position").count * 2),
            2,
          ),
        );
      }
      geometry.setAttribute(
        "crowdSkin",
        new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3),
      );
      geometry.setAttribute(
        "crowdStyle",
        new THREE.InstancedBufferAttribute(new Float32Array(capacity * 2), 2),
      );
    });
    return {
      geometries,
      materials,
      card,
      uniforms,
      projection: new THREE.Matrix4(),
      frustum: new THREE.Frustum(),
      counts: [0, 0, 0],
      seats: [0, 1, 2].map(() => new Int32Array(capacity).fill(-1)),
      changed: [false, false, false],
      firstChanged: [0, 0, 0],
      lastChanged: [0, 0, 0],
    };
  }, [webgl2, capacity]);
  useEffect(
    () => () => {
      data.geometries.forEach((geometry) => geometry.dispose());
      data.materials.forEach((material) => material.dispose());
      data.card.dispose();
    },
    [data],
  );

  const elapsed = useRef(Number.POSITIVE_INFINITY);
  useEffect(() => {
    // Another match can reuse the same seat numbers with different club colours.
    // Reset the cached uploads while retaining geometry and material pools.
    data.seats.forEach((seats) => seats.fill(-1));
    elapsed.current = Number.POSITIVE_INFINITY;
  }, [crowd, data]);
  useFrame(({ camera, clock, size }, dt) => {
    if (!seatUpload) return;
    data.uniforms.time.value = clock.elapsedTime;
    data.uniforms.pulse.value = pulse.current;
    data.uniforms.agitation.value =
      supporters?.climate === "protesto"
        ? supporters.intensity
        : supporters?.climate === "cobrança"
          ? supporters.intensity * 0.4
          : 0;
    data.uniforms.wave.value = (clock.elapsedTime * 0.22) % (Math.PI * 2);
    elapsed.current += dt;
    if (elapsed.current < budget.crowdUpdateSeconds) return;
    elapsed.current = 0;

    data.counts.fill(0);
    const changed = data.changed;
    changed.fill(false);
    data.firstChanged.fill(capacity);
    data.lastChanged.fill(0);
    if (budget.crowdInstances > 0) {
      camera.updateMatrixWorld();
      data.projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      data.frustum.setFromProjectionMatrix(data.projection);
      // Keep facial geometry for supporters large enough to read on screen.
      // Distance alone kept hundreds of 10–20 px spectators in a mesh LOD.
      const projectedScale = size.height * Math.abs(camera.projectionMatrix.elements[5]!) * 0.675;
      const perspective = camera instanceof THREE.PerspectiveCamera;
      const detailedPixels = budget.stage >= 5 ? 52 : 42;
      const meshPixels = budget.stage >= 5 ? 34 : 28;

      data.frustum.planes.forEach((plane, index) => {
        const offset = index * 4;
        planes[offset] = plane.normal.x;
        planes[offset + 1] = plane.normal.y;
        planes[offset + 2] = plane.normal.z;
        planes[offset + 3] = plane.constant;
      });
      const input = {
        layout,
        frustumPlanes: planes,
        camera: camera.position,
        projectedScale,
        perspective,
        maxTiles: budget.crowdVisibleTiles,
        maxInstances: Math.min(capacity, budget.crowdInstances),
        detailedPixels,
        meshPixels,
      };
      const client = worker.current;
      let selected = client?.select(input);
      // Retain the visible pool while the worker computes a new camera snapshot.
      // Only the first frame or a failed worker uses the synchronous fallback.
      if (!selected && client && !client.failed && hasSelection.current) return;
      selected ??= selectCrowdFallback(input, fallbackBuffers);
      hasSelection.current = true;
      for (let offset = 0; offset < selected.indices.length; offset += 1) {
        const index = selected.indices[offset]!;
        const tier = selected.tiers[offset]!;
        const mesh = refs.current[tier];
        if (!mesh || data.counts[tier]! >= capacity) continue;
        const instance = data.counts[tier]!++;
        if (data.seats[tier]![instance] === index) continue;
        data.seats[tier]![instance] = index;
        copySeatToInstance(mesh, index, instance, seatUpload);
        changed[tier] = true;
        data.firstChanged[tier] = Math.min(data.firstChanged[tier]!, instance);
        data.lastChanged[tier] = instance + 1;
      }
    }

    refs.current.forEach((mesh, tier) => {
      if (!mesh) return;
      mesh.count = data.counts[tier]!;
      // Typed GPU attributes only upload when a different seat occupies an
      // instance slot. No temporary selection strings are created per tick.
      if (changed[tier]) {
        const first = data.firstChanged[tier]!;
        const count = data.lastChanged[tier]! - first;
        mesh.instanceMatrix.addUpdateRange(first * 16, count * 16);
        mesh.instanceColor?.addUpdateRange(first * 3, count * 3);
        (mesh.geometry.getAttribute("crowdSkin") as THREE.InstancedBufferAttribute).addUpdateRange(
          first * 3,
          count * 3,
        );
        (mesh.geometry.getAttribute("crowdStyle") as THREE.InstancedBufferAttribute).addUpdateRange(
          first * 2,
          count * 2,
        );
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        (mesh.geometry.getAttribute("crowdSkin") as THREE.InstancedBufferAttribute).needsUpdate =
          true;
        (mesh.geometry.getAttribute("crowdStyle") as THREE.InstancedBufferAttribute).needsUpdate =
          true;
      }
      // Fixed pools intentionally skip computeBoundingSphere(), which was a
      // periodic CPU spike in the original global crowd pass.
      mesh.frustumCulled = false;
    });
  });

  return (
    <group dispose={null} ref={censusRef("crowd")}>
      {data.geometries.map((geometry, tier) => (
        <instancedMesh
          key={tier}
          ref={meshRefs[tier]!}
          args={[geometry, data.materials[tier], capacity]}
          count={0}
          frustumCulled={false}
        />
      ))}
    </group>
  );
}
