// ============================================================================
//  BenchLife.tsx
//  Banco de reservas vivo: casamata com cobertura, reservas sentados que
//  vibram no gol, treinador andando na área técnica (comemora, desespera,
//  aponta) e três atletas aquecendo atrás do gol.
//
//  Custo: estrutura 100% mesclada (2 malhas); bonecos só na qualidade alta e
//  média (7/4 por lado); aquecimento só na alta. Animações em 3 useFrames.
// ============================================================================

import { useFrame } from "@react-three/fiber";
import { memo, useMemo, useRef } from "react";
import type React from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { censusRef } from "@/game/scene-census";
import { FIELD_X, FIELD_Z, type SimView } from "@/game/sim";

export type Quality = "alta" | "media" | "baixa";

const BENCH_Z = FIELD_Z + 6.5;
const TECH_Z = FIELD_Z + 3.1;

/** Casamata: cobertura, fundo e bancos corridos, tudo mesclado por cor. */
function dugoutGeometries(color: string, glass: string) {
  const paint = (g: THREE.BufferGeometry, c: string) => {
    const tmp = new THREE.Color(c);
    const n = g.getAttribute("position").count;
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) tmp.toArray(colors, i * 3);
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return g;
  };
  const geos: THREE.BufferGeometry[] = [];
  const put = (g: THREE.BufferGeometry, x: number, y: number, z: number) => {
    g.translate(x, y, z);
    geos.push(paint(g, color));
  };
  // cobertura + laterais + fundo de vidro + banco corrido
  put(new THREE.BoxGeometry(9.5, 0.18, 3.4), 0, 2.5, 0);
  put(new THREE.BoxGeometry(0.18, 2.5, 3.4), -4.65, 1.25, 0);
  put(new THREE.BoxGeometry(0.18, 2.5, 3.4), 4.65, 1.25, 0);
  const back = new THREE.BoxGeometry(9.5, 2.5, 0.1);
  back.translate(0, 1.25, 1.65);
  geos.push(paint(back, glass));
  put(new THREE.BoxGeometry(8.6, 0.12, 0.7), 0, 0.55, 0.6);
  put(new THREE.BoxGeometry(8.6, 0.5, 0.12), 0, 0.85, 0.95);
  for (const x of [-3.6, 0, 3.6]) put(new THREE.BoxGeometry(0.14, 0.55, 0.6), x, 0.27, 0.6);
  return mergeGeometries(geos, false)!;
}

/** Reserva sentado: tronco, cabeça e pernas dobradas; pula no gol. */
const Seated = memo(function Seated({
  x,
  z,
  face,
  shirt,
  skin,
  phase,
  bounce,
}: {
  x: number;
  z: number;
  face: number;
  shirt: string;
  skin: string;
  phase: number;
  bounce: React.MutableRefObject<number>;
}) {
  const g = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (torso.current) torso.current.rotation.x = Math.sin(t * 1.4 + phase) * 0.05 - 0.06;
    if (g.current) {
      const jumping = bounce.current > 0.5 ? Math.abs(Math.sin(t * 9 + phase)) * 0.35 : 0;
      g.current.position.y = jumping;
      g.current.rotation.z = Math.sin(t * 0.9 + phase) * 0.03;
    }
  });
  return (
    <group ref={g} position={[x, 0.62, z]} rotation={[0, face, 0]}>
      {/* tronco */}
      <mesh ref={torso} position={[0, 0.32, 0]}>
        <capsuleGeometry args={[0.17, 0.34, 3, 8]} />
        <meshStandardMaterial color={shirt} roughness={0.8} />
      </mesh>
      {/* cabeça */}
      <mesh position={[0, 0.78, 0.02]}>
        <sphereGeometry args={[0.12, 10, 10]} />
        <meshStandardMaterial color={skin} roughness={0.85} />
      </mesh>
      {/* coxas dobradas + canelas */}
      {[-0.09, 0.09].map((dx) => (
        <group key={dx}>
          <mesh position={[dx, 0.02, 0.2]} rotation={[Math.PI / 2 - 0.15, 0, 0]}>
            <capsuleGeometry args={[0.06, 0.3, 3, 6]} />
            <meshStandardMaterial color={skin} roughness={0.85} />
          </mesh>
          <mesh position={[dx, -0.28, 0.36]}>
            <capsuleGeometry args={[0.055, 0.24, 3, 6]} />
            <meshStandardMaterial color={shirt} roughness={0.85} />
          </mesh>
        </group>
      ))}
    </group>
  );
});

