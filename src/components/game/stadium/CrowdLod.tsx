import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import type { RuntimeSceneBudget } from "@/game/runtime-scene-budget";
import { censusRef } from "@/game/scene-census";

type CrowdData = { positions: THREE.Vector3[]; colors: THREE.Color[]; skins: THREE.Color[] };
type CrowdTile = { indices: number[]; sphere: THREE.Sphere; distance: number };

const TILE_SECTORS = 12;
const TILE_RINGS = 3;
const MAX_CROWD_INSTANCES = 5_120;

function humanGeometry(detailed: boolean) {
  const parts: THREE.BufferGeometry[] = [];
  const part = (geometry: THREE.BufferGeometry, y: number, color: THREE.Color) => {
    geometry.translate(0, y, 0);
    const colors = new Float32Array(geometry.getAttribute("position").count * 3);
    for (let i = 0; i < colors.length; i += 3) color.toArray(colors, i);
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    parts.push(geometry);
  };
  part(new THREE.CylinderGeometry(0.25, 0.19, 0.64, detailed ? 7 : 4), 0, new THREE.Color("white"));
  part(
    new THREE.SphereGeometry(0.16, detailed ? 7 : 4, detailed ? 5 : 3),
    0.49,
    new THREE.Color("#e8c19d"),
  );
  part(new THREE.BoxGeometry(0.33, 0.32, 0.22), -0.46, new THREE.Color("#28303a"));
  const merged = mergeGeometries(parts)!;
  parts.forEach((geometry) => geometry.dispose());
  return merged;
}

function crowdCard() {
  if (typeof document === "undefined") return new THREE.Texture();
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 128;
  const c = canvas.getContext("2d")!;
  c.fillStyle = "#e8c19d";
  c.beginPath();
  c.ellipse(32, 20, 11, 14, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#28221d";
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
  c.fillStyle = "#343d47";
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
}: {
  crowd: CrowdData;
  pulse: React.MutableRefObject<number>;
  budget: Pick<
    RuntimeSceneBudget,
    "crowdInstances" | "crowdVisibleTiles" | "crowdUpdateSeconds" | "stage"
  >;
  supporters?: import("@/game/career-world-types").SupporterMatchday | undefined;
}) {
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const tiles = useMemo(() => buildTiles(crowd.positions), [crowd.positions]);
  const data = useMemo(() => {
    const card = crowdCard();
    const uniforms = {
      time: { value: 0 },
      pulse: { value: 0 },
      wave: { value: 0 },
      agitation: { value: 0 },
    };
    const materials = [0, 1, 2].map((tier) => {
      const material = new THREE.MeshStandardMaterial({
        roughness: 0.93,
        vertexColors: true,
        flatShading: tier < 2,
        ...(tier === 2 ? { map: card, alphaTest: 0.4, side: THREE.DoubleSide } : {}),
      });
      material.onBeforeCompile = (shader) => {
        shader.uniforms["crowdTime"] = uniforms.time;
        shader.uniforms["crowdPulse"] = uniforms.pulse;
        shader.uniforms["crowdWave"] = uniforms.wave;
        shader.uniforms["crowdAgitation"] = uniforms.agitation;
        shader.vertexShader = shader.vertexShader
          .replace(
            "#include <common>",
            "#include <common>\nuniform float crowdTime; uniform float crowdPulse; uniform float crowdWave; uniform float crowdAgitation;",
          )
          .replace(
            "#include <begin_vertex>",
            `#include <begin_vertex>
              float phase = instanceMatrix[3].x * 0.71 + instanceMatrix[3].z * 0.37;
              transformed.x += sin(crowdTime * 1.7 + phase) * 0.035 * max(0.0, position.y + 0.6);
              transformed.z += sin(crowdTime * 5.2 + phase) * crowdAgitation * 0.05 * max(0.0, position.y + 0.6);
              transformed.y += abs(sin(crowdTime * 7.0 + phase)) * crowdPulse * 0.48;
              // ola mexicana: corcova que viaja ao redor do anel (uma volta a
              // cada ~28 s); sutil no jogo corrido, erupção quando sai o gol
              float ang = atan(instanceMatrix[3].z, instanceMatrix[3].x);
              float dw = abs(mod(ang - crowdWave + 3.14159265, 6.2831853) - 3.14159265);
              transformed.y += exp(-dw * dw * 5.0) * (0.1 + crowdPulse * 0.6);`,
          );
      };
      return material;
    });
    return {
      geometries: [
        humanGeometry(true),
        humanGeometry(false),
        new THREE.PlaneGeometry(0.64, 1.35).translate(0, 0.03, 0),
      ],
      materials,
      card,
      uniforms,
      dummy: new THREE.Object3D(),
      projection: new THREE.Matrix4(),
      frustum: new THREE.Frustum(),
      counts: [0, 0, 0],
    };
  }, []);
  useEffect(
    () => () => {
      data.geometries.forEach((geometry) => geometry.dispose());
      data.materials.forEach((material) => material.dispose());
      data.card.dispose();
    },
    [data],
  );

  const elapsed = useRef(Number.POSITIVE_INFINITY);
  useFrame(({ camera, clock }, dt) => {
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
    if (budget.crowdInstances > 0) {
      camera.updateMatrixWorld();
      data.projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      data.frustum.setFromProjectionMatrix(data.projection);
      const visibleTiles = tiles
        .filter((tile) => data.frustum.intersectsSphere(tile.sphere))
        .map((tile) => {
          tile.distance = camera.position.distanceTo(tile.sphere.center);
          return tile;
        })
        .sort((a, b) => a.distance - b.distance)
        .slice(0, budget.crowdVisibleTiles);
      const selectedTiles = visibleTiles.length
        ? visibleTiles
        : tiles.slice(0, budget.crowdVisibleTiles);
      const perTile = Math.max(
        1,
        Math.ceil(budget.crowdInstances / Math.max(1, selectedTiles.length)),
      );
      const near = budget.stage >= 5 ? 18 : 28;
      const mid = budget.stage >= 5 ? 44 : 62;

      for (const tile of selectedTiles) {
        const stride = Math.max(1, Math.ceil(tile.indices.length / perTile));
        for (let offset = 0; offset < tile.indices.length; offset += stride) {
          const index = tile.indices[offset]!;
          const position = crowd.positions[index]!;
          const total = data.counts[0]! + data.counts[1]! + data.counts[2]!;
          if (total >= budget.crowdInstances) break;
          const distance = camera.position.distanceTo(position);
          const tier = distance < near ? 0 : distance < mid ? 1 : 2;
          const mesh = refs.current[tier];
          if (!mesh || data.counts[tier]! >= MAX_CROWD_INSTANCES) continue;
          const instance = data.counts[tier]!++;
          data.dummy.position.copy(position);
          data.dummy.scale.setScalar(0.9 + (index % 5) * 0.045);
          data.dummy.rotation.set(0, Math.atan2(-position.x, -position.z), 0);
          data.dummy.updateMatrix();
          mesh.setMatrixAt(instance, data.dummy.matrix);
          mesh.setColorAt(instance, crowd.colors[index]!);
        }
      }
    }

    refs.current.forEach((mesh, tier) => {
      if (!mesh) return;
      mesh.count = data.counts[tier]!;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
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
          ref={(mesh) => {
            refs.current[tier] = mesh;
          }}
          args={[geometry, data.materials[tier], MAX_CROWD_INSTANCES]}
          frustumCulled={false}
        />
      ))}
    </group>
  );
}
