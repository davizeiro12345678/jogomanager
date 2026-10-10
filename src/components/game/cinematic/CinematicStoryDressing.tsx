import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import type { SceneArt } from "@/content/cutscenes";
import type { QualityLevel } from "@/game/device";
import type { CinematicSet } from "@/game/cinematic-blocking";
import { cinematicSurface } from "./cinematic-surfaces";
import { useCinematicFrame } from "./cinematic-runtime";
import { useCinematicArtwork } from "./cinematic-artwork";

type DressingProps = {
  kind: CinematicSet;
  art: SceneArt;
  primary: string;
  secondary: string;
  quality: QualityLevel;
};

/** A small practical that keeps a location alive without adding a post pass. */
function StatusLight({
  position,
  color,
  phase = 0,
}: {
  position: [number, number, number];
  color: string;
  phase?: number;
}) {
  const material = useRef<THREE.MeshStandardMaterial>(null);
  useCinematicFrame((time) => {
    if (!material.current) return;
    material.current.emissiveIntensity = 0.7 + Math.sin(time * 1.7 + phase) * 0.22;
  });
  return (
    <mesh position={position} userData={{ cinematicDynamic: true }}>
      <boxGeometry args={[0.12, 0.12, 0.04]} />
      <meshStandardMaterial
        ref={material}
        color={color}
        emissive={color}
        emissiveIntensity={0.8}
        roughness={0.36}
      />
    </mesh>
  );
}

/** Thin line work makes the far goal read as a real net in a wide establishing shot. */
function GoalNet() {
  const geometry = useMemo(() => {
    const vertices: number[] = [];
    const add = (ax: number, ay: number, az: number, bx: number, by: number, bz: number) =>
      vertices.push(ax, ay, az, bx, by, bz);
    for (let x = -3.52; x <= 3.53; x += 0.44) add(x, 0.04, -0.62, x, 2.36, -0.62);
    for (let y = 0.14; y < 2.37; y += 0.31) add(-3.52, y, -0.62, 3.52, y, -0.62);
    for (let x = -3.52; x <= 3.53; x += 0.7) add(x, 0.04, 0, x, 0.04, -0.62);
    const value = new THREE.BufferGeometry();
    value.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    return value;
  }, []);
  const material = useMemo(
    () => new THREE.LineBasicMaterial({ color: "#dcece4", transparent: true, opacity: 0.52 }),
    [],
  );
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  return <lineSegments position={[0, 0, -15.95]} geometry={geometry} material={material} />;
}

