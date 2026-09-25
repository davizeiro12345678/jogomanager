// ============================================================================
//  rig-geometry.ts
//  Construção de malha mesclada por junta para o rig dos jogadores.
//
//  O rig procedural desenhava cada volume (músculo, manga, caneleira, cadarço,
//  travas…) como uma malha própria. Um único atleta chegava a ~117 meshes, e
//  cada malha é um draw call: com 6 heróis em campo, só de jogadores eram ~700
//  desenhos — o triplo do orçamento do perfil Alto (260).
//
//  A correção é mesclar as malhas que compartilham a MESMA transformação rígida
//  (a mesma junta) e o MESMO material. A aparência não muda: as geometrias são
//  cozidas no espaço da junta uma única vez, e a junta continua girando igual.
//  Um atleta sai de ~117 para ~45 malhas em LOD 0 (e ~30 nas LODs distantes,
//  onde os detalhes finos ficam ocultos).
//
//  Nada aqui depende de WebGL: os testes constroem geometria três em Node.
// ============================================================================

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Transformação local de uma peça dentro da junta. */
export interface RigTransform {
  position?: readonly [number, number, number];
  /** rotação em radianos, ordem XYZ */
  rotation?: readonly [number, number, number];
  scale?: readonly [number, number, number] | number;
}

/** Uma peça do rig: geometria + material + matriz local na junta. */
export interface RigPart {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  matrix: THREE.Matrix4;
  castShadow: boolean;
}

/** Resultado do merge: uma malha por (material, sombra). */
export interface RigMesh {
  material: THREE.Material;
  geometry: THREE.BufferGeometry;
  castShadow: boolean;
}

const scratch = new THREE.Object3D();

/** Monta uma peça pronta para o merge. */
export function rigPart(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  transform?: RigTransform,
  castShadow = false,
): RigPart {
  scratch.position.fromArray(transform?.position ?? [0, 0, 0]);
  scratch.rotation.set(...(transform?.rotation ?? [0, 0, 0]));
  if (typeof transform?.scale === "number") scratch.scale.setScalar(transform.scale);
  else scratch.scale.fromArray(transform?.scale ?? [1, 1, 1]);
  scratch.updateMatrix();
  return { geometry, material, matrix: scratch.matrix.clone(), castShadow };
}

/**
 * Agrupa peças por (material, sombra), cozinha as transformações e mescla.
 * Se o merge falhar (atributos incompatíveis), devolve as peças individuais —
 * a silhueta nunca desaparece por causa de uma otimização.
 */
export function mergeRigParts(parts: RigPart[]): RigMesh[] {
  if (parts.length === 0) return [];
  const groups = new Map<string, RigPart[]>();
  for (const part of parts) {
    const key = `${part.material.uuid}|${part.castShadow ? 1 : 0}`;
    const list = groups.get(key);
    if (list) list.push(part);
    else groups.set(key, [part]);
  }

  const meshes: RigMesh[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      const only = group[0]!;
      const geometry = only.geometry.clone();
      geometry.applyMatrix4(only.matrix);
      geometry.computeBoundingSphere();
      geometry.computeBoundingBox();
      meshes.push({ material: only.material, geometry, castShadow: only.castShadow });
      continue;
    }
    const baked: THREE.BufferGeometry[] = [];
    for (const part of group) {
      const geometry = part.geometry.clone();
      geometry.applyMatrix4(part.matrix);
      baked.push(geometry);
    }
    const merged = mergeGeometries(baked, false);
    for (const geometry of baked) geometry.dispose();
    if (!merged) {
      // caminho seguro: mantém cada peça como malha própria
      for (const part of group) {
        const geometry = part.geometry.clone();
        geometry.applyMatrix4(part.matrix);
        geometry.computeBoundingSphere();
        geometry.computeBoundingBox();
        meshes.push({ material: part.material, geometry, castShadow: part.castShadow });
      }
      continue;
    }
    merged.computeBoundingSphere();
    merged.computeBoundingBox();
    meshes.push({
      material: group[0]!.material,
      geometry: merged,
      castShadow: group[0]!.castShadow,
    });
  }
  return meshes;
}

/** Libera as geometrias criadas pelo merge (materiais são compartilhados). */
export function disposeRigMeshes(meshes: RigMesh[]): void {
  for (const mesh of meshes) mesh.geometry.dispose();
}

/** Conta malhas de um rig mesclado (usado em teste de orçamento). */
export function countRigMeshes(meshes: RigMesh[]): number {
  return meshes.length;
}
