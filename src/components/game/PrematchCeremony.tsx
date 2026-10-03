// ============================================================================
//  PrematchCeremony.tsx
//  Cerimônia pré-jogo 3D: 5 beats com corte seco de broadcast (~24s).
//
//    0 — entorno do estádio à noite (ônibus + torcida chegando)
//    1 — saída do túnel (coluna única, mandante e visitante)
//    2 — perfilados para o hino (bandeiras + flashes)
//    3 — mosaico da torcida (bandeirão + cartolinas + sinalizadores)
//    4 — sorteio no centro (moeda, capitães, apito)
//
//  Autocontido: Canvas próprio, câmera dirigida por beat, legendas via i18n,
//  botão de pular e preferência "não mostrar mais" (manager3d.ceremony).
// ============================================================================

import { memo, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { useT } from "@/i18n/provider";
import { prefersReducedMotion } from "@/game/device";
import { storeCeremony } from "@/game/ceremony-prefs";
import { ClubFlag, TifoBanner, type ClubColors } from "@/components/game/stadium/ClubIdentity";
import { StadiumExterior } from "@/components/game/stadium/StadiumExterior";

const BEAT_LEN = [5, 5, 5, 4.5, 4.5];
const TOTAL = BEAT_LEN.reduce((a, b) => a + b, 0);

function beatAt(time: number): { index: number; progress: number } {
  let acc = 0;
  for (let k = 0; k < BEAT_LEN.length; k++) {
    const len = BEAT_LEN[k]!;
    if (time < acc + len) return { index: k, progress: (time - acc) / len };
    acc += len;
  }
  return { index: BEAT_LEN.length - 1, progress: 1 };
}

// câmera por beat: [de, para, alvo]
const CAMS: Array<[[number, number, number], [number, number, number], [number, number, number]]> =
  [
    [
      [-27, 7, 35],
      [-17, 9.5, 31],
      [0, 8, -18],
    ],
    [
      [4.2, 2.3, 11],
      [3, 2.5, 8.2],
      [0, 1.2, -8],
    ],
    [
      [0, 2.7, 13],
      [0, 2.2, 10],
      [0, 1.3, 0],
    ],
    [
      [0, 3.4, 15],
      [0, 6.4, 17],
      [0, 3.4, -6],
    ],
    [
      [5, 2.8, 7],
      [3.4, 2, 4.8],
      [0, 1, 0],
    ],
  ];

const smooth = (p: number) => p * p * (3 - 2 * p);

/** Diretor: relógio único, corte por beat e travelling dentro do beat. */
function Director({ onBeat, onDone }: { onBeat: (b: number) => void; onDone: () => void }) {
  const beatRef = useRef(-1);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const beatCb = useRef(onBeat);
  beatCb.current = onBeat;
  const fast = useMemo(() => prefersReducedMotion(), []);
  const look = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock, camera }) => {
    const time = clock.elapsedTime * (fast ? 2.6 : 1);
    if (time >= TOTAL) {
      doneRef.current();
      return;
    }
    const { index, progress } = beatAt(time);
    if (index !== beatRef.current) {
      beatRef.current = index;
      beatCb.current(index);
    }
    const [a, b, l] = CAMS[index]!;
    const p = smooth(Math.min(1, Math.max(0, progress)));
    camera.position.set(
      a[0] + (b[0] - a[0]) * p,
      a[1] + (b[1] - a[1]) * p,
      a[2] + (b[2] - a[2]) * p,
    );
    camera.lookAt(look.set(l[0], l[1], l[2]));
  });
  return null;
}

