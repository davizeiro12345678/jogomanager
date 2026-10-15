/** Bound rendering-only resources for articulated player skins. */
import type React from "react";
import { createElement, useEffect, useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { detailTextureNames, playerMaterials, retainPlayerMaterials } from "@/game/player-materials";
import { requestKtx2 } from "@/game/textures/ktx2";
import { matchRigSegments } from "@/game/match-rig-detail";
import { buildRigSkin, rebindRigSkinMaterials, type RigSkin } from "@/game/rig-skin";
import { AthleteCloth } from "@/game/athlete-cloth";
import type { PlayerLook, Proportions, LodLevel } from "@/game/player-model";
import type { SimPlayer } from "@/game/sim";
import type { Kit } from "@/game/kits";
import { kitTextureFor } from "@/game/graphics/kit-atlas";
import { useMatchSurface } from "@/game/graphics/surface-context";
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
  player: Pick<SimPlayer, "x" | "z">;
  shadows: boolean;
  clothPhysics: boolean;
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
  const segs = matchRigSegments(quality, portrait || denseGeometry, !portrait && matchTopology);

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
  const skin = useMemo<RigSkin>(
    () =>
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
      ),
    // `player.x/z` ficam de propósito: a matriz de bind defasada é compensada
    // pelo three.js a cada quadro, e incluí-los aqui reconstruiria as 18 malhas
    // do atleta a cada movimento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [P, look, kit, segs.radial, segs.cap, hi, portrait, jerseyInk],
  );
  useEffect(() => () => skin.dispose(), [skin]);
  const cloth = useMemo(
    () => new AthleteCloth(skin, P, hi && clothPhysics),
    [skin, P, hi, clothPhysics],
  );
  useLayoutEffect(() => {
    painted.current = false;
    lodState.current = null;
    castState.current = null;
    // The first sample sets the articulated lids at their open rest pose.
    for (const joint of ["eyelidUpperL", "eyelidLowerL", "eyelidUpperR", "eyelidLowerR"] as const)
      skin.boneOf[joint].rotation.x = 0;
  }, [skin, look.seed]);

  // As malhas são criadas fora do JSX para carregar esqueleto, esfera de
  // culling generosa (a pose animada sai da pose de bind) e o estado de LOD.
  const drawMeshes = useMemo(() => {
    nearMeshes.current = [];
    bootMeshes.current = [];
    skinnedMeshes.current = [];
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
  }, [skin, shadows, portrait]);

  // Material maps/surface steps change far more often than body geometry.
  // Rebind their stable slots in place and keep the mesh and skeleton objects.
  useLayoutEffect(() => {
    rebindRigSkinMaterials(skin, skinnedMeshes.current, mats);
  }, [skin, mats, drawMeshes]);
  useLayoutEffect(() => {
    for (const mesh of skinnedMeshes.current) {
      cloth.bind(mesh);
      if (!hi || !clothPhysics) mesh.morphTargetInfluences?.fill(0);
    }
  }, [skin, cloth, drawMeshes, hi, clothPhysics]);
  return { skin, cloth, drawMeshes };
}