/** Treinador na área técnica: anda, comemora, desespera e aponta. */
function Coach({
  sim,
  side,
  shirt,
  goalPulse,
}: {
  sim: SimView;
  side: 1 | -1;
  shirt: string;
  goalPulse: React.MutableRefObject<number>;
}) {
  const g = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const head = useRef<THREE.Mesh>(null);
  const st = useRef({ hg: -1, ag: -1, react: 0, mood: 0 as -1 | 0 | 1, phase: 0 });
  const skin = "#c98d63";

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const t = clock.elapsedTime;
    const mine = side > 0 ? sim.stats.home.goals : sim.stats.away.goals;
    const theirs = side > 0 ? sim.stats.away.goals : sim.stats.home.goals;
    const s = st.current;
    const base = side > 0 ? s.hg : s.ag;
    const baseOther = side > 0 ? s.ag : s.hg;
    if (base < 0) {
      s.hg = sim.stats.home.goals;
      s.ag = sim.stats.away.goals;
    } else if (mine > base) {
      s.react = 3.2;
      s.mood = 1;
      s.hg = sim.stats.home.goals;
      s.ag = sim.stats.away.goals;
    } else if (theirs > baseOther) {
      s.react = 3.2;
      s.mood = -1;
      s.hg = sim.stats.home.goals;
      s.ag = sim.stats.away.goals;
    }
    s.react = Math.max(0, s.react - dt);
    if (!g.current) return;

    if (s.react > 0 && s.mood === 1) {
      // comemora: pula com os braços para o alto
      g.current.position.y = Math.abs(Math.sin(t * 10)) * 0.3;
      if (armL.current) armL.current.rotation.x = -2.7;
      if (armR.current) armR.current.rotation.x = -2.7;
      if (torso.current) torso.current.rotation.x = -0.12;
      if (head.current) head.current.position.y = 1.72;
    } else if (s.react > 0 && s.mood === -1) {
      // desespera: agacha com as mãos na cabeça
      g.current.position.y = -0.22;
      if (armL.current) armL.current.rotation.x = -2.9;
      if (armR.current) armR.current.rotation.x = -2.9;
      if (torso.current) torso.current.rotation.x = 0.34;
      if (head.current) head.current.position.y = 1.66;
    } else {
      // anda de um lado para o outro, apontando de vez em quando
      g.current.position.y = 0;
      s.phase += dt * 0.5;
      const px = Math.sin(s.phase) * 3.4;
      g.current.position.x = px;
      g.current.rotation.y = (side > 0 ? Math.PI : 0) + Math.cos(s.phase) * 0.5;
      const swing = Math.sin(t * 7) * 0.5;
      if (legL.current) legL.current.rotation.x = swing;
      if (legR.current) legR.current.rotation.x = -swing;
      const pointing = Math.sin(t * 0.45) > 0.72;
      if (armR.current)
        armR.current.rotation.x +=
          ((pointing ? -1.5 : swing * 0.4) - armR.current.rotation.x) * Math.min(1, dt * 8);
      if (armL.current) armL.current.rotation.x = -swing * 0.4;
      if (torso.current) torso.current.rotation.x = 0;
      if (head.current) head.current.position.y = 1.72;
    }
    void goalPulse;
  });

  return (
    <group ref={g} position={[0, 0, side * TECH_Z]} rotation={[0, side > 0 ? Math.PI : 0, 0]}>
      <group ref={torso}>
        <mesh position={[0, 1.25, 0]}>
          <capsuleGeometry args={[0.19, 0.5, 4, 8]} />
          <meshStandardMaterial color="#181c22" roughness={0.75} />
        </mesh>
        {/* cachecol do clube */}
        <mesh position={[0, 1.42, 0.14]}>
          <boxGeometry args={[0.16, 0.34, 0.05]} />
          <meshStandardMaterial color={shirt} roughness={0.8} />
        </mesh>
      </group>
      <mesh ref={head} position={[0, 1.72, 0]}>
        <sphereGeometry args={[0.13, 12, 12]} />
        <meshStandardMaterial color={skin} roughness={0.85} />
      </mesh>
      <group ref={armL} position={[-0.22, 1.44, 0]}>
        <mesh position={[0, -0.24, 0]}>
          <capsuleGeometry args={[0.05, 0.36, 3, 6]} />
          <meshStandardMaterial color="#181c22" roughness={0.75} />
        </mesh>
      </group>
      <group ref={armR} position={[0.22, 1.44, 0]}>
        <mesh position={[0, -0.24, 0]}>
          <capsuleGeometry args={[0.05, 0.36, 3, 6]} />
          <meshStandardMaterial color="#181c22" roughness={0.75} />
        </mesh>
      </group>
      <group ref={legL} position={[-0.1, 0.85, 0]}>
        <mesh position={[0, -0.4, 0]}>
          <capsuleGeometry args={[0.07, 0.6, 3, 6]} />
          <meshStandardMaterial color="#101318" roughness={0.8} />
        </mesh>
      </group>
      <group ref={legR} position={[0.1, 0.85, 0]}>
        <mesh position={[0, -0.4, 0]}>
          <capsuleGeometry args={[0.07, 0.6, 3, 6]} />
          <meshStandardMaterial color="#101318" roughness={0.8} />
        </mesh>
      </group>
    </group>
  );
}