function LockerDressing({ primary, secondary, art, quality }: DressingProps) {
  const medical = art === "medical";
  const gym = art === "gym";
  const dressing = art === "dressing";
  const artwork = useCinematicArtwork(
    medical ? "medical" : gym ? "gym" : "locker",
    primary,
    secondary,
  );
  return (
    <group>
      <mesh position={[0, 3.64, -4.23]}>
        <planeGeometry args={[8, 1.25]} />
        <meshStandardMaterial map={artwork} roughness={0.82} />
      </mesh>
      {/* Boots, bags and bottles give the foreground a lived-in matchday story. */}
      {[-2.55, -1.72, 1.72, 2.55].map((x, index) => (
        <group key={x} position={[x, 0, 1.25]} rotation-y={(index % 2 ? 1 : -1) * 0.16}>
          <mesh position={[0, 0.1, 0]} castShadow>
            <sphereGeometry args={[0.17, quality === "alta" ? 12 : 8, 6]} />
            <meshStandardMaterial color={index % 2 ? primary : secondary} roughness={0.58} />
          </mesh>
          <mesh position={[0.21, 0.1, 0.04]} castShadow>
            <sphereGeometry args={[0.14, quality === "alta" ? 12 : 8, 6]} />
            <meshStandardMaterial color="#18242c" roughness={0.72} />
          </mesh>
        </group>
      ))}
      {[-5.3, 5.3].map((x, index) => (
        <group key={x} position={[x, 0, -1.2]}>
          <mesh position={[0, 0.27, 0]} castShadow>
            <boxGeometry args={[0.82, 0.42, 0.42]} />
            <meshStandardMaterial color={index ? "#28343d" : "#344853"} roughness={0.82} />
          </mesh>
          <mesh position={[0, 0.49, 0]}>
            <torusGeometry args={[0.21, 0.03, 6, 12]} />
            <meshStandardMaterial color="#8798a1" metalness={0.68} roughness={0.32} />
          </mesh>
        </group>
      ))}
      {[
        [-4.5, 0.22, -3.58],
        [-3.93, 0.22, -3.58],
        [3.9, 0.22, -3.58],
        [4.47, 0.22, -3.58],
      ].map(([x, y, z], index) => (
        <group key={`${x}-${z}`} position={[x!, y!, z!]}>
          <mesh>
            <cylinderGeometry args={[0.055, 0.065, 0.32, 10]} />
            <meshStandardMaterial color={index % 2 ? primary : "#d8e4e7"} roughness={0.38} />
          </mesh>
          <mesh position={[0, 0.18, 0]}>
            <cylinderGeometry args={[0.035, 0.035, 0.035, 10]} />
            <meshStandardMaterial color="#eaf1eb" roughness={0.38} />
          </mesh>
        </group>
      ))}
      {(medical || gym) && (
        <group position={[4.95, 0, -2.7]}>
          <mesh position={[0, 0.16, 0]} receiveShadow>
            <boxGeometry args={[1.45, 0.1, 0.75]} />
            <meshStandardMaterial color={medical ? "#d7e6e5" : "#183640"} roughness={0.92} />
          </mesh>
          <mesh position={[0, 0.22, 0]}>
            <planeGeometry args={[1.28, 0.58]} />
            <meshStandardMaterial color={medical ? "#8fc0c4" : primary} roughness={0.92} />
          </mesh>
        </group>
      )}
      {dressing && quality !== "baixa" && (
        <>
          {/* A restrained club strip and TV unit anchor the pre-match talk in a
              real occasion instead of a generic locker close-up. Both are
              static, so CinematicSetBatch folds them into the room budget. */}
          <ClubTvCamera primary={primary} secondary={secondary} quality={quality} />
        </>
      )}
      <StatusLight position={[-6.82, 2.14, -3.52]} color={medical ? "#78d2b8" : primary} />
    </group>
  );
}

/** A practical club-TV camera makes a recorded team talk legible from a wide shot. */
function ClubTvCamera({
  primary,
  secondary,
  quality,
}: {
  primary: string;
  secondary: string;
  quality: QualityLevel;
}) {
  const radial = quality === "alta" ? 10 : 8;
  return (
    <group position={[3.7, 0, -0.72]} rotation-y={-2.72}>
      <mesh position={[0, 1.42, 0]} castShadow>
        <boxGeometry args={[0.48, 0.3, 0.34]} />
        <meshStandardMaterial color="#17232b" metalness={0.58} roughness={0.34} />
      </mesh>
      <mesh position={[0, 1.42, -0.27]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.14, 0.11, 0.24, radial]} />
        <meshStandardMaterial color="#0b1116" metalness={0.68} roughness={0.24} />
      </mesh>
      <mesh position={[-0.17, 1.58, 0.12]}>
        <boxGeometry args={[0.11, 0.08, 0.08]} />
        <meshStandardMaterial
          color={primary}
          emissive={primary}
          emissiveIntensity={0.28}
          roughness={0.38}
        />
      </mesh>
      <mesh position={[0.18, 1.53, 0.18]}>
        <sphereGeometry args={[0.034, radial, 5]} />
        <meshStandardMaterial
          color="#ff5d55"
          emissive="#ff3126"
          emissiveIntensity={1.15}
          roughness={0.32}
        />
      </mesh>
      <mesh position={[0, 0.75, 0]}>
        <cylinderGeometry args={[0.035, 0.05, 1.15, 6]} />
        <meshStandardMaterial color="#33444d" metalness={0.66} roughness={0.4} />
      </mesh>
      {[-0.28, 0, 0.28].map((x) => (
        <mesh key={x} position={[x, 0.22, x === 0 ? 0.31 : -0.22]} rotation-z={x * 1.15}>
          <cylinderGeometry args={[0.018, 0.018, 0.88, 6]} />
          <meshStandardMaterial color={secondary} metalness={0.58} roughness={0.42} />
        </mesh>
      ))}
    </group>
  );
}

