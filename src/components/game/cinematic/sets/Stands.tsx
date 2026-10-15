import * as THREE from "three";
import { CinematicCrowd } from "../CinematicCrowd";
import { useCinematicArtwork } from "../cinematic-artwork";
import { hash } from "./shared";
import type { CinematicSetProps } from "./types";

export function Stands({ primary, secondary }: CinematicSetProps) {
  const artwork = useCinematicArtwork("stands", primary, secondary);
  return (
    <group>
      <mesh receiveShadow rotation-x={-Math.PI / 2}>
        <planeGeometry args={[48, 30]} />
        <meshStandardMaterial color="#14512c" roughness={0.95} />
      </mesh>
      {[
        { z: -12, rows: 10 },
        { z: 12, rows: 5 },
      ].map((section) =>
        Array.from({ length: section.rows }, (_, row) => (
          <mesh
            key={section.z + "-" + row}
            position={[0, (1.84 + row * 0.62) / 2, section.z - row * 0.7]}
            receiveShadow
          >
            <boxGeometry args={[37, 1.84 + row * 0.62, 0.75]} />
            <meshStandardMaterial color={row % 2 ? "#465e70" : "#536b7d"} roughness={0.92} />
          </mesh>
        )),
      )}
      <CinematicCrowd
        secondary={primary}
        festive
        tint={primary}
        y={2.2}
        z={-12}
        rows={10}
        cols={52}
      />
      <CinematicCrowd
        secondary={primary}
        festive
        tint={secondary}
        y={2.2}
        z={12}
        rows={5}
        cols={52}
      />
      {[-9, -3, 3, 9].map((x, i) => (
        <mesh key={x} position={[x, 3.4 + (i % 2) * 0.5, -9]} rotation-z={(hash(i) - 0.5) * 0.12}>
          <planeGeometry args={[3.4, 2]} />
          <meshStandardMaterial
            map={artwork}
            color={i % 2 ? "#ffffff" : "#e5e7dc"}
            roughness={0.8}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
      {[-18, 18].map((x) => (
        <mesh key={x} position={[x, 11, -14]}>
          <boxGeometry args={[3, 1.1, 0.3]} />
          <meshBasicMaterial color="#f6fff9" toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}