/** Boneco simples da cerimônia: camisa, cabeça e pernas que balançam. */
function MiniPlayer({
  shirt,
  shorts,
  skin = "#c98d63",
  walk = false,
  phase = 0,
}: {
  shirt: string;
  shorts: string;
  skin?: string;
  walk?: boolean;
  phase?: number;
}) {
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!walk) return;
    const s = Math.sin(clock.elapsedTime * 7 + phase) * 0.55;
    if (legL.current) legL.current.rotation.x = s;
    if (legR.current) legR.current.rotation.x = -s;
  });
  return (
    <group>
      <mesh position={[0, 1.08, 0]}>
        <capsuleGeometry args={[0.17, 0.42, 3, 8]} />
        <meshStandardMaterial color={shirt} roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.64, 0]}>
        <sphereGeometry args={[0.115, 10, 10]} />
        <meshStandardMaterial color={skin} roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.72, 0]}>
        <capsuleGeometry args={[0.15, 0.1, 3, 8]} />
        <meshStandardMaterial color={shorts} roughness={0.85} />
      </mesh>
      <group ref={legL} position={[-0.08, 0.62, 0]}>
        <mesh position={[0, -0.3, 0]}>
          <capsuleGeometry args={[0.06, 0.44, 3, 6]} />
          <meshStandardMaterial color={skin} roughness={0.85} />
        </mesh>
      </group>
      <group ref={legR} position={[0.08, 0.62, 0]}>
        <mesh position={[0, -0.3, 0]}>
          <capsuleGeometry args={[0.06, 0.44, 3, 6]} />
          <meshStandardMaterial color={skin} roughness={0.85} />
        </mesh>
      </group>
    </group>
  );
}

const SKINS = ["#c98d63", "#8a5a3b", "#5a3a26", "#e0b08a", "#a9714b"];

/** Beat 1: coluna saindo do túnel em direção ao gramado. */
const Walkout = memo(function Walkout({ home, away }: { home: ClubColors; away: ClubColors }) {
  const walkers = useMemo(
    () =>
      Array.from({ length: 16 }, (_, k) => ({
        home: k % 2 === 0,
        offset: k * 1.9,
        skin: SKINS[k % SKINS.length]!,
      })),
    [],
  );
  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    for (let k = 0; k < walkers.length; k++) {
      const g = refs.current[k];
      if (!g) continue;
      const w = walkers[k]!;
      const z = -24 + ((w.offset + t * 2.1) % 34);
      g.position.set(w.home ? -0.7 : 0.7, Math.abs(Math.sin(t * 7 + k)) * 0.04, z);
    }
  });
  return (
    <group>
      {/* gramado */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 4]}>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#1d7a3a" roughness={0.95} />
      </mesh>
      {/* boca do túnel */}
      <mesh position={[0, 2, -19]}>
        <boxGeometry args={[7, 4.4, 12]} />
        <meshStandardMaterial color="#141a24" roughness={0.9} />
      </mesh>
      <mesh position={[0, 2, -12.9]}>
        <planeGeometry args={[5.4, 3.6]} />
        <meshBasicMaterial color="#04070c" />
      </mesh>
      {/* luz fria da saída */}
      <mesh position={[0, 2, -12.8]}>
        <planeGeometry args={[5.4, 0.5]} />
        <meshBasicMaterial color="#bcd6ff" transparent opacity={0.5} />
      </mesh>
      {walkers.map((w, k) => (
        <group key={k} ref={(el) => void (refs.current[k] = el)}>
          <MiniPlayer
            shirt={w.home ? home.primary : away.primary}
            shorts={w.home ? home.secondary : away.secondary}
            skin={w.skin}
            walk
            phase={k * 1.3}
          />
        </group>
      ))}
    </group>
  );
});