function TunnelDressing({ primary, secondary, quality }: DressingProps) {
  const artwork = useCinematicArtwork("tunnel", primary, secondary);
  return (
    <group>
      {/* Repeated structural signs sell the length of the tunnel without a texture download. */}
      {[-1.3, -4.3, -7.3, -10.3].map((z) => (
        <group key={z} position={[0, 2.67, z]}>
          <mesh>
            <boxGeometry args={[2.18, 0.36, 0.035]} />
            <meshStandardMaterial color="#16242c" roughness={0.7} metalness={0.22} />
          </mesh>
          <mesh position={[0, 0, 0.022]}>
            <planeGeometry args={[2.05, 0.31]} />
            <meshStandardMaterial map={artwork} roughness={0.78} />
          </mesh>
        </group>
      ))}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 2.88, 0, -7.2]}>
          {Array.from({ length: 6 }, (_, index) => (
            <mesh key={index} position={[0, 0.05, -index * 1.6]} rotation-x={-Math.PI / 2}>
              <planeGeometry args={[0.12, 0.72]} />
              <meshStandardMaterial color={index % 2 ? primary : secondary} roughness={0.75} />
            </mesh>
          ))}
        </group>
      ))}
      <mesh position={[0, 0.012, -7.5]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[1.15, 16.6]} />
        <meshStandardMaterial
          color="#899fa3"
          map={cinematicSurface("asphalt")}
          roughness={0.46}
          metalness={0.22}
        />
      </mesh>
      {quality !== "baixa" && (
        <StatusLight position={[2.72, 2.47, -7.1]} color={primary} phase={1.1} />
      )}
    </group>
  );
}

function PressCamera({ x, z, angle = 0 }: { x: number; z: number; angle?: number }) {
  return (
    <group position={[x, 0, z]} rotation-y={angle}>
      <mesh position={[0, 1.16, 0]} castShadow>
        <boxGeometry args={[0.46, 0.3, 0.32]} />
        <meshStandardMaterial color="#1c2830" roughness={0.46} metalness={0.5} />
      </mesh>
      <mesh position={[0, 1.16, -0.27]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.14, 0.11, 0.28, 12]} />
        <meshStandardMaterial color="#10171c" roughness={0.31} metalness={0.64} />
      </mesh>
      <mesh position={[0, 0.78, 0]}>
        <cylinderGeometry args={[0.032, 0.045, 0.72, 8]} />
        <meshStandardMaterial color="#2e3c44" metalness={0.72} roughness={0.34} />
      </mesh>
      {[-0.31, 0, 0.31].map((offset) => (
        <mesh key={offset} position={[offset, 0.36, 0]} rotation-z={offset * 0.95}>
          <cylinderGeometry args={[0.018, 0.018, 0.78, 6]} />
          <meshStandardMaterial color="#34444c" metalness={0.65} roughness={0.42} />
        </mesh>
      ))}
    </group>
  );
}

function PressDressing({ primary, secondary, quality }: DressingProps) {
  const artwork = useCinematicArtwork("press", primary, secondary);
  return (
    <group>
      <PressCamera x={-4.85} z={1.18} angle={0.22} />
      <PressCamera x={4.85} z={1.18} angle={-0.22} />
      {quality === "alta" && <PressCamera x={0} z={2.1} />}
      {[-5.45, 5.45].map((x) => (
        <group key={x} position={[x, 0, -3.72]}>
          <mesh position={[0, 1.4, 0]}>
            <boxGeometry args={[1.15, 1.7, 0.035]} />
            <meshStandardMaterial map={artwork} roughness={0.82} />
          </mesh>
          <mesh position={[0, 1.75, 0.024]}>
            <boxGeometry args={[0.74, 0.12, 0.012]} />
            <meshStandardMaterial
              color={primary}
              emissive={primary}
              emissiveIntensity={0.16}
              roughness={0.54}
            />
          </mesh>
          <mesh position={[0, 1.15, 0.024]}>
            <boxGeometry args={[0.58, 0.05, 0.012]} />
            <meshStandardMaterial color={secondary} roughness={0.7} />
          </mesh>
        </group>
      ))}
      <StatusLight position={[-5.45, 2.15, -3.65]} color={secondary} phase={0.6} />
    </group>
  );
}

