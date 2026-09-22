import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

type CrowdData = { positions: THREE.Vector3[]; colors: THREE.Color[]; skins: THREE.Color[] };

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
  part(new THREE.SphereGeometry(0.16, detailed ? 7 : 4, detailed ? 5 : 3), 0.49, new THREE.Color("#e8c19d"));
  part(new THREE.BoxGeometry(0.33, 0.32, 0.22), -0.46, new THREE.Color("#28303a"));
  const merged = mergeGeometries(parts)!;
  parts.forEach(geometry => geometry.dispose());
  return merged;
}

function crowdCard() {
  if (typeof document === "undefined") return new THREE.Texture();
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 128;
  const c = canvas.getContext("2d")!;
  c.fillStyle = "#e8c19d"; c.beginPath(); c.ellipse(32, 20, 11, 14, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#28221d"; c.beginPath(); c.ellipse(32, 12, 11, 7, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#ffffff"; c.beginPath(); c.moveTo(17, 37); c.lineTo(47, 37); c.lineTo(55, 81); c.lineTo(10, 81); c.closePath(); c.fill();
  c.fillStyle = "#343d47"; c.fillRect(18, 81, 12, 42); c.fillRect(34, 81, 12, 42);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Three actual representations, three draws. Only LOD selection uploads matrices
 * (4 Hz); crowd motion happens in the vertex shader with one shared time uniform.
 * No shadow casters, no React updates per spectator, no hidden high-poly crowd. */
export function CrowdLod({ crowd, pulse, pressure = 0 }: { crowd: CrowdData; pulse: React.MutableRefObject<number>; pressure?: number }) {
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const data = useMemo(() => {
    const card = crowdCard();
    const uniforms = { time: { value: 0 }, pulse: { value: 0 } };
    const materials = [0, 1, 2].map(tier => {
      const material = new THREE.MeshStandardMaterial({
        roughness: 0.93,
        vertexColors: true,
        flatShading: tier < 2,
        ...(tier === 2 ? { map: card, alphaTest: 0.4, side: THREE.DoubleSide } : {}),
      });
      material.onBeforeCompile = shader => {
        shader.uniforms["crowdTime"] = uniforms.time;
        shader.uniforms["crowdPulse"] = uniforms.pulse;
        shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nuniform float crowdTime; uniform float crowdPulse;")
          .replace("#include <begin_vertex>", `#include <begin_vertex>
            float phase = instanceMatrix[3].x * 0.71 + instanceMatrix[3].z * 0.37;
            transformed.x += sin(crowdTime * 1.7 + phase) * 0.035 * max(0.0, position.y + 0.6);
            transformed.y += abs(sin(crowdTime * 7.0 + phase)) * crowdPulse * 0.48;`);
      };
      return material;
    });
    return { geometries: [humanGeometry(true), humanGeometry(false), new THREE.PlaneGeometry(0.64, 1.35).translate(0, 0.03, 0)], materials, card, uniforms,
      dummy: new THREE.Object3D(), color: new THREE.Color(), counts: [0, 0, 0] };
  }, []);
  useEffect(() => () => { data.geometries.forEach(g => g.dispose()); data.materials.forEach(m => m.dispose()); data.card.dispose(); }, [data]);
  const elapsed = useRef(1);
  const tiers = useMemo(() => new Uint8Array(crowd.positions.length).fill(2), [crowd]);
  useFrame(({ camera, clock }, dt) => {
    data.uniforms.time.value = clock.elapsedTime;
    data.uniforms.pulse.value = pulse.current;
    elapsed.current += dt;
    if (elapsed.current < 0.25) return;
    elapsed.current = 0;
    data.counts.fill(0);
    for (let i = 0; i < crowd.positions.length; i++) {
      const p = crowd.positions[i]!;
      const distance = camera.position.distanceTo(p);
      const previous = tiers[i]!;
      const near = pressure >= 3 ? 20 : 32;
      const mid = pressure >= 3 ? 50 : 70;
      const tier = distance < near + (previous === 0 ? 5 : 0) ? 0 : distance < mid + (previous === 1 ? 7 : 0) ? 1 : 2;
      tiers[i] = tier;
      const mesh = refs.current[tier];
      if (!mesh) continue;
      const index = data.counts[tier]!++;
      data.dummy.position.copy(p);
      data.dummy.scale.setScalar(0.9 + (i % 5) * 0.045);
      data.dummy.rotation.set(0, Math.atan2(camera.position.x - p.x, camera.position.z - p.z), 0);
      data.dummy.updateMatrix();
      mesh.setMatrixAt(index, data.dummy.matrix);
      mesh.setColorAt(index, crowd.colors[i]!);
    }
    refs.current.forEach((mesh, tier) => {
      if (!mesh) return;
      mesh.count = data.counts[tier]!;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    });
  });
  return <group dispose={null}>{data.geometries.map((geometry, tier) => <instancedMesh key={tier} ref={mesh => { refs.current[tier] = mesh; }} args={[geometry, data.materials[tier], crowd.positions.length]} />)}</group>;
}
