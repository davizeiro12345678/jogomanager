// ============================================================================
//  StadiumExterior.tsx
//  Entorno do estádio à noite: tigela iluminada, anel de LED na cor do clube,
//  4 refletores, ônibus da delegação chegando e torcedores indo às catracas.
//
//  Usado como beat 0 da cerimônia pré-jogo. Tudo estático e mesclado, exceto
//  ônibus (1 grupo) e torcedores (1 InstancedMesh).
// ============================================================================

import { memo, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import type { ClubColors } from "./ClubIdentity";

function paint(g: THREE.BufferGeometry, c: string, emissive = 0): THREE.BufferGeometry {
  const tmp = new THREE.Color(c);
  const n = g.getAttribute("position").count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) tmp.toArray(colors, i * 3);
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  if (emissive > 0) {
    const e = new Float32Array(n);
    e.fill(emissive);
    g.setAttribute("emissive", new THREE.BufferAttribute(e, 1));
  }
  return g;
}

/** Torcedores caminhando até os portões: instância única, vai-e-vem em loop. */
const Fans = memo(function Fans({ count = 42 }: { count?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const seeds = useMemo(
    () =>
      Array.from({ length: count }, (_, k) => ({
        lane: (k % 7) - 3,
        speed: 0.5 + ((k * 37) % 10) / 14,
        offset: ((k * 61) % 100) / 100,
        hue: ["#d94f3d", "#e8e8e8", "#3d6ed9", "#e8b93c", "#22262c"][(k * 13) % 5]!,
      })),
    [count],
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    const t = clock.elapsedTime;
    for (let k = 0; k < seeds.length; k++) {
      const s = seeds[k]!;
      const p = (s.offset + t * s.speed * 0.03) % 1;
      dummy.position.set(
        s.lane * 3.4 + Math.sin(k * 2.3) * 0.8,
        0.55 + Math.abs(Math.sin(t * 6 + k)) * 0.06,
        26 - p * 34,
      );
      dummy.rotation.y = Math.PI;
      dummy.updateMatrix();
      m.setMatrixAt(k, dummy.matrix);
      if (p < 0.02) {
        m.setColorAt(k, color.set(s.hue));
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
      }
    }
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      <capsuleGeometry args={[0.22, 0.7, 3, 6]} />
      <meshStandardMaterial roughness={0.9} />
    </instancedMesh>
  );
});

/** Ônibus da delegação estacionando em frente ao portão principal. */
function TeamBus({ color }: { color: string }) {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!g.current) return;
    const t = Math.min(1, clock.elapsedTime / 6);
    const e = 1 - Math.pow(1 - t, 3);
    g.current.position.x = -34 + e * 26;
  });
  return (
    <group ref={g} position={[-34, 0, 20]}>
      <mesh position={[0, 1.35, 0]}>
        <boxGeometry args={[10, 2.3, 2.6]} />
        <meshStandardMaterial color={color} roughness={0.35} metalness={0.25} />
      </mesh>
      {/* janelas acesas */}
      <mesh position={[0, 1.65, 1.31]}>
        <planeGeometry args={[9.2, 0.9]} />
        <meshBasicMaterial color="#ffe9a8" />
      </mesh>
      <mesh position={[0, 1.65, -1.31]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[9.2, 0.9]} />
        <meshBasicMaterial color="#ffe9a8" />
      </mesh>
      {[-3.4, 3.4].map((x) =>
        [-1.35, 1.35].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 0.42, z]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.42, 0.42, 0.3, 12]} />
            <meshStandardMaterial color="#14161a" roughness={0.9} />
          </mesh>
        )),
      )}
      {/* faróis */}
      {[-0.7, 0.7].map((z) => (
        <mesh key={z} position={[5.01, 0.7, z]}>
          <sphereGeometry args={[0.14, 8, 8]} />
          <meshBasicMaterial color="#fff6d8" />
        </mesh>
      ))}
    </group>
  );
}

export const StadiumExterior = memo(function StadiumExterior({
  club,
  night = true,
}: {
  club: ClubColors;
  night?: boolean;
}) {
  const shell = useMemo(() => {
    const geos: THREE.BufferGeometry[] = [];
    const put = (g: THREE.BufferGeometry, x: number, y: number, z: number, c: string) => {
      g.translate(x, y, z);
      geos.push(paint(g, c));
    };
    // tigela do estádio: anel externo + cobertura
    const bowl = new THREE.CylinderGeometry(30, 33, 12, 40, 1, true);
    bowl.translate(0, 6, -18);
    geos.push(paint(bowl, night ? "#1a2230" : "#39435a"));
    const roof = new THREE.CylinderGeometry(24, 30, 1.4, 40, 1, true);
    roof.translate(0, 12.4, -18);
    geos.push(paint(roof, "#0e141d"));
    // brilho do gramado vazando por cima
    const glow = new THREE.CylinderGeometry(23.5, 23.5, 0.4, 40, 1, true);
    glow.translate(0, 11.9, -18);
    geos.push(paint(glow, "#eaf6ff"));
    // portões
    for (let k = -2; k <= 2; k++) {
      put(new THREE.BoxGeometry(2.6, 3.4, 1), k * 7, 1.7, 14.5, "#0d1218");
      put(new THREE.BoxGeometry(3.2, 0.5, 1.2), k * 7, 3.7, 14.5, club.primary);
    }
    // praça + rua
    put(new THREE.BoxGeometry(90, 0.2, 60), 0, -0.1, 8, night ? "#11161f" : "#2a3342");
    put(new THREE.BoxGeometry(90, 0.22, 7), 0, -0.09, 24, "#0a0e14");
    return mergeGeometries(geos, false)!;
  }, [club.primary, night]);

  const pylons = useMemo(() => {
    const geos: THREE.BufferGeometry[] = [];
    for (const [x, z] of [
      [-30, -38],
      [30, -38],
      [-30, 2],
      [30, 2],
    ] as const) {
      const post = new THREE.BoxGeometry(1.1, 26, 1.1);
      post.translate(x, 13, z);
      geos.push(paint(post, "#232b38"));
      const head = new THREE.BoxGeometry(6, 2.6, 0.7);
      head.translate(x, 26.5, z);
      geos.push(paint(head, "#f4f8ff"));
    }
    return mergeGeometries(geos, false)!;
  }, []);

  const cloth = useMemo(
    () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }),
    [],
  );

  return (
    <group name="stadium-exterior">
      <mesh geometry={shell} material={cloth} />
      <mesh geometry={pylons} material={cloth} />
      {/* anel de LED na cor do clube */}
      <mesh position={[0, 12.4, -18]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[27.2, 0.22, 8, 64]} />
        <meshBasicMaterial color={club.primary} />
      </mesh>
      {/* fachos dos refletores */}
      {(
        [
          [-30, -38],
          [30, -38],
          [-30, 2],
          [30, 2],
        ] as Array<[number, number]>
      ).map(([x, z], k) => (
        <mesh key={k} position={[x, 20, z]} rotation={[0.35, 0, x > 0 ? -0.3 : 0.3]}>
          <coneGeometry args={[4.5, 14, 12, 1, true]} />
          <meshBasicMaterial
            color="#dcebff"
            transparent
            opacity={0.1}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}
      <TeamBus color={club.secondary} />
      <Fans />
      {/* letreiro do jogo */}
      <mesh position={[0, 6.4, 14.6]}>
        <planeGeometry args={[10, 1.6]} />
        <meshBasicMaterial color="#05080c" />
      </mesh>
    </group>
  );
});