/** Beat 2: fileiras perfiladas, bandeiras e flashes da imprensa. */
const Lineup = memo(function Lineup({ home, away }: { home: ClubColors; away: ClubColors }) {
  const flashes = useRef<(THREE.Mesh | null)[]>([]);
  const spots = useMemo(
    () =>
      [
        [-9, 6, -10],
        [7, 7.5, -12],
        [0, 5, -14],
        [12, 4, -6],
        [-13, 5.5, -4],
      ] as Array<[number, number, number]>,
    [],
  );
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    for (let k = 0; k < spots.length; k++) {
      const m = flashes.current[k];
      if (!m) continue;
      const on = Math.sin(t * 3.1 + k * 2.4) + Math.sin(t * 7.7 + k) > 1.55;
      m.visible = on;
    }
  });
  const row = (club: ClubColors, z: number, flip: boolean) =>
    Array.from({ length: 11 }, (_, k) => (
      <group key={k} position={[-11 + k * 2.2, 0, z]} rotation={[0, flip ? Math.PI : 0, 0]}>
        <MiniPlayer
          shirt={club.primary}
          shorts={club.secondary}
          skin={SKINS[(k * 3 + (flip ? 1 : 0)) % SKINS.length]!}
        />
      </group>
    ));
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[60, 40]} />
        <meshStandardMaterial color="#1d7a3a" roughness={0.95} />
      </mesh>
      {/* faixa central */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[0.3, 34]} />
        <meshBasicMaterial color="#e8f2e8" transparent opacity={0.85} />
      </mesh>
      {row(home, -1.6, false)}
      {row(away, 1.6, true)}
      {/* árbitro com a bola */}
      <group position={[0, 0, 4.6]}>
        <MiniPlayer shirt="#101318" shorts="#0b0e12" skin={SKINS[0]!} />
        <mesh position={[0.35, 0.16, 0.3]}>
          <sphereGeometry args={[0.16, 12, 12]} />
          <meshStandardMaterial color="#f2f4f6" roughness={0.5} />
        </mesh>
      </group>
      <ClubFlag club={home} position={[-13.5, 0, -2]} scale={1.3} />
      <ClubFlag club={away} position={[13.5, 0, -2]} scale={1.3} />
      {spots.map((p, k) => (
        <mesh key={k} ref={(el) => void (flashes.current[k] = el)} position={p} visible={false}>
          <planeGeometry args={[1.6, 1.1]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.9} />
        </mesh>
      ))}
    </group>
  );
});

