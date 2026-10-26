import { OfficialRig } from "@/components/game/players/OfficialRig";

import { type SimView } from "@/game/sim-types";

import type { Quality } from "./shared";
export function Officials({ sim, quality }: { sim: SimView; quality: Quality }) {
  return (
    <group>
      <OfficialRig sim={sim} role="ref" quality={quality} />
      <OfficialRig sim={sim} role="ar1" quality={quality} />
      <OfficialRig sim={sim} role="ar2" quality={quality} />
    </group>
  );
}

/**
 * Medidor de quadros: amostra o tempo entre quadros e reporta uma vez por
 * segundo a taxa instantânea, a média e o pior caso (p95) da partida inteira.
 * Fica dentro do Canvas para não forçar re-render da árvore 3D.
 */
