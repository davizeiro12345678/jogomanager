import { OfficialRig } from "@/components/game/players/OfficialRig";
import type { SimView } from "@/game/sim-contracts";
import type { Quality } from "./quality";

/**
 * Árbitro e assistentes com corpo articulado: tronco com gola, calção, meiões,
 * braços que balançam na corrida, apito no pescoço e cartões no bolso. O
 * árbitro corre na diagonal clássica e levanta o cartão quando há falta; os
 * assistentes acompanham a linha e levantam a bandeira quando o lance para.
 */
export function Officials({ sim, quality }: { sim: SimView; quality: Quality }) {
  return (
    <group>
      <OfficialRig sim={sim} role="ref" quality={quality} />
      <OfficialRig sim={sim} role="ar1" quality={quality} />
      <OfficialRig sim={sim} role="ar2" quality={quality} />
    </group>
  );
}