function PitchDressing({ primary, secondary, art, quality }: DressingProps) {
  const training = art === "training";
  return (
    <group>
      <StadiumCanopy kind="pitch" primary={primary} />
      <GoalNet />
      {[-10.6, 10.6].map((x) => (
        <group key={x} position={[x, 0, -4.6]}>
          <mesh position={[0, 0.58, 0]}>
            <cylinderGeometry args={[0.025, 0.025, 1.16, 8]} />
            <meshStandardMaterial color="#dce9df" roughness={0.48} />
          </mesh>
          <mesh position={[x > 0 ? -0.18 : 0.18, 1.04, 0]}>
            <planeGeometry args={[0.34, 0.22]} />
            <meshStandardMaterial
              color={x > 0 ? primary : secondary}
              side={THREE.DoubleSide}
              roughness={0.7}
            />
          </mesh>
        </group>
      ))}
      {[-11.5, 11.5].map((x) => (
        <mesh key={x} position={[x, 0.48, -10]} receiveShadow>
          <boxGeometry args={[0.62, 0.46, 9.2]} />
          <meshStandardMaterial color="#314451" roughness={0.84} />
        </mesh>
      ))}
      {!training && (
        <group position={[-8.8, 0, -12.4]}>
          <mesh position={[0, 0.31, 0]}>
            <boxGeometry args={[3.4, 0.6, 0.62]} />
            <meshStandardMaterial color="#24323b" roughness={0.76} />
          </mesh>
          {[-1.1, 0, 1.1].map((x) => (
            <mesh key={x} position={[x, 0.66, 0]}>
              <boxGeometry args={[0.72, 0.12, 0.42]} />
              <meshStandardMaterial color={x === 0 ? primary : secondary} roughness={0.68} />
            </mesh>
          ))}
        </group>
      )}
      {quality === "alta" && (
        <StatusLight position={[-14, 9.55, -17.72]} color="#eaf6ed" phase={0.8} />
      )}
    </group>
  );
}

function StandsDressing({ primary, secondary, quality }: DressingProps) {
  const artwork = useCinematicArtwork("stands", primary, secondary);
  return (
    <group>
      <StadiumCanopy kind="stands" primary={primary} />
      <mesh position={[0, 5.75, -14.32]}>
        <boxGeometry args={[6.1, 2.15, 0.18]} />
        <meshStandardMaterial color="#182832" metalness={0.36} roughness={0.48} />
      </mesh>
      <mesh position={[0, 5.75, -14.2]}>
        <planeGeometry args={[5.6, 1.62]} />
        <meshStandardMaterial map={artwork} roughness={0.58} />
      </mesh>
      <mesh position={[0, 4.58, -14.08]}>
        <boxGeometry args={[4.72, 0.11, 0.024]} />
        <meshStandardMaterial
          color={secondary}
          emissive={secondary}
          emissiveIntensity={0.22}
          roughness={0.46}
        />
      </mesh>
      {[-14.5, -7.25, 7.25, 14.5].map((x) => (
        <group key={x} position={[x, 0, -8.2]}>
          <mesh position={[0, 1.1, 0]}>
            <cylinderGeometry args={[0.045, 0.045, 2.2, 8]} />
            <meshStandardMaterial color="#a2b2b9" metalness={0.72} roughness={0.35} />
          </mesh>
          <mesh position={[0, 2.12, 0]} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.038, 0.038, 1.4, 8]} />
            <meshStandardMaterial color="#a2b2b9" metalness={0.72} roughness={0.35} />
          </mesh>
        </group>
      ))}
      {quality !== "baixa" && (
        <StatusLight position={[0, 6.62, -14.06]} color={secondary} phase={1.8} />
      )}
    </group>
  );
}

