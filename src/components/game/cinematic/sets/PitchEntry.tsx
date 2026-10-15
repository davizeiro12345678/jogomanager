import { CinematicActor as Figure } from "../CinematicActor";
import { CinematicCrowd } from "../CinematicCrowd";
import { CinematicTraining } from "../CinematicTraining";
import { useCinematicArtwork } from "../cinematic-artwork";
import { cinematicSurface } from "../cinematic-surfaces";
import { CelebrationRain } from "./shared";
import type { CinematicSetProps } from "./types";

export function PitchEntry({
  primary,
  secondary,
  speaker,
  festive = false,
  training = false,
}: CinematicSetProps) {
  const artwork = useCinematicArtwork("pitch", primary, secondary);
  return (
    <group>
      {Array.from({ length: 14 }).map((_, i) => (
        <mesh
          key={i}
          receiveShadow
          rotation-x={-Math.PI / 2}
          position={[0, i % 2 ? 0.001 : 0, 8 - i * 2.2]}
        >
          <planeGeometry args={[40, 2.2]} />
          <meshStandardMaterial
            color={i % 2 ? "#337b43" : "#2c6e3b"}
            map={cinematicSurface("grass")}
            normalMap={cinematicSurface("grass", "normal")}
            normalScale={[0.14, 0.14]}
            roughnessMap={cinematicSurface("grass", "roughness")}
            roughness={0.94}
          />
        </mesh>
      ))}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.006, -4]}>
        <ringGeometry args={[4.2, 4.32, 48]} />
        <meshBasicMaterial color="#eafff2" />
      </mesh>
      <group position={[0, 0, -16]}>
        <mesh position={[-3.66, 1.22, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 2.44, 8]} />
          <meshStandardMaterial color="#f3fff7" />
        </mesh>
        <mesh position={[3.66, 1.22, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 2.44, 8]} />
          <meshStandardMaterial color="#f3fff7" />
        </mesh>
        <mesh position={[0, 2.44, 0]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.06, 0.06, 7.32, 8]} />
          <meshStandardMaterial color="#f3fff7" />
        </mesh>
      </group>
      {Array.from({ length: 7 }, (_, row) => (
        <mesh key={row} position={[0, (2.28 + row * 0.62) / 2, -22 - row * 0.7]} receiveShadow>
          <boxGeometry args={[33, 2.28 + row * 0.62, 0.8]} />
          <meshStandardMaterial color={row % 2 ? "#536371" : "#5c6c7a"} roughness={0.92} />
        </mesh>
      ))}
      <mesh position={[0, 1.3, -21.52]} receiveShadow>
        <boxGeometry args={[33, 1.1, 0.08]} />
        <meshStandardMaterial map={artwork} roughness={0.85} />
      </mesh>
      <CinematicCrowd
        secondary={secondary}
        festive={festive}
        tint={primary}
        y={2.6}
        z={-22}
        rows={7}
        cols={44}
      />
      {[-14, 14].map((x) => (
        <group key={x} position={[x, 0, -18]}>
          <mesh position={[0, 5, 0]}>
            <cylinderGeometry args={[0.12, 0.16, 10, 8]} />
            <meshStandardMaterial color="#2a3330" roughness={0.6} metalness={0.4} />
          </mesh>
          <mesh position={[0, 10, 0.4]}>
            <boxGeometry args={[2.4, 0.9, 0.2]} />
            <meshBasicMaterial color="#f6fff9" toneMapped={false} />
          </mesh>
        </group>
      ))}
      {training ? (
        <CinematicTraining primary={primary} secondary={secondary} speaker={speaker} />
      ) : (
        Array.from({ length: 11 }).map((_, i) => (
          <Figure
            key={i}
            x={festive && i === 0 ? 0 : festive && i === 5 ? -5.2 : -5.2 + i * 1.06}
            z={0.4 + (i % 2) * 0.5}
            role={i === 0 ? "captain" : undefined}
            holdingTrophy={festive && i === 0}
            pose="stand"
            color={i < 6 ? primary : secondary}
            seed={i * 9 + 1}
            acting={i === 0 && speaker === "captain"}
          />
        ))
      )}
      {festive ? <CelebrationRain /> : null}
      <mesh position={[0, 0.11, 2.4]} castShadow>
        <sphereGeometry args={[0.11, 20, 16]} />
        <meshStandardMaterial color="#f7f9f2" roughness={0.42} />
      </mesh>
    </group>
  );
}