/** Três reservas trotando em volta de cones atrás do gol. */
function Warmup({ color, side }: { color: string; side: 1 | -1 }) {
  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 0.55;
    for (let k = 0; k < 3; k++) {
      const g = refs.current[k];
      if (!g) continue;
      const a = t + (k * Math.PI * 2) / 3;
      g.position.x = side * (FIELD_X + 7.5) + Math.cos(a) * 5.5;
      g.position.z = Math.sin(a) * 4.2;
      g.rotation.y = Math.atan2(-Math.sin(a) * 5.5, Math.cos(a) * 4.2) + (side > 0 ? 0 : Math.PI);
      g.position.y = Math.abs(Math.sin(clock.elapsedTime * 8 + k)) * 0.08;
    }
  });
  return (
    <group>
      {[0, 1, 2].map((k) => (
        <group key={k} ref={(el) => void (refs.current[k] = el)}>
          <mesh position={[0, 1.15, 0]}>
            <capsuleGeometry args={[0.17, 0.42, 3, 8]} />
            <meshStandardMaterial color={color} roughness={0.8} />
          </mesh>
          <mesh position={[0, 1.68, 0]}>
            <sphereGeometry args={[0.12, 8, 8]} />
            <meshStandardMaterial color="#c98d63" roughness={0.85} />
          </mesh>
          <mesh position={[0, 0.45, 0]}>
            <capsuleGeometry args={[0.14, 0.4, 3, 6]} />
            <meshStandardMaterial color="#14181e" roughness={0.85} />
          </mesh>
        </group>
      ))}
      {/* cones */}
      {[0, 1, 2, 3].map((k) => (
        <mesh key={k} position={[side * (FIELD_X + 7.5) - 4 + k * 2.7, 0.15, 5.4]}>
          <coneGeometry args={[0.16, 0.3, 8]} />
          <meshStandardMaterial color="#ff7a1a" roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

const SKINS = ["#c98d63", "#8a5a3b", "#5a3a26", "#e0b08a"];

export const BenchLife = memo(function BenchLife({
  sim,
  quality,
  goalPulse,
}: {
  sim: SimView;
  quality: Quality;
  goalPulse: React.MutableRefObject<number>;
}) {
  const homeColor = sim.home.primary;
  const awayColor = sim.away.primary;
  const homeDugout = useMemo(() => dugoutGeometries("#2a313a", "#9fb6c9"), []);
  const awayDugout = useMemo(() => dugoutGeometries("#2a313a", "#9fb6c9"), []);
  const cloth = useMemo(
    () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }),
    [],
  );
  const count = quality === "alta" ? 7 : quality === "media" ? 4 : 0;
  const reserves = useMemo(() => {
    const list: { dx: number; skin: string; phase: number }[] = [];
    for (let k = 0; k < 7; k++) {
      list.push({
        dx: -3.6 + k * 1.2,
        skin: SKINS[(k * 2 + 1) % SKINS.length]!,
        phase: k * 1.7,
      });
    }
    return list;
  }, []);

  return (
    <group ref={censusRef("props")} name="bench-life">
      <group position={[0, 0, BENCH_Z]}>
        <mesh geometry={homeDugout} material={cloth} />
      </group>
      <group position={[0, 0, -BENCH_Z]} rotation={[0, Math.PI, 0]}>
        <mesh geometry={awayDugout} material={cloth} />
      </group>
      {reserves.slice(0, count).map((r, k) => (
        <group key={k}>
          <Seated
            x={r.dx}
            z={BENCH_Z - 0.4}
            face={Math.PI}
            shirt={homeColor}
            skin={r.skin}
            phase={r.phase}
            bounce={goalPulse}
          />
          <Seated
            x={-r.dx}
            z={-(BENCH_Z - 0.4)}
            face={0}
            shirt={awayColor}
            skin={SKINS[(k + 2) % SKINS.length]!}
            phase={r.phase + 1}
            bounce={goalPulse}
          />
        </group>
      ))}
      {quality !== "baixa" ? (
        <>
          <Coach sim={sim} side={1} shirt={homeColor} goalPulse={goalPulse} />
          <Coach sim={sim} side={-1} shirt={awayColor} goalPulse={goalPulse} />
        </>
      ) : null}
      {quality === "alta" ? (
        <>
          <Warmup color={homeColor} side={1} />
          <Warmup color={awayColor} side={-1} />
        </>
      ) : null}
    </group>
  );
});
