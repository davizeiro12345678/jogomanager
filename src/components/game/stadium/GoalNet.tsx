import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { FIELD_X, type SimView } from "@/game/sim";
import { NetDynamics, rearNetImpact, type NetBall } from "@/game/net-dynamics";

type Face = "back" | "left" | "right" | "roof";

/** Each tied panel has its own wave field, driven once by swept ball contact.
 * The surrounding frame remains rigid; only the fabric stretches. */
export function GoalNetPanel({ side, sim, material, quality, face = "back" }: {
  side: number; sim: SimView; material: THREE.Material;
  quality: "alta" | "media" | "baixa"; face?: Face;
}) {
  const cols = quality === "alta" ? 28 : quality === "media" ? 18 : 10;
  const rows = quality === "alta" ? 16 : quality === "media" ? 10 : 6;
  const spec = useMemo(() => {
    const position: [number, number, number] = face === "back" ? [side * 1.9, 1.22, 0]
      : face === "roof" ? [side * 0.95, 2.44, 0]
      : [side * 0.95, 1.22, face === "left" ? -3.66 : 3.66];
    const rotation: [number, number, number] = face === "back" ? [0, side * Math.PI / 2, 0]
      : face === "roof" ? [-Math.PI / 2, 0, 0]
      : [0, face === "left" ? Math.PI : 0, 0];
    const width = face === "back" ? 7.32 : 1.9;
    const height = face === "roof" ? 7.32 : 2.44;
    const inverse = new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)).invert();
    return { position, rotation, width, height, inverse };
  }, [face, side]);
  const geometry = useMemo(() => new THREE.PlaneGeometry(spec.width, spec.height, cols, rows), [spec, cols, rows]);
  const wave = useMemo(() => new NetDynamics(cols, rows), [cols, rows]);
  const previous = useRef<NetBall | null>(null);
  const goalCount = useRef(side > 0 ? sim.stats.home.goals : sim.stats.away.goals);
  const lastFlight = useRef<NetBall | null>(null);
  const localBefore = useMemo(() => new THREE.Vector3(), []);
  const localBall = useMemo(() => new THREE.Vector3(), []);
  const meshTime = useRef(0);
  const normalTime = useRef(0);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(({ clock }, dt) => {
    const b = sim.visualBall ?? sim.ball;
    const prior = previous.current;
    if (side * b.vx > 4 && side * b.x > FIELD_X - 20 && Math.abs(b.z) < 5)
      lastFlight.current = { ...b };
    const goals = side > 0 ? sim.stats.home.goals : sim.stats.away.goals;
    // MatchSim restarts immediately after scoring. A confirmed score also
    // excites the cloth, using the last incoming trajectory when available.
    // Mounting an old replay score never triggers a spurious goal impact.
    if (goals > goalCount.current && face === "back") {
      const flight = lastFlight.current;
      const speed = flight ? Math.hypot(flight.vx, flight.vz) : 12;
      const depth = flight ? Math.max(0, side * (side * (FIELD_X + 1.72) - flight.x)) : 0;
      const travel = flight && side * flight.vx > 1 ? Math.min(0.4, depth / Math.abs(flight.vx)) : 0;
      const z = THREE.MathUtils.clamp((flight?.z ?? 0) + (flight?.vz ?? 0) * travel, -3.3, 3.3);
      const height = THREE.MathUtils.clamp(flight?.height ?? 1, 0.22, 2.22);
      wave.impact(0.5 - side * z / 7.32, 1 - height / 2.44, speed);
      lastFlight.current = null;
    }
    goalCount.current = goals;
    if (prior) {
      let impact = face === "back" ? rearNetImpact(prior, b, side, FIELD_X) : null;
      if (face !== "back") {
        const project = (target: THREE.Vector3, ball: NetBall) => target.set(
          ball.x - side * FIELD_X - spec.position[0], ball.height - spec.position[1], ball.z - spec.position[2],
        ).applyQuaternion(spec.inverse);
        project(localBefore, prior); project(localBall, b);
        const delta = localBall.z - localBefore.z;
        if (localBefore.z < -0.12 && localBall.z >= -0.12 && delta < 5) {
          const alpha = (-0.12 - localBefore.z) / delta;
          const x = THREE.MathUtils.lerp(localBefore.x, localBall.x, alpha);
          const y = THREE.MathUtils.lerp(localBefore.y, localBall.y, alpha);
          if (Math.abs(x) < spec.width / 2 && Math.abs(y) < spec.height / 2)
            impact = { u: x / spec.width + 0.5, v: 0.5 - y / spec.height,
              speed: Math.max(Math.hypot(b.vx, b.vz), Math.hypot(prior.vx, prior.vz)) };
        }
      }
      if (impact) wave.impact(impact.u, impact.v, impact.speed);
    }
    if (!previous.current) previous.current = { ...b };
    else Object.assign(previous.current, b);
    const strength = sim.wind?.strength01 ?? 0.25;
    const normalWind = face === "back" ? Math.abs(sim.wind?.x ?? 0)
      : face === "roof" ? strength * 0.2 : Math.abs(sim.wind?.z ?? 0);
    wave.step(dt, clock.elapsedTime, Math.min(1, normalWind));
    meshTime.current += dt;
    normalTime.current += dt;
    if (meshTime.current < 1 / 30) return;
    meshTime.current %= 1 / 30;
    const positions = geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let y = 0; y <= rows; y++) {
      for (let x = 0; x <= cols; x++) {
        const index = y * (cols + 1) + x;
        const tie = Math.sin(Math.PI * x / cols) * Math.sin(Math.PI * y / rows);
        positions.setZ(index, -0.12 * tie + wave.displacement[index]!);
      }
    }
    positions.needsUpdate = true;
    if (normalTime.current >= 1 / 15) {
      geometry.computeVertexNormals();
      normalTime.current %= 1 / 15;
    }
  });
  return <mesh position={spec.position} rotation={spec.rotation} geometry={geometry} material={material} frustumCulled={false} />;
}