function OfficeDressing({ primary, secondary, art, quality }: DressingProps) {
  const board = art === "board" || art === "transfer";
  const artwork = useCinematicArtwork("office", primary, secondary);
  return (
    <group>
      {/* A low desk blotter separates the printed papers from the wood grain.
          It stays below the business folio and outside every actor mark. */}
      <mesh position={[0.02, 0.806, -1.37]}>
        <boxGeometry args={[2.8, 0.009, 1.1]} />
        <meshStandardMaterial color="#20313c" roughness={0.85} />
      </mesh>
      <mesh position={[0.02, 0.812, -0.865]}>
        <boxGeometry args={[2.65, 0.003, 0.014]} />
        <meshStandardMaterial color="#ac9370" roughness={0.85} />
      </mesh>
      {/* The main folio owns the right-hand signing area; loose scouting
          notes occupy the left side so sheets never intersect. */}
      {[
        [-0.91, -1.58, -0.08],
        [-0.82, -1.54, -0.04],
        [-0.35, -1.02, 0.07],
      ].map(([x, z, rotation], index) => (
        <mesh
          key={index}
          position={[x!, 0.819 + index * 0.002, z!]}
          rotation={[-Math.PI / 2, 0, rotation!]}
        >
          <planeGeometry args={[0.42, 0.28]} />
          <meshStandardMaterial color={index === 1 ? "#edf0e7" : "#d6c29a"} roughness={0.92} />
        </mesh>
      ))}
      <group position={[2.52, 0, -3.58]}>
        {Array.from({ length: 4 }, (_, index) => (
          <mesh key={index} position={[0, 0.38 + index * 0.18, 0]}>
            <boxGeometry args={[0.72, 0.16, 0.32]} />
            <meshStandardMaterial
              color={index % 2 ? secondary : primary}
              map={cinematicSurface("wood")}
              roughness={0.76}
            />
          </mesh>
        ))}
      </group>
      <group position={[-2.7, 0, -1.78]}>
        <mesh position={[0, 0.52, 0]}>
          <cylinderGeometry args={[0.038, 0.055, 1.04, 8]} />
          <meshStandardMaterial color="#8d7660" metalness={0.45} roughness={0.48} />
        </mesh>
        <mesh position={[0.16, 1.05, 0]} rotation-z={0.48}>
          <cylinderGeometry args={[0.032, 0.042, 0.58, 8]} />
          <meshStandardMaterial color="#bca57e" metalness={0.52} roughness={0.32} />
        </mesh>
        <mesh position={[0.31, 1.33, 0]} rotation-z={Math.PI / 2}>
          <coneGeometry args={[0.26, 0.34, quality === "alta" ? 14 : 8, 1, true]} />
          <meshStandardMaterial
            color="#e9c589"
            emissive="#e6a75c"
            emissiveIntensity={0.35}
            roughness={0.5}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
      {board && (
        <group position={[-6.84, 2.45, -0.8]} rotation-y={Math.PI / 2}>
          <mesh>
            <boxGeometry args={[2.78, 1.7, 0.055]} />
            <meshStandardMaterial color="#ac9370" roughness={0.85} />
          </mesh>
          <mesh position={[0, 0, 0.032]}>
            <planeGeometry args={[2.7, 1.62]} />
            <meshStandardMaterial map={artwork} roughness={0.82} />
          </mesh>
        </group>
      )}
      <StatusLight position={[-2.36, 1.39, -1.78]} color="#ffd38d" phase={0.4} />
    </group>
  );
}