/** Beat 3: bandeirão, cartolinas e sinalizadores da torcida mandante. */
const Tifo = memo(function Tifo({ home }: { home: ClubColors }) {
  const cards = useRef<THREE.InstancedMesh>(null);
  const sparks = useRef<THREE.Points>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const palette = useMemo(() => [home.primary, home.secondary, "#f2f4f6"], [home]);
  // mosaico forma a sigla: cartolinas claras desenham as letras no pano escuro
  useEffect(() => {
    const m = cards.current;
    if (!m) return;
    const color = new THREE.Color();
    let k = 0;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 16; c++) {
        const letter = (c + r * 3) % 5 < 2;
        m.setColorAt(k++, color.set(palette[letter ? 2 : r % 2]!));
      }
    }
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [palette]);
  const sparkPos = useMemo(() => {
    const arr = new Float32Array(2 * 40 * 3);
    for (let k = 0; k < 80; k++) {
      const side = k < 40 ? -9 : 9;
      arr[k * 3] = side + (Math.random() - 0.5) * 0.6;
      arr[k * 3 + 1] = Math.random() * 4;
      arr[k * 3 + 2] = -4 + (Math.random() - 0.5) * 0.6;
    }
    return arr;
  }, []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const m = cards.current;
    if (m) {
      let k = 0;
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 16; c++) {
          dummy.position.set(-11.5 + c * 1.55, 1.7 + r * 0.75, -7.5 - r * 0.5);
          dummy.rotation.x = -0.25 + Math.sin(t * 5 + c * 0.7 + r) * 0.28;
          dummy.updateMatrix();
          m.setMatrixAt(k++, dummy.matrix);
        }
      }
      m.instanceMatrix.needsUpdate = true;
    }
    const p = sparks.current;
    if (p) {
      const pos = p.geometry.getAttribute("position");
      for (let k = 0; k < 80; k++) {
        let y = pos.getY(k) + 0.035 + (k % 5) * 0.008;
        if (y > 4.2) y = 0.3;
        pos.setY(k, y);
        pos.setX(k, pos.getX(k) + Math.sin(t * 6 + k) * 0.004);
      }
      pos.needsUpdate = true;
    }
  });
  return (
    <group>
      {/* arquibancada escura atrás */}
      {[-2, 0, 2, 4].map((y, k) => (
        <mesh key={k} position={[0, 1.2 + y * 0.9, -9 - k * 1.1]}>
          <boxGeometry args={[30, 1.1, 1.2]} />
          <meshStandardMaterial color="#12161e" roughness={0.95} />
        </mesh>
      ))}
      <TifoBanner club={home} width={17} height={3.4} position={[0, 4.6, -7]} />
      <instancedMesh ref={cards} args={[undefined, undefined, 64]} frustumCulled={false}>
        <boxGeometry args={[1.1, 0.8, 0.06]} />
        <meshStandardMaterial roughness={0.85} />
      </instancedMesh>
      <points ref={sparks} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[sparkPos, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color={home.secondary}
          size={0.16}
          transparent
          opacity={0.95}
          depthWrite={false}
        />
      </points>
      {/* brilho dos sinalizadores no chão */}
      {[-9, 9].map((x) => (
        <mesh key={x} position={[x, 0.06, -4]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1.6, 20]} />
          <meshBasicMaterial color={home.primary} transparent opacity={0.35} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
});

/** Beat 4: moeda ao ar no círculo central. */
const CoinToss = memo(function CoinToss({ home, away }: { home: ClubColors; away: ClubColors }) {
  const coin = useRef<THREE.Mesh>(null);
  const headH = useRef<THREE.Group>(null);
  const headA = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    // a moeda gira durante o beat e cai no último segundo
    const local = (t - (TOTAL - BEAT_LEN[4]!)) / BEAT_LEN[4]!;
    if (coin.current) {
      coin.current.rotation.y = t * 9;
      coin.current.rotation.x = 0.5;
      const land = Math.max(0, Math.min(1, (local - 0.72) / 0.28));
      const bounce = land < 1 ? 0 : Math.abs(Math.sin((local - 1) * 40)) * 0.06 * (1 - land);
      coin.current.position.y = 1.75 - smooth(land) * 1.6 + bounce;
    }
    // capitães assentem quando a moeda cai
    const nod = local > 0.75 ? Math.sin(t * 9) * 0.09 : 0;
    if (headH.current) headH.current.rotation.x = nod;
    if (headA.current) headA.current.rotation.x = -nod;
  });
  const captain = (
    club: ClubColors,
    x: number,
    flip: boolean,
    head: RefObject<THREE.Group | null>,
  ) => (
    <group position={[x, 0, 0]} rotation={[0, flip ? -Math.PI / 2 : Math.PI / 2, 0]}>
      <mesh position={[0, 1.08, 0]}>
        <capsuleGeometry args={[0.17, 0.42, 3, 8]} />
        <meshStandardMaterial color={club.primary} roughness={0.8} />
      </mesh>
      <group ref={head} position={[0, 1.64, 0]}>
        <mesh>
          <sphereGeometry args={[0.115, 10, 10]} />
          <meshStandardMaterial color={SKINS[0]!} roughness={0.85} />
        </mesh>
      </group>
      {/* braçadeira */}
      <mesh position={[flip ? -0.19 : 0.19, 1.25, 0]}>
        <torusGeometry args={[0.075, 0.022, 6, 12]} />
        <meshStandardMaterial color="#e8b93c" roughness={0.5} />
      </mesh>
    </group>
  );
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[14, 40]} />
        <meshStandardMaterial color="#1e7c3c" roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[1.9, 2.05, 48]} />
        <meshBasicMaterial color="#e8f2e8" transparent opacity={0.9} />
      </mesh>
      <mesh position={[0, 0.16, 0.6]}>
        <sphereGeometry args={[0.16, 12, 12]} />
        <meshStandardMaterial color="#f2f4f6" roughness={0.5} />
      </mesh>
      {captain(home, -1.1, false, headH)}
      {captain(away, 1.1, true, headA)}
      <group position={[0, 0, -1.5]}>
        <MiniPlayer shirt="#101318" shorts="#0b0e12" skin={SKINS[3]!} />
      </group>
      <mesh ref={coin} position={[0, 1.75, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.03, 20]} />
        <meshStandardMaterial color="#e8b93c" metalness={0.85} roughness={0.25} />
      </mesh>
    </group>
  );
});

