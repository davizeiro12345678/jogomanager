import { Canvas, useFrame } from "@react-three/fiber";
import type React from "react";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { kitFor, gkKitFor, kitTexture, skinFor, hairFor, colorClash, type Kit } from "@/game/kits";
import { FIELD_X, FIELD_Z, type MatchSim, type SimPlayer } from "@/game/sim";

export type CameraMode = "broadcast" | "tactical" | "goal" | "fan" | "rail" | "behind";
export type Quality = "alta" | "media" | "baixa";

type TimeOfDay = "dia" | "entardecer" | "noite";

const SKY: Record<TimeOfDay, string> = {
  dia: "#8fbfe8",
  entardecer: "#3a2340",
  noite: "#060a10",
};

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/* ---------------------------------------------------------------- gramado */

function grassTexture() {
  if (typeof document === "undefined") return null;
  const size = 1024;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#1d7a45";
  ctx.fillRect(0, 0, size, size);

  // listras de corte diagonais
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.rotate(-0.22);
  ctx.translate(-size, -size);
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.055)" : "rgba(0,0,0,0.055)";
    ctx.fillRect(i * 72, 0, 72, size * 2);
  }
  ctx.restore();

  // desgaste / manchas
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.fillStyle = `rgba(${Math.random() > 0.5 ? "255,255,255" : "0,0,0"},${0.015 + Math.random() * 0.03})`;
    ctx.beginPath();
    ctx.ellipse(x, y, 6 + Math.random() * 26, 3 + Math.random() * 12, Math.random() * 3, 0, 7);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 8;
  return tex;
}

function Pitch({ quality }: { quality: Quality }) {
  const tex = useMemo(grassTexture, []);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow>
        <planeGeometry args={[FIELD_X * 2 + 34, FIELD_Z * 2 + 30]} />
        <meshStandardMaterial color="#124a2a" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[FIELD_X * 2 + 10, FIELD_Z * 2 + 10]} />
        <meshStandardMaterial
          {...(tex ? { map: tex } : { color: "#1d7a45" })}
          roughness={0.82}
          metalness={0.02}
        />
      </mesh>
      <Lines />
      <Goal side={1} quality={quality} />
      <Goal side={-1} quality={quality} />
      <CornerFlags />
      <Dugouts />
    </group>
  );
}

function line(points: [number, number][], y = 0.02) {
  return new THREE.BufferGeometry().setFromPoints(
    points.map(([x, z]) => new THREE.Vector3(x, y, z)),
  );
}

function Lines() {
  const geoms = useMemo(() => {
    const g: THREE.BufferGeometry[] = [];
    g.push(
      line([
        [-FIELD_X, -FIELD_Z],
        [FIELD_X, -FIELD_Z],
        [FIELD_X, FIELD_Z],
        [-FIELD_X, FIELD_Z],
        [-FIELD_X, -FIELD_Z],
      ]),
    );
    g.push(
      line([
        [0, -FIELD_Z],
        [0, FIELD_Z],
      ]),
    );
    const circle: [number, number][] = [];
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      circle.push([Math.cos(a) * 9.15, Math.sin(a) * 9.15]);
    }
    g.push(line(circle));
    for (const s of [1, -1]) {
      g.push(
        line([
          [s * FIELD_X, -20],
          [s * (FIELD_X - 16.5), -20],
          [s * (FIELD_X - 16.5), 20],
          [s * FIELD_X, 20],
        ]),
      );
      g.push(
        line([
          [s * FIELD_X, -9],
          [s * (FIELD_X - 5.5), -9],
          [s * (FIELD_X - 5.5), 9],
          [s * FIELD_X, 9],
        ]),
      );
    }
    return g;
  }, []);

  return (
    <group>
      {geoms.map((g, i) => (
        <primitive
          key={i}
          object={
            new THREE.Line(
              g,
              new THREE.LineBasicMaterial({ color: "#f2fbf4", transparent: true, opacity: 0.9 }),
            )
          }
        />
      ))}
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.35, 12]} />
        <meshBasicMaterial color="#f2fbf4" />
      </mesh>
    </group>
  );
}

function netTexture() {
  if (typeof document === "undefined") return null;
  const s = 128;
  const c = document.createElement("canvas");
  c.width = s;
  c.height = s;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, s, s);
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 2;
  for (let i = 0; i <= 8; i++) {
    const p = (i / 8) * s;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, s);
    ctx.moveTo(0, p);
    ctx.lineTo(s, p);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 3);
  return tex;
}