function ArrivalDressing({ primary, secondary, quality }: DressingProps) {
  const artwork = useCinematicArtwork("arrival", primary, secondary);
  return (
    <group>
      <mesh position={[0, 4.76, -11.28]}>
        <planeGeometry args={[10, 1.32]} />
        <meshStandardMaterial map={artwork} roughness={0.82} />
      </mesh>
      {[-4.5, -1.5, 1.5, 4.5].map((x, index) => (
        <group key={x} position={[x, 0, 4.15]}>
          <mesh position={[0, 0.32, 0]}>
            <coneGeometry args={[0.2, 0.64, 12]} />
            <meshStandardMaterial color={index % 2 ? primary : "#d96a39"} roughness={0.78} />
          </mesh>
          <mesh position={[0, 0.025, 0]}>
            <cylinderGeometry args={[0.26, 0.26, 0.05, 12]} />
            <meshStandardMaterial color="#d5d0be" roughness={0.8} />
          </mesh>
        </group>
      ))}
      <group position={[4.55, 0, 1.3]}>
        <mesh position={[0, 0.42, 0]} castShadow>
          <boxGeometry args={[0.68, 0.84, 0.36]} />
          <meshStandardMaterial color="#293941" roughness={0.64} />
        </mesh>
        <mesh position={[0, 0.91, 0]}>
          <torusGeometry args={[0.16, 0.022, 6, 12]} />
          <meshStandardMaterial color="#9daeb4" metalness={0.65} roughness={0.34} />
        </mesh>
      </group>
      {[-8.9, 8.9].map((x) => (
        <mesh key={x} position={[x, 0.018, -1.4]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[0.11, 9.6]} />
          <meshStandardMaterial color={secondary} roughness={0.86} />
        </mesh>
      ))}
      {quality !== "baixa" && (
        <StatusLight position={[-5.17, 1.3, 3.84]} color="#3d87ff" phase={1.3} />
      )}
    </group>
  );
}

/** Structural depth rather than more crowd actors. Opaque steel shares the
 * existing terrace batch; no shadows, lights or transparent roof layers. */
function StadiumCanopy({ kind, primary }: { kind: "pitch" | "stands"; primary: string }) {
  const z = kind === "pitch" ? -24.4 : -16;
  const y = kind === "pitch" ? 7.2 : 9.3;
  const width = kind === "pitch" ? 33 : 37;
  return (
    <group position={[0, y, z]}>
      <mesh position={[0, 0.1, 0]} receiveShadow>
        <boxGeometry args={[width + 1, 0.2, 6.6]} />
        <meshStandardMaterial color="#394e60" roughness={0.92} />
      </mesh>
      <mesh position={[0, -0.19, 3.25]} receiveShadow>
        <boxGeometry args={[width + 1, 0.42, 0.15]} />
        <meshStandardMaterial color={primary} roughness={0.92} />
      </mesh>
      {[-0.43, -0.21, 0, 0.21, 0.43].map((fraction) => (
        <group key={fraction} position={[fraction * width, 0, 0]}>
          <mesh position={[0, -0.5, 0]} receiveShadow>
            <boxGeometry args={[0.1, 0.12, 6.4]} />
            <meshStandardMaterial color="#a1b0b8" roughness={0.92} />
          </mesh>
          <mesh position={[0, -y / 2, -2.5]} receiveShadow>
            <boxGeometry args={[0.22, y, 0.22]} />
            <meshStandardMaterial color="#627787" roughness={0.92} />
          </mesh>
          <mesh position={[0, -0.95, 0.15]} rotation-x={-0.22} receiveShadow>
            <boxGeometry args={[0.075, 0.075, 5.9]} />
            <meshStandardMaterial color="#859aa6" roughness={0.92} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Set-specific foreground and background objects give every shot a place and a story. */
export function CinematicStoryDressing(props: DressingProps) {
  switch (props.kind) {
    case "locker":
      return <LockerDressing {...props} />;
    case "tunnel":
      return <TunnelDressing {...props} />;
    case "press":
      return <PressDressing {...props} />;
    case "pitch":
      return <PitchDressing {...props} />;
    case "stands":
      return <StandsDressing {...props} />;
    case "office":
      return <OfficeDressing {...props} />;
    case "arrival":
      return <ArrivalDressing {...props} />;
  }
}
