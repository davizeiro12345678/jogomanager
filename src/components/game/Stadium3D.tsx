import type React from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

import { FIELD_X, FIELD_Z, type MatchSim, type SimPlayer } from "@/game/sim";

export type CameraMode = "broadcast" | "tactical" | "goal";

function Pitch({ homeColor, awayColor }: { homeColor: string; awayColor: string }) {
  const stripes = useMemo(() => {
    const arr: { x: number; w: number }[] = [];
    const count = 14;
    const w = (FIELD_X * 2) / count;
    for (let i = 0; i < count; i++) arr.push({ x: -FIELD_X + w / 2 + i * w, w });
    return arr;
  }, []);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]} receiveShadow>
        <planeGeometry args={[FIELD_X * 2 + 26, FIELD_Z * 2 + 26]} />
        <meshStandardMaterial color="#14512c" roughness={1} />
      </mesh>
      {stripes.map((s, i) => (
        <mesh
          key={i}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[s.x, 0, 0]}
          receiveShadow
        >
          <planeGeometry args={[s.w, FIELD_Z * 2]} />
          <meshStandardMaterial color={i % 2 === 0 ? "#20824a" : "#1a6f3d"} roughness={0.92} />
        </mesh>
      ))}
      <Lines />
      <Goal side={1} />
      <Goal side={-1} />
      <AdBoards />
      <Floodlights />
      <Stands homeColor={homeColor} awayColor={awayColor} />
    </group>
  );
}

function AdBoards() {
  const colors = ["#0b2b45", "#8a1420", "#123f2a", "#3a2f6b", "#6b4a12"];
  const boards: React.ReactElement[] = [];
  const count = 16;
  const w = ((FIELD_X + 6) * 2) / count;
  for (let i = 0; i < count; i++) {
    const x = -(FIELD_X + 6) + w / 2 + i * w;
    for (const z of [-1, 1]) {
      const c = colors[(i + (z > 0 ? 1 : 0)) % colors.length]!;
      boards.push(
        <mesh key={`${i}-${z}`} position={[x, 0.55, z * (FIELD_Z + 4.5)]}>
          <boxGeometry args={[w * 0.94, 1.1, 0.25]} />
          <meshStandardMaterial
            color={c}
            emissive={c}
            emissiveIntensity={0.35}
            roughness={0.5}
          />
        </mesh>,

      );
    }
  }
  return <group>{boards}</group>;
}

function Floodlights() {
  const spots: [number, number][] = [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ];
  return (
    <group>
      {spots.map(([sx, sz], i) => (
        <group key={i} position={[sx * (FIELD_X + 16), 0, sz * (FIELD_Z + 18)]}>
          <mesh position={[0, 13, 0]}>
            <cylinderGeometry args={[0.5, 0.8, 26, 8]} />
            <meshStandardMaterial color="#2a3138" roughness={0.8} />
          </mesh>
          <mesh position={[0, 26.5, 0]}>
            <boxGeometry args={[7, 3, 1]} />
            <meshStandardMaterial color="#f5f8ff" emissive="#dceaff" emissiveIntensity={1.6} />
          </mesh>
          <pointLight position={[0, 26, 0]} intensity={900} distance={190} color="#e8f2ff" />
        </group>
      ))}
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
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * Math.PI * 2;
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
        <primitive key={i} object={new THREE.Line(g, new THREE.LineBasicMaterial({ color: "#eaf7ee", transparent: true, opacity: 0.85 }))} />
      ))}
    </group>
  );
}

function Goal({ side }: { side: number }) {
  const x = side * FIELD_X;
  return (
    <group position={[x, 0, 0]}>
      {[-3.66, 3.66].map((z) => (
        <mesh key={z} position={[0, 1.22, z]} castShadow>
          <cylinderGeometry args={[0.09, 0.09, 2.44, 10]} />
          <meshStandardMaterial color="#f4f4f4" />
        </mesh>
      ))}
      <mesh position={[0, 2.44, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.09, 7.32, 10]} />
        <meshStandardMaterial color="#f4f4f4" />
      </mesh>
      <mesh position={[side * 0.9, 1.22, 0]}>
        <boxGeometry args={[1.8, 2.44, 7.32]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.14} wireframe />
      </mesh>
    </group>
  );
}