function Goal({ side, quality }: { side: number; quality: Quality }) {
  const x = side * FIELD_X;
  const net = useMemo(netTexture, []);
  const netMat = net ? (
    <meshStandardMaterial map={net} transparent opacity={0.55} side={THREE.DoubleSide} />
  ) : (
    <meshStandardMaterial color="#ffffff" transparent opacity={0.2} side={THREE.DoubleSide} />
  );
  return (
    <group position={[x, 0, 0]}>
      {[-3.66, 3.66].map((z) => (
        <mesh key={z} position={[0, 1.22, z]} castShadow={quality === "alta"}>
          <cylinderGeometry args={[0.1, 0.1, 2.44, 12]} />
          <meshStandardMaterial color="#fbfbfb" roughness={0.3} />
        </mesh>
      ))}
      <mesh position={[0, 2.44, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow={quality === "alta"}>
        <cylinderGeometry args={[0.1, 0.1, 7.32, 12]} />
        <meshStandardMaterial color="#fbfbfb" roughness={0.3} />
      </mesh>
      {/* rede: fundo, laterais e teto */}
      <mesh position={[side * 1.9, 1.22, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[7.32, 2.44]} />
        {netMat}
      </mesh>
      {[-3.66, 3.66].map((z) => (
        <mesh key={`s${z}`} position={[side * 0.95, 1.22, z]}>
          <planeGeometry args={[1.9, 2.44]} />
          {netMat}
        </mesh>
      ))}
      <mesh position={[side * 0.95, 2.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.9, 7.32]} />
        {netMat}
      </mesh>
    </group>
  );
}

function CornerFlags() {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    g.children.forEach((c, i) => {
      c.rotation.z = Math.sin(clock.elapsedTime * 2.4 + i) * 0.14;
    });
  });
  return (
    <group ref={ref}>
      {[
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ].map(([sx, sz], i) => (
        <group key={i} position={[sx! * FIELD_X, 0, sz! * FIELD_Z]}>
          <mesh position={[0, 0.75, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 1.5, 6]} />
            <meshStandardMaterial color="#f5f5f5" />
          </mesh>
          <mesh position={[0.28, 1.32, 0]}>
            <planeGeometry args={[0.55, 0.35]} />
            <meshStandardMaterial color="#f5c400" side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Dugouts() {
  return (
    <group>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 14, 0, -(FIELD_Z + 7.5)]}>
          <mesh position={[0, 1.1, 0]}>
            <boxGeometry args={[11, 2.2, 3]} />
            <meshStandardMaterial color="#13181d" roughness={0.9} />
          </mesh>
          <mesh position={[0, 1.6, 1.45]}>
            <planeGeometry args={[11, 1.4]} />
            <meshStandardMaterial color="#0a0d10" transparent opacity={0.5} />
          </mesh>
        </group>
      ))}
      {/* túnel */}
      <mesh position={[0, 1.6, -(FIELD_Z + 9)]}>
        <boxGeometry args={[6, 3.2, 6]} />
        <meshStandardMaterial color="#0e1216" roughness={1} />
      </mesh>
    </group>
  );
}

/* -------------------------------------------------------------- estrutura */

function adBoardTexture(text: string, bg: string, fg: string) {
  if (typeof document === "undefined") return null;
  const w = 256;
  const h = 48;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = fg;
  ctx.font = "bold 30px 'Barlow Condensed', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, w / 2, h / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const ADS = [
  ["FUT+ TV", "#0b2b45", "#7dfcb0"],
  ["AERO BRASIL", "#8a1420", "#ffffff"],
  ["NOVA BET", "#123f2a", "#f5c400"],
  ["PIXEL ENERGY", "#3a2f6b", "#ffffff"],
  ["GOLAÇO FM", "#6b4a12", "#ffe9b0"],
  ["MANAGER 3D", "#101418", "#7dfcb0"],
] as const;

function AdBoards() {
  const boards: React.ReactElement[] = [];
  const count = 18;
  const w = ((FIELD_X + 8) * 2) / count;
  for (let i = 0; i < count; i++) {
    const x = -(FIELD_X + 8) + w / 2 + i * w;
    for (const z of [-1, 1]) {
      boards.push(
        <AdBoard key={`${i}-${z}`} x={x} z={z * (FIELD_Z + 5)} w={w} seed={i + (z > 0 ? 3 : 0)} />,
      );
    }
  }
  return <group>{boards}</group>;
}

function AdBoard({ x, z, w, seed }: { x: number; z: number; w: number; seed: number }) {
  const texes = useMemo(
    () => ADS.map(([text, bg, fg]) => adBoardTexture(text, bg, fg)).filter(Boolean) as THREE.CanvasTexture[],
    [],
  );
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const idx = useRef(-1);
  useFrame(({ clock }) => {
    if (!texes.length) return;
    // troca de anúncio a cada 5s, com defasagem por placa
    const next = (Math.floor(clock.elapsedTime / 5) + seed) % texes.length;
    if (next === idx.current) return;
    idx.current = next;
    const tex = texes[next]!;
    const m = matRef.current;
    if (m) {
      m.map = tex;
      m.emissiveMap = tex;
      m.needsUpdate = true;
    }
  });
  return (
    <mesh position={[x, 0.6, z]} rotation={[0, z > 0 ? Math.PI : 0, 0]}>
      <boxGeometry args={[w * 0.94, 1.2, 0.25]} />
      <meshStandardMaterial
        ref={matRef}
        color="#ffffff"
        emissive="#ffffff"
        emissiveIntensity={0.55}
        roughness={0.4}
        toneMapped={false}
      />
    </mesh>
  );
}


function scoreboardTexture(text: string) {
  if (typeof document === "undefined") return null;
  const w = 512;
  const h = 192;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#05070a";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#7dfcb0";
  ctx.font = "bold 96px 'Barlow Condensed', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, w / 2, h / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function Scoreboard({ sim }: { sim: MatchSim }) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const label = useRef("");
  useFrame(() => {
    const text = `${sim.home.short} ${sim.stats.home.goals}-${sim.stats.away.goals} ${sim.away.short}  ${sim.minute()}'`;
    if (text === label.current) return;
    label.current = text;
    const tex = scoreboardTexture(text);
    if (tex && matRef.current) {
      matRef.current.map?.dispose();
      matRef.current.map = tex;
      matRef.current.emissiveMap = tex;
      matRef.current.needsUpdate = true;
    }
  });
  return (
    <group position={[0, 22, -(FIELD_Z + 26)]}>
      <mesh>
        <boxGeometry args={[30, 11, 1]} />
        <meshStandardMaterial color="#0b0e12" />
      </mesh>
      <mesh position={[0, 0, 0.6]}>
        <planeGeometry args={[28, 9.5]} />
        <meshStandardMaterial
          ref={matRef}
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={0.9}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function Floodlights({ time, quality }: { time: TimeOfDay; quality: Quality }) {
  const on = time !== "dia";
  const spots: [number, number][] = [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ];
  return (
    <group>
      {spots.map(([sx, sz], i) => (
        <group key={i} position={[sx * (FIELD_X + 20), 0, sz * (FIELD_Z + 22)]}>
          <mesh position={[0, 14, 0]}>
            <cylinderGeometry args={[0.5, 0.9, 28, 8]} />
            <meshStandardMaterial color="#252c33" roughness={0.85} />
          </mesh>
          <mesh position={[0, 28.5, 0]}>
            <boxGeometry args={[8, 3.4, 1]} />
            <meshStandardMaterial
              color="#f5f8ff"
              emissive={on ? "#dceaff" : "#333"}
              emissiveIntensity={on ? 2.2 : 0}
              toneMapped={false}
            />
          </mesh>
          {on && (
            <>
              <sprite position={[0, 28.5, 0]} scale={[26, 26, 1]}>
                <spriteMaterial
                  color="#cfe3ff"
                  opacity={0.16}
                  transparent
                  depthWrite={false}
                  blending={THREE.AdditiveBlending}
                />
              </sprite>
              {quality !== "baixa" && (
                <pointLight position={[0, 28, 0]} intensity={1400} distance={230} color="#e8f2ff" />
              )}
            </>
          )}
        </group>
      ))}
    </group>
  );
}

function Tiers({ rings }: { rings: number }) {
  const steps: React.ReactElement[] = [];
  const lenX = FIELD_X * 2 + 30;
  const lenZ = FIELD_Z * 2 + 34;
  for (let r = 0; r < rings; r++) {
    const y = 2.0 + r * 1.45;
    const shade = r % 2 === 0 ? "#2f3943" : "#39434e";
    for (const z of [-1, 1]) {
      steps.push(
        <mesh key={`sz${r}${z}`} position={[0, y - 0.72, z * (FIELD_Z + 7 + r * 1.5)]} receiveShadow>
          <boxGeometry args={[lenX, 1.45, 1.5]} />
          <meshStandardMaterial color={shade} roughness={1} />
        </mesh>,
      );
    }
    for (const x of [-1, 1]) {
      steps.push(
        <mesh key={`sx${r}${x}`} position={[x * (FIELD_X + 10 + r * 1.5), y - 0.72, 0]} receiveShadow>
          <boxGeometry args={[1.5, 1.45, lenZ]} />
          <meshStandardMaterial color={shade} roughness={1} />
        </mesh>,
      );
    }
  }
  return <group>{steps}</group>;
}

function Roof({ rings }: { rings: number }) {
  const outer = 9 + rings * 1.5;
  const depth = 10;
  const height = 2.0 + rings * 1.45 + 7;
  const trusses: React.ReactElement[] = [];
  for (let i = -6; i <= 6; i++) {
    for (const z of [-1, 1]) {
      trusses.push(
        <mesh key={`tz${i}${z}`} position={[i * 13, height - 2.2, z * (FIELD_Z + outer)]}>
          <boxGeometry args={[0.5, 4.4, 0.5]} />
          <meshStandardMaterial color="#5a6672" roughness={0.7} metalness={0.35} />
        </mesh>,
      );
    }
  }
  return (
    <group>
      {trusses}
      {[-1, 1].map((z) => (
        <mesh key={`rz${z}`} position={[0, height, z * (FIELD_Z + outer + depth / 2 - 2)]}>
          <boxGeometry args={[FIELD_X * 2 + 36, 0.6, depth]} />
          <meshStandardMaterial color="#4b5661" roughness={0.75} metalness={0.25} />
        </mesh>
      ))}
      {[-1, 1].map((x) => (
        <mesh key={`rx${x}`} position={[x * (FIELD_X + outer + depth / 2 - 2), height, 0]}>
          <boxGeometry args={[depth, 0.6, FIELD_Z * 2 + 40]} />
          <meshStandardMaterial color="#4b5661" roughness={0.75} metalness={0.25} />
        </mesh>
      ))}
    </group>
  );

}

function Banners({ color }: { color: string }) {
  return (
    <group>
      {[-1, 0, 1].map((i) => (
        <mesh key={i} position={[i * 22, 2.2, -(FIELD_Z + 6.4)]}>
          <planeGeometry args={[16, 1.6]} />
          <meshStandardMaterial color={color} roughness={0.9} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

function Stands({
  homeColor,
  awayColor,
  quality,
  goalPulse,
  night,
}: {
  homeColor: string;
  awayColor: string;
  quality: Quality;
  goalPulse: React.MutableRefObject<number>;
  night: boolean;
}) {
  const density = quality === "alta" ? 320 : quality === "media" ? 190 : 90;
  const rings = quality === "alta" ? 10 : quality === "media" ? 7 : 4;

  const crowd = useMemo(() => {
    const positions: THREE.Vector3[] = [];
    const colors: THREE.Color[] = [];
    const home = new THREE.Color(homeColor);
    const away = new THREE.Color(awayColor);
    const neutral = ["#d8d8d8", "#8fa3b8", "#42506b", "#e0c07a", "#b8c4cf", "#6c7a8c"];
    for (let ring = 0; ring < rings; ring++) {
      for (let i = 0; i < density; i++) {
        const t = i / density;
        const px = -FIELD_X - 10 + t * (FIELD_X * 2 + 20);
        for (const zSide of [-1, 1]) {
          positions.push(
            new THREE.Vector3(
              px + ((i * 7 + ring * 3) % 5) * 0.06,
              2.6 + ring * 1.45,
              zSide * (FIELD_Z + 7 + ring * 1.5),
            ),
          );
          const zone = t < 0.3 ? home : t > 0.7 ? away : null;
          colors.push(
            zone && (i + ring) % 3 !== 0
              ? zone
              : new THREE.Color(neutral[(i + ring) % neutral.length]!),
          );
        }
      }
    }
    for (let ring = 0; ring < rings; ring++) {
      const n = Math.round(density * 0.6);
      for (let i = 0; i < n; i++) {
        const t = i / n;
        const pz = -FIELD_Z - 8 + t * (FIELD_Z * 2 + 16);
        for (const xSide of [-1, 1]) {
          positions.push(
            new THREE.Vector3(xSide * (FIELD_X + 10 + ring * 1.5), 2.6 + ring * 1.45, pz),
          );
          const mosaic = (ring + i) % 5 < 3 ? home : new THREE.Color("#f2f2f2");
          colors.push(xSide === 1 ? mosaic : new THREE.Color(neutral[(i + ring) % neutral.length]!));
        }
      }
    }
    return { positions, colors };
  }, [homeColor, awayColor, density, rings]);

  const ref = useRef<THREE.InstancedMesh>(null);
  const flashRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const flashCount = night ? Math.min(140, Math.round(crowd.positions.length * 0.05)) : 0;

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    crowd.colors.forEach((c, i) => mesh.setColorAt(i, c));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    const mat = mesh.material as THREE.Material | THREE.Material[];
    if (Array.isArray(mat)) mat.forEach((m) => (m.needsUpdate = true));
    else mat.needsUpdate = true;
  }, [crowd]);

  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = clock.elapsedTime;
    const pulse = goalPulse.current;
    for (let i = 0; i < crowd.positions.length; i++) {
      const p = crowd.positions[i]!;
      const wave = Math.sin(t * 1.1 - p.x * 0.06) > 0.86 ? 0.5 : 0;
      const jump = pulse > 0 ? Math.abs(Math.sin(t * 9 + i)) * 0.75 * pulse : 0;
      dummy.position.set(p.x, p.y + Math.sin(t * 3 + i) * 0.06 + wave + jump, p.z);
      dummy.rotation.y = ((i % 7) - 3) * 0.06;
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;

    // flashes de câmera na torcida (mais intensos após o gol)
    const fm = flashRef.current;
    if (fm && flashCount) {
      for (let i = 0; i < flashCount; i++) {
        const p = crowd.positions[(i * 37) % crowd.positions.length]!;
        const on = Math.sin(t * (6 + (i % 5)) + i * 2.3) > (pulse > 0.05 ? 0.55 : 0.95);
        dummy.position.set(p.x, p.y + 0.45, p.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(on ? 1 : 0.0001);
        dummy.updateMatrix();
        fm.setMatrixAt(i, dummy.matrix);
      }
      fm.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      {/* muro externo (atrás das arquibancadas) */}
      {[-1, 1].map((z) => (
        <mesh key={z} position={[0, 6, z * (FIELD_Z + 9 + rings * 1.5)]}>
          <boxGeometry args={[FIELD_X * 2 + 34, 12, 2]} />
          <meshStandardMaterial color="#28313a" roughness={1} />
        </mesh>
      ))}
      {[-1, 1].map((x) => (
        <mesh key={x} position={[x * (FIELD_X + 12 + rings * 1.5), 6, 0]}>
          <boxGeometry args={[2, 12, FIELD_Z * 2 + 36]} />
          <meshStandardMaterial color="#28313a" roughness={1} />
        </mesh>
      ))}

      <Tiers rings={rings} />
      <Roof rings={rings} />
      <Banners color={homeColor} />
      <instancedMesh ref={ref} args={[undefined, undefined, crowd.positions.length]}>
        <boxGeometry args={[0.42, 0.66, 0.42]} />
        <meshStandardMaterial roughness={0.85} />
      </instancedMesh>
      {flashCount > 0 && (
        <instancedMesh ref={flashRef} args={[undefined, undefined, flashCount]}>
          <sphereGeometry args={[0.13, 6, 6]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} transparent opacity={0.9} />
        </instancedMesh>
      )}
    </group>
  );
}


/* --------------------------------------------------------------- jogadores */

function PlayerMesh({
  player,
  kit,
  goalPulse,
  quality,
}: {
  player: SimPlayer;
  kit: Kit;
  goalPulse: React.MutableRefObject<number>;
  quality: Quality;
}) {
  const group = useRef<THREE.Group>(null);
  const tex = useMemo(() => kitTexture(kit, player.number), [kit, player.number]);
  const skin = useMemo(() => skinFor(player.id), [player.id]);
  const hair = useMemo(() => hairFor(player.id), [player.id]);
  const style = useMemo(() => hash(player.id) % 4, [player.id]); // 0 curto 1 moicano 2 coque 3 careca
  const isGK = player.pos === "GK";
  const shadows = quality === "alta";
  const lean = useRef(0);

  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    g.position.x += (player.x - g.position.x) * 0.34;
    g.position.z += (player.z - g.position.z) * 0.34;
    const speed = Math.hypot(player.vx, player.vz);
    if (speed > 0.15) {
      const want = Math.atan2(player.vx, player.vz);
      // giro suave em direção ao movimento
      let d = want - g.rotation.y;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      g.rotation.y += d * 0.22;
    }

    const celebrating = goalPulse.current > 0.05;
    const t = clock.elapsedTime;
    const stride = Math.min(1, speed / 5.5);
    const swing = celebrating
      ? Math.sin(t * 8) * 0.55
      : Math.sin(t * (7 + stride * 8) + player.number) * 0.75 * stride;

    // inclinação do tronco proporcional à velocidade
    const targetLean = celebrating ? -0.18 : stride * 0.24;
    lean.current += (targetLean - lean.current) * 0.12;
    g.rotation.x = lean.current;
    g.position.y = celebrating ? Math.abs(Math.sin(t * 7 + player.number)) * 0.38 : 0;

    for (const c of g.children) {
      if (c.userData['leg'] !== undefined) c.rotation.x = c.userData['leg'] ? swing : -swing;
      if (c.userData['arm'] !== undefined) {
        c.rotation.x = celebrating ? -2.3 : (c.userData['arm'] ? -swing : swing) * 0.85;
        c.rotation.z = celebrating ? (c.userData['arm'] ? 0.5 : -0.5) : 0;
      }
      if (c.userData['bob'] !== undefined) {
        c.position.y = (c.userData['bob'] as number) + Math.abs(Math.sin(t * (7 + stride * 8))) * 0.03 * stride;
      }
    }
  });

  return (
    <group ref={group} position={[player.x, 0, player.z]}>
      {/* sombra de contato */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <circleGeometry args={[0.36, 14]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.3} depthWrite={false} />
      </mesh>
      {/* tronco */}
      <mesh position={[0, 1.16, 0]} castShadow={shadows} userData={{ bob: 1.16 }}>
        <capsuleGeometry args={[0.27, 0.5, 4, 12]} />
        <meshStandardMaterial {...(tex ? { map: tex } : { color: kit.base })} roughness={0.72} />
      </mesh>
      {/* ombros */}
      <mesh position={[0, 1.44, 0]} rotation={[0, 0, Math.PI / 2]} castShadow={shadows}>
        <capsuleGeometry args={[0.115, 0.4, 4, 8]} />
        <meshStandardMaterial color={kit.base} roughness={0.72} />
      </mesh>
      {/* pescoço */}
      <mesh position={[0, 1.56, 0]}>
        <cylinderGeometry args={[0.075, 0.085, 0.12, 8]} />
        <meshStandardMaterial color={skin} roughness={0.85} />
      </mesh>
      {/* cabeça */}
      <mesh position={[0, 1.71, 0]} castShadow={shadows}>
        <sphereGeometry args={[0.185, 16, 16]} />
        <meshStandardMaterial color={skin} roughness={0.85} />
      </mesh>
      {/* cabelo por estilo */}
      {style !== 3 && (
        <mesh position={[0, 1.79, -0.015]}>
          <sphereGeometry args={[0.178, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={hair} roughness={1} />
        </mesh>
      )}
      {style === 1 && (
        <mesh position={[0, 1.88, 0]}>
          <boxGeometry args={[0.07, 0.12, 0.3]} />
          <meshStandardMaterial color={hair} roughness={1} />
        </mesh>
      )}
      {style === 2 && (
        <mesh position={[0, 1.85, -0.16]}>
          <sphereGeometry args={[0.085, 10, 10]} />
          <meshStandardMaterial color={hair} roughness={1} />
        </mesh>
      )}
      {/* braços */}
      {[-0.32, 0.32].map((x, i) => (
        <group key={`a${x}`} position={[x, 1.22, 0]} userData={{ arm: i === 0 }}>
          <mesh position={[0, 0.12, 0]} castShadow={shadows}>
            <capsuleGeometry args={[0.075, 0.14, 4, 8]} />
            <meshStandardMaterial color={kit.base} roughness={0.72} />
          </mesh>
          <mesh position={[0, -0.16, 0]} castShadow={shadows}>
            <capsuleGeometry args={[0.062, 0.2, 4, 8]} />
            <meshStandardMaterial color={skin} roughness={0.85} />
          </mesh>
          {isGK && (
            <mesh position={[0, -0.32, 0]}>
              <boxGeometry args={[0.15, 0.18, 0.11]} />
              <meshStandardMaterial color={kit.detail} roughness={0.6} />
            </mesh>
          )}
        </group>
      ))}
      {/* shorts */}
      <mesh position={[0, 0.82, 0]} castShadow={shadows} userData={{ bob: 0.82 }}>
        <boxGeometry args={[0.5, 0.3, 0.34]} />
        <meshStandardMaterial color={kit.shorts} roughness={0.8} />
      </mesh>
      {/* pernas */}
      {[-0.14, 0.14].map((x, i) => (
        <group key={`l${x}`} position={[x, 0.4, 0]} userData={{ leg: i === 0 }}>
          <mesh castShadow={shadows}>
            <capsuleGeometry args={[0.095, 0.48, 4, 8]} />
            <meshStandardMaterial color={kit.socks} roughness={0.8} />
          </mesh>
          <mesh position={[0, -0.32, 0.05]}>
            <boxGeometry args={[0.16, 0.1, 0.3]} />
            <meshStandardMaterial color="#101010" roughness={0.5} />
          </mesh>
        </group>
      ))}
    </group>
  );
}


function Ball({ sim, quality }: { sim: MatchSim; quality: Quality }) {
  const ref = useRef<THREE.Mesh>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const trail = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    const m = ref.current;
    if (!m) return;
    m.position.x += (sim.ball.x - m.position.x) * 0.5;
    m.position.z += (sim.ball.z - m.position.z) * 0.5;
    m.position.y = 0.13 + sim.ball.height;
    const sp = Math.hypot(sim.ball.vx, sim.ball.vz);
    m.rotation.x += dt * (2 + sp * 0.9);
    m.rotation.z += dt * (1.5 + sp * 0.6);
    const s = shadow.current;
    if (s) {
      s.position.set(m.position.x, 0.015, m.position.z);
      const k = Math.max(0.35, 1 - sim.ball.height * 0.25);
      s.scale.setScalar(k);
      (s.material as THREE.MeshBasicMaterial).opacity = 0.36 * k;
    }
    // rastro de velocidade em chutes fortes
    const t = trail.current;
    if (t) {
      const active = sp > 16;
      t.visible = active;
      if (active) {
        const k = Math.min(1, (sp - 16) / 18);
        t.position.copy(m.position);
        t.rotation.y = Math.atan2(sim.ball.vx, sim.ball.vz);
        t.scale.set(1, 1, 1 + k * 9);
        (t.material as THREE.MeshBasicMaterial).opacity = 0.22 * k;
      }
    }
  });
  return (
    <group>
      <mesh ref={ref} castShadow={quality === "alta"} position={[0, 0.13, 0]}>
        <sphereGeometry args={[0.13, 20, 20]} />
        <meshStandardMaterial color="#ffffff" roughness={0.3} metalness={0.05} />
      </mesh>
      <mesh ref={trail} position={[0, 0.13, 0]} visible={false}>
        <boxGeometry args={[0.09, 0.09, 0.5]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.2}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.18, 16]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.36} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ câmera */

function Rig({
  sim,
  mode,
  goalPulse,
}: {
  sim: MatchSim;
  mode: CameraMode;
  goalPulse: React.MutableRefObject<number>;
}) {
  const target = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  const smoothLook = useMemo(() => new THREE.Vector3(0, 0.8, 0), []);
  useFrame(({ camera, clock }) => {
    const bx = sim.ball.x;
    const bz = sim.ball.z;
    const pulse = goalPulse.current;
    // replay automático: no gol a câmera vai para trás da bola em órbita lenta
    const effective: CameraMode = pulse > 0.55 ? "behind" : mode;
    switch (effective) {
      case "broadcast":
        target.set(bx * 0.55, 46, FIELD_Z + 44);
        break;
      case "tactical":
        target.set(bx * 0.2, 72, 6);
        break;
      case "goal":
        target.set(FIELD_X + 34, 22, bz * 0.3);
        break;
      case "fan":
        target.set(bx * 0.3, 17, FIELD_Z + 22);
        break;
      case "rail":
        target.set(bx, 9, FIELD_Z + 13);
        break;
      case "behind": {
        const a = clock.elapsedTime * 0.15;
        target.set(bx + Math.cos(a) * 16, 6.5, bz + Math.sin(a) * 16);
        break;
      }
    }
    // tremor sutil em lances de perigo / comemoração
    if (pulse > 0.05) {
      const s = pulse * 0.5;
      target.x += Math.sin(clock.elapsedTime * 21) * s;
      target.y += Math.cos(clock.elapsedTime * 17) * s * 0.6;
    }
    camera.position.lerp(target, effective === "behind" ? 0.12 : effective === "rail" ? 0.16 : 0.05);
    look.set(bx * 0.6, 0.8, bz * 0.6);
    smoothLook.lerp(look, 0.1);
    camera.lookAt(smoothLook);
  });
  return null;
}


/* ------------------------------------------------------------------- cena */

function Scene({
  sim,
  mode,
  quality,
  time,
}: {
  sim: MatchSim;
  mode: CameraMode;
  quality: Quality;
  time: TimeOfDay;
}) {
  const goalPulse = useRef(0);
  const lastGoals = useRef(0);

  useFrame((_, dt) => {
    const total = sim.stats.home.goals + sim.stats.away.goals;
    if (total !== lastGoals.current) {
      lastGoals.current = total;
      goalPulse.current = 1;
    }
    if (goalPulse.current > 0) goalPulse.current = Math.max(0, goalPulse.current - dt * 0.22);
  });

  const awayClash = colorClash(sim.home.primary, sim.away.primary);
  const homeKit = useMemo(
    () => kitFor(sim.home.clubId, sim.home.primary, sim.home.secondary),
    [sim.home.clubId, sim.home.primary, sim.home.secondary],
  );
  const awayKit = useMemo(
    () => kitFor(sim.away.clubId, sim.away.primary, sim.away.secondary, awayClash),
    [sim.away.clubId, sim.away.primary, sim.away.secondary, awayClash],
  );

  const sun = time === "dia" ? 2.8 : time === "entardecer" ? 2.2 : 1.8;
  const sunColor = time === "entardecer" ? "#ffb27a" : time === "dia" ? "#fff6e0" : "#bcd8ff";

  return (
    <>
      <color attach="background" args={[SKY[time]]} />
      <fog attach="fog" args={[SKY[time], 110, 300]} />
      <ambientLight intensity={0.9} />
      <hemisphereLight
        intensity={time === "dia" ? 1.0 : 0.7}
        groundColor="#0d2a18"
        color={time === "entardecer" ? "#ffd0a8" : "#cfe4ff"}
      />
      <directionalLight
        position={[50, 80, 40]}
        intensity={sun}
        color={sunColor}
        castShadow={quality === "alta"}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-90}
        shadow-camera-right={90}
        shadow-camera-top={70}
        shadow-camera-bottom={-70}
      />
      <directionalLight position={[-60, 60, -40]} intensity={0.6} color="#bcd8ff" />

      <Pitch quality={quality} />
      <AdBoards />
      <Floodlights time={time} quality={quality} />
      <Stands
        homeColor={sim.home.primary}
        awayColor={sim.away.primary}
        quality={quality}
        goalPulse={goalPulse}
        night={time !== "dia"}
      />
      <Scoreboard sim={sim} />
      <Ball sim={sim} quality={quality} />
      {sim.players.map((p) => (
        <PlayerMesh
          key={p.id}
          player={p}
          kit={
            p.pos === "GK"
              ? gkKitFor(p.side === "home" ? sim.home.clubId : sim.away.clubId)
              : p.side === "home"
                ? homeKit
                : awayKit
          }
          goalPulse={goalPulse}
          quality={quality}
        />
      ))}
      <Rig sim={sim} mode={mode} goalPulse={goalPulse} />
    </>
  );
}

export function Stadium3D({
  sim,
  mode,
  quality,
}: {
  sim: MatchSim;
  mode: CameraMode;
  quality: Quality;
  tick?: number;
}) {
  const time = useMemo<TimeOfDay>(() => {
    const t = hash(sim.home.clubId + sim.away.clubId) % 3;
    return t === 0 ? "dia" : t === 1 ? "entardecer" : "noite";
  }, [sim.home.clubId, sim.away.clubId]);

  return (
    <div className="relative h-full w-full">
      <Canvas
        shadows={quality === "alta"}
        dpr={quality === "alta" ? [1, 2] : quality === "media" ? 1 : 0.75}
        camera={{ position: [0, 46, FIELD_Z + 44], fov: 42 }}
        gl={{ antialias: quality !== "baixa" }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = quality === "baixa" ? 1.0 : 1.12;
        }}
      >
        <Scene sim={sim} mode={mode} quality={quality} time={time} />
      </Canvas>
      {/* acabamento de transmissão: vinheta + leve correção de cor */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 45%, transparent 55%, rgba(0,0,0,0.42) 100%)",
        }}
      />
    </div>
  );
}
