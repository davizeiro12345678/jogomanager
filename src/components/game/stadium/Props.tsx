import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { FIELD_X, FIELD_Z } from "@/game/sim";
import { metalAlbedo, metalRoughness, grilleTexture } from "./textures/metal";

/**
 * Adereços do estádio: o que dá escala e "vida" à arena e que o jogador
 * reconhece de uma transmissão — banco de reservas coberto, túnel iluminado,
 * grades de setor, escadas, câmeras de TV, cabines de imprensa e portões.
 *
 * Tudo é geometria simples e compartilhada; nada aqui roda por quadro,
 * exceto o leve giro das câmeras de TV acompanhando a bola.
 */

export type PropsQuality = "alta" | "media" | "baixa";

function useMetal(color = "#8d949b", repeat = 3) {
  return useMemo(() => {
    const map = metalAlbedo();
    const rough = metalRoughness();
    const m = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.55,
      metalness: 0.65,
    });
    if (map) {
      const t = map.clone();
      t.needsUpdate = true;
      t.repeat.set(repeat, repeat);
      m.map = t;
    }
    if (rough) {
      const t = rough.clone();
      t.needsUpdate = true;
      t.repeat.set(repeat, repeat);
      m.roughnessMap = t;
    }
    return m;
  }, [color, repeat]);
}

/* ------------------------------------------------------------- reservas */

function Dugout({ x, color }: { x: number; color: string }) {
  const metal = useMetal("#9aa2aa", 2);
  const seats = useMemo(() => {
    const out: number[] = [];
    for (let i = -4; i <= 4; i++) out.push(i * 1.15);
    return out;
  }, []);
  return (
    <group position={[x, 0, -(FIELD_Z + 7.2)]}>
      {/* base */}
      <mesh position={[0, 0.25, 0]} receiveShadow>
        <boxGeometry args={[11.4, 0.5, 3.4]} />
        <meshStandardMaterial color="#20262c" roughness={0.95} />
      </mesh>
      {/* assentos individuais na cor do clube */}
      {seats.map((z, i) => (
        <group key={i} position={[z, 0.75, -0.4]}>
          <mesh castShadow>
            <boxGeometry args={[0.9, 0.14, 0.85]} />
            <meshStandardMaterial color={color} roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.42, -0.4]}>
            <boxGeometry args={[0.9, 0.8, 0.12]} />
            <meshStandardMaterial color={color} roughness={0.7} />
          </mesh>
        </group>
      ))}
      {/* estrutura + cobertura acrílica */}
      {[-5.6, 5.6].map((sx) => (
        <mesh key={sx} position={[sx, 1.3, 1.5]} material={metal}>
          <cylinderGeometry args={[0.09, 0.09, 2.6, 8]} />
        </mesh>
      ))}
      <mesh position={[0, 2.55, 0.2]} rotation={[-0.1, 0, 0]} castShadow material={metal}>
        <boxGeometry args={[11.6, 0.14, 4]} />
      </mesh>
      <mesh position={[0, 1.7, 1.75]}>
        <planeGeometry args={[11.4, 1.9]} />
        <meshPhysicalMaterial
          color="#8fb6cf"
          transparent
          opacity={0.22}
          roughness={0.08}
          metalness={0}
          transmission={0.6}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, 1.7, -1.75]}>
        <planeGeometry args={[11.4, 2.2]} />
        <meshStandardMaterial color="#151a1f" roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/* ---------------------------------------------------------------- túnel */

function Tunnel() {
  return (
    <group position={[0, 0, -(FIELD_Z + 9.5)]}>
      <mesh position={[0, 1.9, 0]}>
        <boxGeometry args={[7.4, 3.8, 7]} />
        <meshStandardMaterial color="#12161b" roughness={1} />
      </mesh>
      {/* boca do túnel, com luz quente vindo de dentro */}
      <mesh position={[0, 1.6, 3.55]}>
        <planeGeometry args={[5, 3.2]} />
        <meshStandardMaterial
          color="#0a0d10"
          emissive="#ffcf94"
          emissiveIntensity={0.35}
          roughness={1}
        />
      </mesh>
      <pointLight position={[0, 2, 2.4]} intensity={30} distance={16} color="#ffd6a2" />
    </group>
  );
}

