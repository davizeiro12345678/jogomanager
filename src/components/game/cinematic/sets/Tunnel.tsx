import { CinematicActor as Figure } from "../CinematicActor";
import { useCinematicArtwork } from "../cinematic-artwork";
import { cinematicSurface } from "../cinematic-surfaces";
import { TunnelDust } from "./shared";
import type { CinematicSetProps } from "./types";

export function Tunnel({ primary, secondary, speaker }: CinematicSetProps) {
  const vista = useCinematicArtwork("stadium", primary, secondary, "tunnel");
  return (
    <group>
      <mesh receiveShadow rotation-x={-Math.PI / 2}>
        <planeGeometry args={[7, 30]} />
        <meshStandardMaterial
          color="#50565a"
          map={cinematicSurface("asphalt")}
          normalMap={cinematicSurface("asphalt", "normal")}
          normalScale={[0.12, 0.12]}
          roughnessMap={cinematicSurface("asphalt", "roughness")}
          roughness={0.82}
        />
      </mesh>
      {Array.from({ length: 10 }).map((_, i) => (
        <group key={i} position={[0, 0, 3 - i * 1.5]}>
          <mesh position={[-3.3, 1.7, 0]} receiveShadow>
            <boxGeometry args={[0.24, 3.4, 1.34]} />
            <meshStandardMaterial color={i % 2 ? "#0f1613" : "#131c17"} roughness={0.86} />
          </mesh>
          <mesh position={[3.3, 1.7, 0]} receiveShadow>
            <boxGeometry args={[0.24, 3.4, 1.34]} />
            <meshStandardMaterial color={i % 2 ? "#0f1613" : "#131c17"} roughness={0.86} />
          </mesh>
          <mesh position={[0, 3.35, 0]} receiveShadow>
            <boxGeometry args={[6.9, 0.3, 1.34]} />
            <meshStandardMaterial color="#0c120f" roughness={0.9} />
          </mesh>
          <mesh position={[0, 3.16, 0]}>
            <boxGeometry args={[1.5, 0.05, 0.12]} />
            <meshBasicMaterial color={primary} toneMapped={false} />
          </mesh>
        </group>
      ))}
      <mesh position={[-3.16, 2.5, -4]}>
        <boxGeometry args={[0.04, 0.09, 20]} />
        <meshBasicMaterial color={secondary} toneMapped={false} />
      </mesh>
      <mesh position={[3.16, 2.5, -4]}>
        <boxGeometry args={[0.04, 0.09, 20]} />
        <meshBasicMaterial color={secondary} toneMapped={false} />
      </mesh>
      {Array.from({ length: 8 }).map((_, i) => (
        <Figure
          key={i}
          x={i % 2 ? 0.95 : -0.95}
          z={1 - Math.floor(i / 2) * 1.7}
          role={i === 0 ? "captain" : undefined}
          pose="stand"
          color={i % 2 ? primary : secondary}
          seed={i * 11 + 4}
          acting={i === 0 && speaker === "captain"}
        />
      ))}
      <mesh position={[0, 1.9, -12]}>
        <planeGeometry args={[6.6, 3.8]} />
        <meshBasicMaterial map={vista} color="#e6fff0" toneMapped={false} />
      </mesh>
      <pointLight position={[0, 2, -11]} intensity={26} distance={22} color="#eafff2" />
      <TunnelDust />
    </group>
  );
}