export function PrematchCeremony({
  home,
  away,
  onDone,
}: {
  home: ClubColors;
  away: ClubColors;
  onDone: () => void;
}) {
  const { t } = useT();
  const [beat, setBeat] = useState(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const [fading, setFading] = useState(false);

  // Enter/Espaço pula a cerimônia; a saída tem um fade rápido
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        doneRef.current();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    setFading(true);
    const id = window.setTimeout(() => setFading(false), 60);
    return () => window.clearTimeout(id);
  }, [beat]);

  return (
    <div
      className="fixed inset-0 z-50 bg-[#04070c]"
      role="dialog"
      aria-modal="true"
      aria-label={t("ceremony.pregame")}
    >
      <Canvas
        dpr={[1, 1.75]}
        gl={{ antialias: true }}
        camera={{ fov: 55, near: 0.1, far: 220, position: [-27, 7, 35] }}
      >
        <color attach="background" args={["#04070c"]} />
        <fog attach="fog" args={["#04070c", 55, 160]} />
        <hemisphereLight args={["#8fb4ff", "#0a0f0a", 0.65]} />
        <directionalLight position={[18, 30, 14]} intensity={1.6} color="#fff2d9" />
        <directionalLight position={[-14, 22, -10]} intensity={0.5} color="#9fc0ff" />
        <Director onBeat={setBeat} onDone={onDone} />
        {beat === 0 ? <StadiumExterior club={home} /> : null}
        {beat === 1 ? <Walkout home={home} away={away} /> : null}
        {beat === 2 ? <Lineup home={home} away={away} /> : null}
        {beat === 3 ? <Tifo home={home} /> : null}
        {beat === 4 ? <CoinToss home={home} away={away} /> : null}
      </Canvas>

      {/* corte seco: flash de 120ms a cada beat */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 bg-black transition-opacity duration-150 ${fading ? "opacity-60" : "opacity-0"}`}
      />

      {/* placar do confronto */}
      <div className="absolute inset-x-0 top-4 flex justify-center">
        <div className="flex items-center gap-3 rounded-full border border-white/10 bg-black/60 px-5 py-2 backdrop-blur">
          <span className="h-3 w-3 rounded-full" style={{ background: home.primary }} />
          <span className="font-display text-sm uppercase tracking-widest text-white">
            {home.short}
          </span>
          <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-white/70">
            {t("ceremony.pregame")}
          </span>
          <span className="font-display text-sm uppercase tracking-widest text-white">
            {away.short}
          </span>
          <span className="h-3 w-3 rounded-full" style={{ background: away.primary }} />
        </div>
      </div>

      {/* legenda + progresso + ações */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-5 pt-10">
        <p
          key={beat}
          className="text-center font-display text-lg uppercase tracking-wide text-white md:text-xl"
        >
          {t(`ceremony.beat${beat}`)}
        </p>
        <div className="mt-3 flex justify-center gap-1.5" aria-hidden="true">
          {BEAT_LEN.map((_, k) => (
            <span
              key={k}
              className={`h-1.5 w-8 rounded-full ${k <= beat ? "bg-primary" : "bg-white/25"}`}
            />
          ))}
        </div>
        <div className="mt-3 flex justify-center gap-2">
          <button
            onClick={onDone}
            className="rounded-full border border-white/20 bg-black/70 px-4 py-2 text-xs uppercase tracking-widest text-white/85 backdrop-blur"
          >
            {t("ceremony.skip")}
          </button>
          <button
            onClick={() => {
              storeCeremony(false);
              onDone();
            }}
            className="rounded-full border border-white/10 bg-black/60 px-4 py-2 text-xs uppercase tracking-widest text-white/60 backdrop-blur"
          >
            {t("ceremony.hide")}
          </button>
        </div>
      </div>
    </div>
  );
}