/* ------------------------------------------------------ grades e escadas */

function SectorGrilles({ rings }: { rings: number }) {
  const tex = useMemo(() => grilleTexture(), []);
  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      color: "#b9c2cb",
      roughness: 0.5,
      metalness: 0.6,
      transparent: true,
      alphaTest: 0.35,
      side: THREE.DoubleSide,
    });
    if (tex) {
      const t = tex.clone();
      t.needsUpdate = true;
      t.repeat.set(8, 1);
      m.map = t;
      m.alphaMap = t;
    }
    return m;
  }, [tex]);

  const height = 2.0 + rings * 1.45;
  return (
    <group>
      {/* grade baixa separando o campo da primeira fila */}
      {[-1, 1].map((z) => (
        <mesh key={`z${z}`} position={[0, 1.1, z * (FIELD_Z + 7.6)]} material={mat}>
          <planeGeometry args={[FIELD_X * 2 + 24, 2.2]} />
        </mesh>
      ))}
      {[-1, 1].map((x) => (
        <mesh
          key={`x${x}`}
          position={[x * (FIELD_X + 9.6), 1.1, 0]}
          rotation={[0, Math.PI / 2, 0]}
          material={mat}
        >
          <planeGeometry args={[FIELD_Z * 2 + 20, 2.2]} />
        </mesh>
      ))}
      {/* corredores: faixas de escada subindo os anéis, a cada setor */}
      {[-1, 1].map((z) =>
        [-3, -1.5, 0, 1.5, 3].map((k) => (
          <mesh
            key={`s${z}${k}`}
            position={[k * 18, height / 2 + 1, z * (FIELD_Z + 8.5 + (rings * 1.5) / 2)]}
            rotation={[z > 0 ? -0.76 : 0.76, 0, 0]}
          >
            <boxGeometry args={[1.6, 0.16, Math.max(4, rings * 2.1)]} />
            <meshStandardMaterial color="#8d949b" roughness={0.85} />
          </mesh>
        )),
      )}
    </group>
  );
}

/* --------------------------------------------------------- câmeras de TV */

