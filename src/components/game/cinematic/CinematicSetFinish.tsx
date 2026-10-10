import { cinematicSurface } from "./cinematic-surfaces";

/** Architectural details share materials and are merged by CinematicSetBatch. */
export function CinematicSetFinish({ kind, primary }: { kind: string; primary: string }) {
  if (kind === "arrival")
    return (
      <group>
        <mesh position={[0, 3, -12]} receiveShadow>
          <boxGeometry args={[26, 6, 1.2]} />
          <meshStandardMaterial
            color="#344552"
            map={cinematicSurface("wall")}
            normalMap={cinematicSurface("wall", "normal")}
            normalScale={[0.08, 0.08]}
            roughnessMap={cinematicSurface("wall", "roughness")}
            roughness={0.88}
          />
        </mesh>
        <mesh position={[0, 5.5, -11.32]}>
          <boxGeometry args={[26, 0.12, 0.16]} />
          <meshStandardMaterial color={primary} roughness={0.6} />
        </mesh>
        {Array.from({ length: 13 }, (_, i) => (
          <group key={i} position={[-12 + i * 2, 0, -11.32]}>
            {[2.2, 4.2].map((y) => (
              <mesh key={y} position={[0, y, 0]}>
                <boxGeometry args={[1.38, 1.16, 0.06]} />
                <meshStandardMaterial
                  color="#0d1a22"
                  emissive="#8c7147"
                  emissiveIntensity={0.025}
                  roughness={0.5}
                  metalness={0.12}
                />
              </mesh>
            ))}
          </group>
        ))}
        {[-7.8, 7.8].map((x) => (
          <group key={x} position={[x, 0, -2]}>
            <mesh position={[0, 2.2, 0]}>
              <cylinderGeometry args={[0.055, 0.08, 4.4, 8]} />
              <meshStandardMaterial color="#6b7b85" metalness={0.6} roughness={0.4} />
            </mesh>
            <mesh position={[0, 4.42, 0]}>
              <boxGeometry args={[1.15, 0.08, 0.6]} />
              <meshStandardMaterial
                color="#c9d7dd"
                emissive="#ffe0ae"
                emissiveIntensity={1.4}
                roughness={0.5}
              />
            </mesh>
            <mesh position={[0, 0.2, -4]} receiveShadow>
              <boxGeometry args={[2.4, 0.4, 1.5]} />
              <meshStandardMaterial color="#293b35" roughness={0.9} />
            </mesh>
          </group>
        ))}
        {Array.from({ length: 15 }, (_, i) => (
          <mesh key={i} position={[-5.18, 0.58, -5.4 + i * 0.62]}>
            <boxGeometry args={[0.1, 1.15, 0.055]} />
            <meshStandardMaterial color="#81919b" roughness={0.45} metalness={0.65} />
          </mesh>
        ))}
        {[-3, 3].map((x) => (
          <mesh key={x} position={[x, 0.006, 0]} rotation-x={-Math.PI / 2}>
            <planeGeometry args={[0.075, 16]} />
            <meshStandardMaterial color="#a8a586" roughness={0.95} />
          </mesh>
        ))}
      </group>
    );
  if (!["locker", "press", "office", "tunnel"].includes(kind)) return null;
  const back = kind === "locker" ? -4.23 : -3.85;
  const width = kind === "press" ? 13 : kind === "tunnel" ? 6 : 14;
  return (
    <group>
      {kind !== "tunnel" && (
        <mesh position={[0, 2.4, 7.1]} receiveShadow>
          <boxGeometry args={[16, 4.8, 0.2]} />
          <meshStandardMaterial
            color="#35434d"
            map={cinematicSurface("wall")}
            normalMap={cinematicSurface("wall", "normal")}
            normalScale={[0.08, 0.08]}
            roughnessMap={cinematicSurface("wall", "roughness")}
            roughness={0.9}
          />
        </mesh>
      )}
      {(kind === "press" || kind === "office") &&
        [-7, 7].map((x) => (
          <mesh key={x} position={[x, 2.4, 1.5]} receiveShadow>
            <boxGeometry args={[0.2, 4.8, 11]} />
            <meshStandardMaterial
              color="#35434d"
              map={cinematicSurface("wall")}
              normalMap={cinematicSurface("wall", "normal")}
              normalScale={[0.08, 0.08]}
              roughnessMap={cinematicSurface("wall", "roughness")}
              roughness={0.9}
            />
          </mesh>
        ))}
      {kind === "press" &&
        Array.from({ length: 11 }, (_, i) => (
          <mesh key={i} position={[-5.5 + i * 1.05, 2.1, 6.96]}>
            <boxGeometry args={[0.66, 2.8, 0.07]} />
            <meshStandardMaterial color="#27343e" roughness={0.95} />
          </mesh>
        ))}
      {(kind === "locker" || kind === "office") && (
        <group position={[-4.7, 0, 6.95]}>
          <mesh position={[0, 1.25, 0]}>
            <boxGeometry args={[1.24, 2.5, 0.05]} />
            <meshStandardMaterial color="#172831" roughness={0.7} />
          </mesh>
          <mesh position={[0.46, 1.1, -0.045]}>
            <boxGeometry args={[0.1, 0.025, 0.05]} />
            <meshStandardMaterial color="#a2b4be" roughness={0.3} metalness={0.7} />
          </mesh>
        </group>
      )}
      {/* Floor skirting and restrained club-colour architectural bands. */}
      <mesh position={[0, 0.09, back]} receiveShadow>
        <boxGeometry args={[width, 0.18, 0.06]} />
        <meshStandardMaterial color="#737d84" metalness={0.6} roughness={0.38} />
      </mesh>
      <mesh position={[0, 3.16, back]}>
        <boxGeometry args={[width, 0.045, 0.055]} />
        <meshStandardMaterial color={primary} roughness={0.62} />
      </mesh>
      {[-4, 0, 4].map((x) => (
        <group key={x} position={[x, 3.8, -1.4]}>
          <mesh>
            <boxGeometry args={[2.8, 0.1, 0.62]} />
            <meshStandardMaterial color="#313b42" roughness={0.7} />
          </mesh>
          <mesh position={[0, -0.056, 0]} rotation-x={Math.PI / 2}>
            <planeGeometry args={[2.56, 0.42]} />
            <meshBasicMaterial color="#fff3e3" toneMapped={false} />
          </mesh>
        </group>
      ))}
      {kind === "locker" &&
        Array.from({ length: 9 }, (_, i) => (
          <group key={i} position={[-6.4 + i * 1.6, 0, -3.66]}>
            {/* Open compartments, padded back and an upper bag shelf. */}
            <mesh position={[0, 1.7, 0.02]}>
              <boxGeometry args={[1.22, 1.67, 0.035]} />
              <meshStandardMaterial
                color="#273944"
                map={cinematicSurface("wall")}
                normalMap={cinematicSurface("wall", "normal")}
                normalScale={[0.08, 0.08]}
                roughnessMap={cinematicSurface("wall", "roughness")}
                roughness={0.9}
              />
            </mesh>
            <mesh position={[0, 2.57, 0.01]} receiveShadow>
              <boxGeometry args={[1.3, 0.045, 0.45]} />
              <meshStandardMaterial color="#84939a" metalness={0.45} roughness={0.48} />
            </mesh>
            <mesh position={[0.3, 2.71, 0.02]} castShadow>
              <boxGeometry args={[0.45, 0.23, 0.25]} />
              <meshStandardMaterial color="#253540" roughness={0.94} />
            </mesh>
            <mesh position={[0, 0.505, 0.17]} receiveShadow>
              <boxGeometry args={[1.32, 0.035, 0.52]} />
              <meshStandardMaterial color="#303b43" roughness={0.9} />
            </mesh>
          </group>
        ))}
      {kind === "press" && (
        <group>
          <mesh position={[0, 0.44, -0.91]} castShadow receiveShadow>
            <boxGeometry args={[4.6, 0.61, 0.08]} />
            <meshStandardMaterial color="#24343f" roughness={0.65} />
          </mesh>
          <mesh position={[0, 0.46, -0.86]}>
            <boxGeometry args={[4.38, 0.018, 0.016]} />
            <meshStandardMaterial color={primary} roughness={0.4} />
          </mesh>
          {[-1.65, 1.65].map((x) => (
            <group key={x} position={[x, 0.94, -1.32]}>
              <mesh castShadow>
                <cylinderGeometry args={[0.044, 0.044, 0.2, 12]} />
                <meshPhysicalMaterial color="#b8d6e4" metalness={0.05} roughness={0.22} />
              </mesh>
              <mesh position={[0, 0.115, 0]}>
                <cylinderGeometry args={[0.025, 0.025, 0.03, 12]} />
                <meshStandardMaterial color="#d2dce3" roughness={0.6} />
              </mesh>
            </group>
          ))}
          {[-0.5, 0.45].map((x) => (
            <mesh key={x} position={[x, 0.847, -1.2]}>
              <cylinderGeometry args={[0.065, 0.08, 0.025, 14]} />
              <meshStandardMaterial color="#323d46" metalness={0.45} roughness={0.4} />
            </mesh>
          ))}
        </group>
      )}
      {kind === "office" && (
        <group>
          {/* Recessed desk apron gives the table weight while preserving room
              for legs and the contract surface at y=0.80. */}
          <mesh position={[0, 0.43, -0.96]}>
            <boxGeometry args={[3.44, 0.55, 0.045]} />
            <meshStandardMaterial color="#3c332d" roughness={0.85} />
          </mesh>
          <mesh position={[0, 0.67, -0.932]}>
            <boxGeometry args={[3.3, 0.026, 0.012]} />
            <meshStandardMaterial color="#ac9370" roughness={0.85} />
          </mesh>
          {/* The existing trophy cabinet receives solid shelf edges instead
              of another room, light or transparent glass volume. */}
          <group position={[-4.6, 0, -3.54]}>
            {[-1.9, 1.9].map((x) => (
              <mesh key={x} position={[x, 1.5, 0]}>
                <boxGeometry args={[0.07, 3.02, 0.1]} />
                <meshStandardMaterial color="#ac9370" roughness={0.85} />
              </mesh>
            ))}
            {[0.065, 1.03, 1.975, 2.95].map((y) => (
              <mesh key={y} position={[0, y, 0]}>
                <boxGeometry args={[3.84, 0.055, 0.1]} />
                <meshStandardMaterial color="#ac9370" roughness={0.85} />
              </mesh>
            ))}
          </group>
          {/* Window mullions and a stadium silhouette replace a luminous blank panel. */}
          {[2.12, 4.4, 6.68].map((x) => (
            <mesh key={x} position={[x, 2.2, -3.81]} castShadow>
              <boxGeometry args={[0.05, 2.66, 0.06]} />
              <meshStandardMaterial color="#798d99" metalness={0.8} roughness={0.27} />
            </mesh>
          ))}
          {[0.87, 3.53].map((y) => (
            <mesh key={y} position={[4.4, y, -3.81]}>
              <boxGeometry args={[4.66, 0.05, 0.06]} />
              <meshStandardMaterial color="#798d99" metalness={0.8} roughness={0.27} />
            </mesh>
          ))}
          {Array.from({ length: 4 }, (_, i) => (
            <mesh key={i} position={[4.4, 1.05 + i * 0.16, -3.84]}>
              <boxGeometry args={[4.48, 0.1, 0.018]} />
              <meshStandardMaterial
                color={i % 2 ? "#738a9a" : "#8093a0"}
                metalness={0.45}
                roughness={0.48}
              />
            </mesh>
          ))}
          <mesh position={[-0.37, 0.825, -1.63]}>
            <boxGeometry args={[0.5, 0.055, 0.34]} />
            <meshStandardMaterial color="#18262f" roughness={0.85} />
          </mesh>
        </group>
      )}
    </group>
  );
}
