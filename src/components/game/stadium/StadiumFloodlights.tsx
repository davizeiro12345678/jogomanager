import * as THREE from "three";
import { FIELD_X, FIELD_Z } from "@/game/sim-rules";
import type { TimeOfDay } from "@/game/matchday";
import type { Quality } from "../Stadium3D";
import { StaticBatch } from "./StaticBatch";
import { lightGlowTexture } from "./textures/light-glow";

export function Floodlights({ time, quality }: { time: TimeOfDay; quality: Quality }) {
  const on = time !== "dia";
  const lampColor = time === "entardecer" ? "#ffe2c7" : "#e8f2ff";
  const haloColor = time === "entardecer" ? "#ffd1aa" : "#cfe3ff";
  const spots: [number, number][] = [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ];
  const lamps = [-2.6, -0.9, 0.9, 2.6];
  return (
    <StaticBatch signature={`floodlights:${time}:${quality}`}>
      {spots.map(([sx, sz], i) => {
        const px = sx * (FIELD_X + 20);
        const pz = sz * (FIELD_Z + 22);
        const dist = Math.hypot(px, pz);
        return (
          <group key={i} position={[px, 0, pz]}>
            {/* mastro treliçado */}
            <mesh position={[0, 14, 0]} castShadow>
              <cylinderGeometry args={[0.5, 0.9, 28, 8]} />
              <meshStandardMaterial color="#252c33" roughness={0.85} metalness={0.35} />
            </mesh>
            {[0, 1, 2, 3].map((k) => (
              <mesh key={k} position={[0, 6 + k * 6, 0]}>
                <torusGeometry args={[0.85, 0.07, 4, 10]} />
                <meshStandardMaterial color="#39424b" roughness={0.8} metalness={0.4} />
              </mesh>
            ))}
            {/* rack com lâmpadas individuais */}
            <mesh position={[0, 28.5, 0]}>
              <boxGeometry args={[8.6, 3.6, 0.6]} />
              <meshStandardMaterial color="#39424b" roughness={0.8} metalness={0.4} />
            </mesh>
            {lamps.map((lx) =>
              [0.85, -0.85].map((ly) => (
                <mesh key={`${lx}${ly}`} position={[lx, 28.5 + ly, 0.45]}>
                  <boxGeometry args={[1.5, 1.3, 0.3]} />
                  <meshStandardMaterial
                    color="#f5f8ff"
                    emissive={on ? lampColor : "#2b3138"}
                    emissiveIntensity={on ? (time === "entardecer" ? 2.8 : 3.6) : 0}
                    toneMapped={false}
                  />
                </mesh>
              )),
            )}
            {on && (
              <>
                {/* halo volumétrico curto, apenas em volta do rack */}
                {quality === "alta" && (
                  <mesh position={[0, 26, 0]} rotation={[Math.PI, 0, 0]}>
                    <coneGeometry args={[5.5, 9, 14, 1, true]} />
                    <meshBasicMaterial
                      color={haloColor}
                      transparent
                      opacity={0.05}
                      depthWrite={false}
                      side={THREE.DoubleSide}
                      blending={THREE.AdditiveBlending}
                      toneMapped={false}
                    />
                  </mesh>
                )}

                <sprite position={[0, 28.5, 0]} scale={[30, 30, 1]}>
                  <spriteMaterial
                    map={lightGlowTexture()}
                    color={haloColor}
                    opacity={time === "entardecer" ? 0.14 : 0.18}
                    transparent
                    depthWrite={false}
                    blending={THREE.AdditiveBlending}
                    toneMapped={false}
                  />
                </sprite>
                {quality === "alta" && (
                  <pointLight
                    position={[0, 28, 0]}
                    intensity={time === "entardecer" ? 1250 : 1700}
                    distance={230}
                    color={lampColor}
                  />
                )}
              </>
            )}
          </group>
        );
      })}
      {/* reflexo dos refletores no gramado úmido: discreto, colado nos cantos */}
      {on &&
        quality === "alta" &&
        spots.map(([sx, sz], i) => (
          <mesh
            key={`r${i}`}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[sx * (FIELD_X * 0.86), 0.02, sz * (FIELD_Z * 0.86)]}
          >
            <circleGeometry args={[10, 20]} />
            <meshBasicMaterial
              color="#9fc4ff"
              transparent
              opacity={0.02}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </mesh>
        ))}
    </StaticBatch>
  );
}