function TvCameras({ ball }: { ball: { x: number; z: number } }) {
  const refs = useRef<(THREE.Group | null)[]>([]);
  const spots = useMemo(
    () =>
      [
        [-32, FIELD_Z + 10.5],
        [0, FIELD_Z + 11.5],
        [32, FIELD_Z + 10.5],
        [-(FIELD_X + 12), 0],
        [FIELD_X + 12, 0],
      ] as const,
    [],
  );
  useFrame(() => {
    refs.current.forEach((g, i) => {
      if (!g) return;
      const s = spots[i]!;
      g.rotation.y = Math.atan2(ball.x - s[0], ball.z - s[1]) + Math.PI;
    });
  });
  return (
    <group>
      {spots.map((s, i) => (
        <group key={i} position={[s[0], 0, s[1]]}>
          {/* tripé */}
          {[0, 2.1, 4.2].map((a) => (
            <mesh
              key={a}
              position={[Math.sin(a) * 0.4, 0.8, Math.cos(a) * 0.4]}
              rotation={[Math.cos(a) * 0.25, 0, -Math.sin(a) * 0.25]}
            >
              <cylinderGeometry args={[0.045, 0.045, 1.7, 6]} />
              <meshStandardMaterial color="#20262c" roughness={0.8} />
            </mesh>
          ))}
          <group
            ref={(el) => {
              refs.current[i] = el;
            }}
            position={[0, 1.75, 0]}
          >
            <mesh castShadow>
              <boxGeometry args={[0.5, 0.42, 1.1]} />
              <meshStandardMaterial color="#101418" roughness={0.7} metalness={0.2} />
            </mesh>
            <mesh position={[0, 0.02, 0.72]}>
              <cylinderGeometry args={[0.16, 0.19, 0.5, 12]} />
              <meshStandardMaterial color="#0b0e11" roughness={0.4} metalness={0.5} />
            </mesh>
            <mesh position={[0, 0.3, -0.2]}>
              <boxGeometry args={[0.28, 0.2, 0.28]} />
              <meshStandardMaterial color="#e6eef6" roughness={0.6} />
            </mesh>
          </group>
          {/* operador */}
          <mesh position={[0, 0.9, -0.75]}>
            <capsuleGeometry args={[0.24, 0.8, 3, 8]} />
            <meshStandardMaterial color="#1d2b3a" roughness={0.9} />
          </mesh>
          <mesh position={[0, 1.62, -0.75]}>
            <sphereGeometry args={[0.17, 10, 8]} />
            <meshStandardMaterial color="#d7a377" roughness={0.75} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* -------------------------------------------------- imprensa e camarotes */

function PressBoxes({ rings }: { rings: number }) {
  const top = 2.0 + rings * 1.45;
  const glass = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: "#9dc6e0",
        roughness: 0.06,
        metalness: 0.1,
        transmission: 0.55,
        transparent: true,
        opacity: 0.5,
      }),
    [],
  );
  return (
    <group>
      {[-1, 1].map((z) => (
        <group key={z} position={[0, top - 1.2, z * (FIELD_Z + 7 + rings * 1.5 - 2)]}>
          <mesh>
            <boxGeometry args={[FIELD_X * 1.5, 3, 3.2]} />
            <meshStandardMaterial color="#2b333b" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.35, z * 1.68]} material={glass}>
            <planeGeometry args={[FIELD_X * 1.5 - 2, 1.9]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ------------------------------------------------------ portões e placas */

function Gates({ rings, color }: { rings: number; color: string }) {
  const out: React.ReactElement[] = [];
  const zEdge = FIELD_Z + 10 + rings * 1.5;
  for (let i = -2; i <= 2; i++) {
    for (const z of [-1, 1]) {
      out.push(
        <group key={`g${i}${z}`} position={[i * 24, 0, z * zEdge]}>
          <mesh position={[0, 2.1, 0]}>
            <boxGeometry args={[5.4, 4.2, 0.5]} />
            <meshStandardMaterial color="#1b2127" roughness={0.95} />
          </mesh>
          <mesh position={[0, 4.7, 0.3]}>
            <boxGeometry args={[5.6, 0.9, 0.2]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={0.28}
              roughness={0.6}
            />
          </mesh>
        </group>,
      );
    }
  }
  return <group>{out}</group>;
}

function RoofCanopy({ rings, color }: { rings: number; color: string }) {
  const metal = useMetal("#737e88", 4);
  const top = 7 + rings * 1.45;
  const edge = FIELD_Z + 11 + rings * 1.5;
  const length = FIELD_X * 2 + 34;

  return (
    <group>
      {[-1, 1].map((side) => (
        <group key={side} position={[0, top, side * edge]}>
          <mesh material={metal} castShadow>
            <boxGeometry args={[length, 0.28, 5.8]} />
          </mesh>
          <mesh position={[0, -0.16, -side * 2.55]}>
            <boxGeometry args={[length - 2, 0.08, 0.08]} />
            <meshBasicMaterial color={color} toneMapped={false} />
          </mesh>
          {[-1, -0.5, 0, 0.5, 1].map((fraction) => (
            <mesh
              key={fraction}
              position={[fraction * (length - 4), -1.45, -side * 1.7]}
              rotation={[0, 0, side * 0.18]}
              material={metal}
            >
              <boxGeometry args={[0.16, 2.9, 0.16]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------- conjunto */

export function StadiumProps({
  rings,
  quality,
  homeColor,
  awayColor,
  ball,
}: {
  rings: number;
  quality: PropsQuality;
  homeColor: string;
  awayColor: string;
  ball: { x: number; z: number };
}) {
  return (
    <group>
      <Dugout x={-14} color={homeColor} />
      <Dugout x={14} color={awayColor} />
      <Tunnel />
      {quality !== "baixa" && <SectorGrilles rings={rings} />}
      {quality !== "baixa" && <TvCameras ball={ball} />}
      {quality === "alta" && <PressBoxes rings={rings} />}
      {quality === "alta" && <RoofCanopy rings={rings} color={homeColor} />}
      {quality === "alta" && <Gates rings={rings} color={homeColor} />}
    </group>
  );
}
