/** Bound rendering-only resources for articulated player skins. */
import { AthleteCloth } from "@/game/athlete-cloth";
import { kitTextureFor } from "@/game/graphics/kit-atlas";
import { useMatchSurface } from "@/game/graphics/surface-context-state";
import { retainKitTexture, type Kit } from "@/game/kits";
import { matchRigSegments } from "@/game/match-rig-detail";
import { isCoarsePointer } from "@/game/device";
import {
  detailTextureNames,
  playerMaterials,
  retainPlayerMaterials,
} from "@/game/player-materials";
import type { LodLevel, PlayerLook, Proportions } from "@/game/player-model";
import { buildRigSkin, rebindRigSkinMaterials, type RigSkin } from "@/game/rig-skin";
import { rigRetainedBytes, type MatchRigPool, type PooledMatchRig } from "@/game/match-rig-pool";
import type { SimPlayer } from "@/game/sim";
import { requestKtx2 } from "@/game/textures/ktx2";
import type React from "react";
import { createElement, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { Quality } from "./player-rig-contract";

interface RigMeshInputs {
  quality: Quality;
  portrait: boolean;
  denseGeometry: boolean;
  matchTopology: boolean;
  look: PlayerLook;
  kit: Kit;
  tex: ReturnType<typeof kitTextureFor>;
  surface: ReturnType<typeof useMatchSurface>;
  hi: boolean;
  P: Proportions;
  jerseyInk: string;
  player: Pick<SimPlayer, "x" | "z" | "id">;
  shadows: boolean;
  clothPhysics: boolean;
  rigPool?: MatchRigPool | undefined;
  painted: React.RefObject<boolean>;
  lodState: React.RefObject<LodLevel | null>;
  castState: React.RefObject<boolean | null>;
  nearMeshes: React.RefObject<THREE.SkinnedMesh[]>;
  bootMeshes: React.RefObject<THREE.SkinnedMesh[]>;
  skinnedMeshes: React.RefObject<THREE.SkinnedMesh[]>;
}

export function usePlayerRigMeshes({
  quality,
  portrait,
  denseGeometry,
  matchTopology,
  look,
  kit,
  tex,
  surface,
  hi,
  P,
  jerseyInk,
  player,
  shadows,
  clothPhysics,
  rigPool,
  painted,
  lodState,
  castState,
  nearMeshes,
  bootMeshes,
  skinnedMeshes,
}: RigMeshInputs) {
  /* ------------------------------------------------------------ materiais */

  // A qualidade baixa usava a mesma malha de 14 segmentos da alta nos 22
  // jogadores. Ajustar a geometria ao nível global reduz muito o trabalho da
  // GPU sem alterar silhueta, materiais ou animações.
  const segs = matchRigSegments(
    quality,
    portrait || denseGeometry,
    !portrait && matchTopology,
    isCoarsePointer(),
  );

  // Materiais compartilhados entre jogadores com a mesma combinação de
  // uniforme/aparência: derruba o número de programas de shader e de objetos
  // de material de ~200 para poucas dezenas numa partida.
  useEffect(() => {
    if (quality !== "alta") return;
    requestKtx2(detailTextureNames(look, kit));
  }, [quality, kit, look]);
  const mats = useMemo(
    () => playerMaterials(look, kit, tex ?? null, quality, surface),
    [look, kit, tex, quality, surface],
  );
  useLayoutEffect(() => retainPlayerMaterials(mats), [mats]);

  // Corpo em SkinnedMesh: um desenho por grupo de material (~18) em vez de um
  // por peça mesclada (~53). A matriz de bind é a posição do atleta, porque
  // ossos e malhas são filhos do mesmo grupo raiz. Reconstruído só quando
  // aparência ou qualidade mudam.
  const createSkin = () =>
    buildRigSkin(
      {
        P,
        look,
        segs: { radial: segs.radial, cap: segs.cap },
        hi,
        portrait,
        mats,
        jerseyInk,
        handR: look.gloves ? P.handR * 1.25 : P.handR,
        handMat: look.gloves ? mats.glove : mats.skin,
      },
      [player.x, 0, player.z],
    );
  const buildCurrent = useRef(createSkin);
  buildCurrent.current = () => {
    const skin = createSkin();
    // Prepare the retained immutable morph buffers before applying the dormant
    // byte budget. Mounted owners construct their own dynamics and bindings.
    new AthleteCloth(skin, P, hi && clothPhysics);
    return skin;
  };
  const poolKey = JSON.stringify([
    player.id,
    quality,
    portrait,
    segs.radial,
    segs.cap,
    hi,
    jerseyInk,
    clothPhysics,
    look,
    P,
    kit,
    tex?.uuid,
  ]);
  const [pooled, setPooled] = useState<{
    pool: MatchRigPool;
    key: string;
    resource: PooledMatchRig;
  } | null>(null);
  const matsCurrent = useRef(mats);
  matsCurrent.current = mats;
  useLayoutEffect(() => {
    if (!rigPool) return undefined;
    const lease = rigPool.acquire(poolKey, () => {
      const skin = buildCurrent.current();
      let primary = matsCurrent.current;
      let release = retainPlayerMaterials(primary);
      const atlas = ("map" in primary.jersey ? primary.jersey.map : null) as typeof tex;
      const releaseKit = retainKitTexture(atlas);
      const kitImage = atlas?.image as { width?: number; height?: number } | undefined;
      const kitBytes = Math.max(0, (kitImage?.width ?? 0) * (kitImage?.height ?? 0) * 4);
      return {
        value: {
          skin,
          retainMaterials(next) {
            if (next === primary) return;
            const nextRelease = retainPlayerMaterials(next);
            release();
            primary = next;
            release = nextRelease;
          },
        },
        estimatedBytes: rigRetainedBytes(skin) + kitBytes,
        dispose: () => {
          skin.dispose();
          release();
          releaseKit();
        },
      };
    });
    setPooled({ pool: rigPool, key: poolKey, resource: lease.value });
    return () => {
      // Returning a skeleton to the pool must never move it out of another
      // still-mounted actor. R3F primitives remain owned by this lifecycle.
      const meshes = skinnedMeshes.current.slice();
      queueMicrotask(() => {
        // Keep the old lease exclusive through a StrictMode effect replay and
        // the current commit. A new owner can only take it after detachment.
        lease.value.skin.root.removeFromParent();
        for (const mesh of meshes) mesh.removeFromParent();
        lease.release();
      });
    };
  }, [rigPool, poolKey, skinnedMeshes]);
  const fallbackSkin = useMemo<RigSkin | null>(
    () =>
      rigPool
        ? null
        : buildRigSkin(
            {
              P,
              look,
              segs: { radial: segs.radial, cap: segs.cap },
              hi,
              portrait,
              mats,
              jerseyInk,
              handR: look.gloves ? P.handR * 1.25 : P.handR,
              handMat: look.gloves ? mats.glove : mats.skin,
            },
            [player.x, 0, player.z],
          ),
    // `player.x/z` ficam de propósito: a matriz de bind defasada é compensada
    // pelo three.js a cada quadro, e incluí-los aqui reconstruiria as 18 malhas
    // do atleta a cada movimento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [P, look, kit, segs.radial, segs.cap, hi, portrait, jerseyInk, rigPool],
  );
  const pooledResource =
    rigPool && pooled?.pool === rigPool && pooled.key === poolKey ? pooled.resource : null;
  const skin = rigPool ? (pooledResource?.skin ?? null) : fallbackSkin;
  useEffect(() => {
    if (!fallbackSkin) return undefined;
    return () => fallbackSkin.dispose();
  }, [fallbackSkin]);
  const cloth = useMemo(
    () => (skin ? new AthleteCloth(skin, P, hi && clothPhysics) : null),
    [skin, P, hi, clothPhysics],
  );
  useLayoutEffect(() => {
    if (!skin) return;
    painted.current = false;
    lodState.current = null;
    castState.current = null;
    // The first sample sets the articulated lids at their open rest pose.
    for (const joint of ["eyelidUpperL", "eyelidLowerL", "eyelidUpperR", "eyelidLowerR"] as const)
      skin.boneOf[joint].rotation.x = 0;
  }, [skin, look.seed, painted, lodState, castState]);

  // As malhas são criadas fora do JSX para carregar esqueleto, esfera de
  // culling generosa (a pose animada sai da pose de bind) e o estado de LOD.
  const drawMeshes = useMemo(() => {
    nearMeshes.current = [];
    bootMeshes.current = [];
    skinnedMeshes.current = [];
    if (!skin) return [];
    return skin.groups.map((group, index) => {
      const mesh = new THREE.SkinnedMesh(group.geometry, group.material);
      // The portrait camera can sit beside an overhead glove, far outside
      // that detail bucket's rest-pose bounds. The single inspected athlete
      // stays visible; ordinary match players retain frustum culling.
      mesh.frustumCulled = !portrait;
      // Sem esqueleto e matriz de bind a malha não deforma (e apareceria
      // deslocada). `bindMatrixInverse` é mantido pelo three.js a cada quadro.
      mesh.skeleton = skin.skeleton;
      mesh.bindMatrix.copy(skin.bindMatrix);
      mesh.bindMatrixInverse.copy(skin.bindMatrix).invert();
      // Só o corpo projetа sombra. Rosto, dedos e travas são pequenos demais
      // para aparecer no mapa de sombras e custariam uma segunda passagem de
      // desenho por atleta — 6 grupos a menos por herói.
      mesh.castShadow = shadows && group.castShadow && group.lod === "core";
      mesh.receiveShadow = false;
      mesh.name = `rig-${group.lod}`;
      // esfera local folgada: evita o recálculo caro (e animado) do three.js
      const sphere = group.geometry.boundingSphere;
      if (sphere) mesh.boundingSphere = sphere.clone();
      if (group.lod === "near") nearMeshes.current.push(mesh);
      if (group.lod === "boot") bootMeshes.current.push(mesh);
      skinnedMeshes.current.push(mesh);
      return createElement("primitive", { key: `${group.material.uuid}-${index}`, object: mesh });
    });
  }, [skin, shadows, portrait, nearMeshes, bootMeshes, skinnedMeshes]);

  // Material maps/surface steps change far more often than body geometry.
  // Rebind their stable slots in place and keep the mesh and skeleton objects.
  useLayoutEffect(() => {
    if (!skin) return;
    pooledResource?.retainMaterials(mats);
    rebindRigSkinMaterials(skin, skinnedMeshes.current, mats);
  }, [skin, mats, drawMeshes, skinnedMeshes, pooledResource]);
  useLayoutEffect(() => {
    if (!cloth) return;
    for (const mesh of skinnedMeshes.current) {
      cloth.bind(mesh);
      if (!hi || !clothPhysics) mesh.morphTargetInfluences?.fill(0);
    }
  }, [skin, cloth, drawMeshes, hi, clothPhysics, skinnedMeshes]);
  return { skin, cloth, drawMeshes };
}