function Stands({ homeColor, awayColor }: { homeColor: string; awayColor: string }) {
  const crowd = useMemo(() => {
    const positions: THREE.Matrix4[] = [];
    const colors: THREE.Color[] = [];
    const neutral = ["#d8d8d8", "#8fa3b8", "#42506b", "#e0c07a"];
    for (let ring = 0; ring < 7; ring++) {
      for (let i = 0; i < 200; i++) {
        const t = i / 200;
        const perimX = -FIELD_X - 8 + t * (FIELD_X * 2 + 16);
        for (const zSide of [-1, 1]) {
          const m = new THREE.Matrix4().setPosition(
            perimX,
            2 + ring * 1.35,
            zSide * (FIELD_Z + 7 + ring * 1.9),
          );
          positions.push(m);
          const fanZone = t < 0.34 ? homeColor : t > 0.66 ? awayColor : null;
          const c = fanZone && (i + ring) % 3 !== 0 ? fanZone : neutral[(i + ring) % neutral.length]!;
          colors.push(new THREE.Color(c));
        }
      }
    }
    return { positions, colors };
  }, [homeColor, awayColor]);


  const ref = useRef<THREE.InstancedMesh>(null);
  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = clock.elapsedTime;
    for (let i = 0; i < crowd.positions.length; i += 1) {
      const m = crowd.positions[i]!.clone();
      m.elements[13] += Math.sin(t * 3 + i) * 0.06;
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, crowd.colors[i]!);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      {[-1, 1].map((z) => (
        <mesh key={z} position={[0, 3.5, z * (FIELD_Z + 12)]} rotation={[z * 0.32, 0, 0]}>
          <boxGeometry args={[FIELD_X * 2 + 20, 14, 22]} />
          <meshStandardMaterial color="#0f1417" roughness={1} />
        </mesh>
      ))}
      {[-1, 1].map((x) => (
        <mesh key={x} position={[x * (FIELD_X + 14), 4, 0]}>
          <boxGeometry args={[20, 14, FIELD_Z * 2 + 30]} />
          <meshStandardMaterial color="#0f1417" roughness={1} />
        </mesh>
      ))}
      <instancedMesh ref={ref} args={[undefined, undefined, crowd.positions.length]}>
        <boxGeometry args={[0.42, 0.6, 0.42]} />
        <meshStandardMaterial vertexColors />
      </instancedMesh>
    </group>
  );
}

function PlayerMesh({
  player,
  primary,
  secondary,
}: {
  player: SimPlayer;
  primary: string;
  secondary: string;
}) {
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    g.position.x += (player.x - g.position.x) * 0.35;
    g.position.z += (player.z - g.position.z) * 0.35;
    const speed = Math.hypot(player.vx, player.vz);
    g.rotation.y = Math.atan2(player.vx, player.vz);
    const swing = Math.sin(clock.elapsedTime * 11) * 0.35 * Math.min(1, speed);
    const legs = g.children.filter((c) => c.userData['leg']);
    legs.forEach((l, i) => {
      l.rotation.x = i === 0 ? swing : -swing;
    });
  });

  return (
    <group ref={group} position={[player.x, 0, player.z]}>
      <mesh position={[0, 1.15, 0]} castShadow>
        <capsuleGeometry args={[0.26, 0.55, 4, 10]} />
        <meshStandardMaterial color={primary} roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.72, 0]} castShadow>
        <sphereGeometry args={[0.19, 14, 14]} />
        <meshStandardMaterial color="#c98d63" roughness={0.8} />
      </mesh>
      {[-0.14, 0.14].map((x, i) => (
        <mesh key={x} position={[x, 0.4, 0]} userData={{ leg: true }} castShadow>
          <capsuleGeometry args={[0.09, 0.5, 4, 8]} />
          <meshStandardMaterial color={secondary} />
        </mesh>
      ))}
    </group>
  );
}

function Ball({ sim }: { sim: MatchSim }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    const m = ref.current;
    if (!m) return;
    m.position.x += (sim.ball.x - m.position.x) * 0.5;
    m.position.z += (sim.ball.z - m.position.z) * 0.5;
    m.position.y = 0.13 + sim.ball.height;
    m.rotation.x += dt * 6;
    m.rotation.z += dt * 4;
  });
  return (
    <mesh ref={ref} castShadow position={[0, 0.13, 0]}>
      <sphereGeometry args={[0.13, 18, 18]} />
      <meshStandardMaterial color="#ffffff" roughness={0.35} />
    </mesh>
  );
}

function Rig({ sim, mode }: { sim: MatchSim; mode: CameraMode }) {
  useFrame(({ camera }) => {
    const bx = sim.ball.x;
    const bz = sim.ball.z;
    let target = new THREE.Vector3();
    if (mode === "broadcast") target.set(bx * 0.55, 26, FIELD_Z + 34);
    else if (mode === "tactical") target.set(bx * 0.2, 62, 2);
    else target.set(FIELD_X + 16, 9, bz * 0.3);
    camera.position.lerp(target, 0.05);
    camera.lookAt(bx * 0.6, 0.6, bz * 0.6);
  });
  return null;
}

export function Stadium3D({
  sim,
  mode,
  quality,
  tick,
}: {
  sim: MatchSim;
  mode: CameraMode;
  quality: "alta" | "media";
  tick: number;
}) {
  return (
    <Canvas
      shadows={quality === "alta"}
      dpr={quality === "alta" ? [1, 2] : 1}
      camera={{ position: [0, 30, 70], fov: 42 }}
      gl={{ antialias: quality === "alta" }}
    >
      <color attach="background" args={["#060a10"]} />
      <fog attach="fog" args={["#060a10", 100, 250]} />
      <hemisphereLight intensity={0.5} groundColor="#0d2a18" color="#cfe4ff" />
      <directionalLight
        position={[40, 70, 30]}
        intensity={2.3}
        castShadow={quality === "alta"}
        shadow-mapSize={[2048, 2048]}
      />
      <directionalLight position={[-50, 60, -30]} intensity={0.9} color="#bcd8ff" />
      <Pitch homeColor={sim.home.primary} awayColor={sim.away.primary} />
      <Ball sim={sim} />

      {sim.players.map((p) => {
        const setup = p.side === "home" ? sim.home : sim.away;
        return (
          <PlayerMesh
            key={p.id + tick * 0}
            player={p}
            primary={setup.primary}
            secondary={setup.secondary}
          />
        );
      })}
      <Rig sim={sim} mode={mode} />
    </Canvas>
  );
}
