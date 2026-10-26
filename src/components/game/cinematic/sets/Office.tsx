import type { Speaker } from "@/content/cutscenes";

import { CinematicActor as Figure } from "../CinematicActor";

import { ClubTrophy } from "../CinematicSetDetails";
import { useCinematicArtwork } from "../cinematic-artwork";
import { cinematicSurface } from "../cinematic-surfaces";

export function Office({
  primary,
  secondary,
  speaker,
}: {
  primary: string;
  secondary: string;
  speaker: Speaker | null;
}) {
  const vista = useCinematicArtwork("stadium", primary, secondary);
  return (
    <group>
      <mesh receiveShadow rotation-x={-Math.PI / 2}>
        <planeGeometry args={[16, 12]} />
        <meshStandardMaterial
          color="#866c50"
          map={cinematicSurface("wood")}
          normalMap={cinematicSurface("wood", "normal")}
          normalScale={[0.2, 0.2]}
          roughnessMap={cinematicSurface("wood", "roughness")}
          roughness={0.66}
        />
      </mesh>
      <mesh receiveShadow position={[0, 2.4, -4]}>
        <boxGeometry args={[16, 4.8, 0.2]} />
        <meshStandardMaterial
          color="#384653"
          map={cinematicSurface("wall")}
          normalMap={cinematicSurface("wall", "normal")}
          normalScale={[0.08, 0.08]}
          roughnessMap={cinematicSurface("wall", "roughness")}
          roughness={0.9}
        />
      </mesh>
      {/* janela com estádio ao fundo */}
      <mesh position={[4.4, 2.2, -3.86]}>
        <planeGeometry args={[4.6, 2.6]} />
        <meshBasicMaterial map={vista} color="#d4e3eb" />
      </mesh>
      {/* mesa e cadeiras */}
      <mesh position={[0, 0.74, -1.4]} castShadow receiveShadow>
        <boxGeometry args={[3.8, 0.12, 1.5]} />
        <meshStandardMaterial
          color="#a7875d"
          map={cinematicSurface("wood")}
          normalMap={cinematicSurface("wood", "normal")}
          normalScale={[0.18, 0.18]}
          roughnessMap={cinematicSurface("wood", "roughness")}
          roughness={0.5}
        />
      </mesh>
      {[-1.5, 1.5].map((x) => (
        <mesh key={x} position={[x, 0.36, -1.4]} castShadow>
          <boxGeometry args={[0.1, 0.72, 0.1]} />
          <meshStandardMaterial color="#2a1d12" roughness={0.7} />
        </mesh>
      ))}
      {/* troféus na estante */}
      <mesh position={[-4.6, 1.5, -3.8]} receiveShadow>
        <boxGeometry args={[4, 3, 0.4]} />
        <meshStandardMaterial color="#241a12" roughness={0.85} />
      </mesh>
      {Array.from({ length: 5 }).map((_, i) => (
        <ClubTrophy key={i} x={-6.2 + i * 0.78} y={2.05} z={-3.6} scale={0.8} />
      ))}
      <Figure
        x={-0.9}
        z={-2.3}
        rot={0.3}
        color={primary}
        shorts="#1b1f22"
        seed={41}
        role="president"
        attention={[1.1, -2.3]}
        acting={speaker === "president"}
      />
      <Figure
        x={1.1}
        z={-2.3}
        rot={-0.25}
        color={secondary}
        shorts="#1b1f22"
        seed={57}
        role="manager"
        attention={[-0.9, -2.3]}
        acting={speaker === "manager"}
      />
    </group>
  );
}
