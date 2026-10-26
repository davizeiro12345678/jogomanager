import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { FIELD_X, type SimView } from "./sim";
import { NetDynamics, rearNetImpact, type NetBall } from "./net-dynamics";
type Face = "back" | "left" | "right" | "roof";
function panelSpec(side: number, face: Face) {
  const position: [number, number, number] =
    face === "back"
      ? [side * 1.9, 1.22, 0]
      : face === "roof"
        ? [side * 0.95, 2.44, 0]
        : [side * 0.95, 1.22, face === "left" ? -3.66 : 3.66];
  const rotation: [number, number, number] =
    face === "back"
      ? [0, (side * Math.PI) / 2, 0]
      : face === "roof"
        ? [-Math.PI / 2, 0, 0]
        : [0, face === "left" ? Math.PI : 0, 0];
  const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation));
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(...position),
    quaternion,
    new THREE.Vector3(1, 1, 1),
  );
  return {
    position,
    width: face === "back" ? 7.32 : 1.9,
    height: face === "roof" ? 7.32 : 2.44,
    inverse: quaternion.clone().invert(),
    matrix,
    normalMatrix: new THREE.Matrix3().getNormalMatrix(matrix),
  };
}
/** Four independent original cloth fields share one GPU surface. Texture
 * repetition is baked into each panel's UVs; contacts and wave cadence stay
 * independent. The caller owns all generated buffers. */
export class GoalNetSurface {
  readonly panels;
  readonly geometry: THREE.BufferGeometry;
  private point = new THREE.Vector3();
  constructor(
    private readonly side: number,
    quality: "alta" | "media" | "baixa",
    sim: SimView,
  ) {
    const cols = quality === "alta" ? 28 : quality === "media" ? 18 : 10;
    const rows = quality === "alta" ? 16 : quality === "media" ? 10 : 6;
    let offset = 0;
    this.panels = (["back", "left", "right", "roof"] as Face[]).map((face) => {
      const spec = panelSpec(side, face),
        geometry = new THREE.PlaneGeometry(spec.width, spec.height, cols, rows);
      const panel = {
        face,
        spec,
        geometry,
        cols,
        rows,
        offset,
        wave: new NetDynamics(cols, rows),
        previous: null as NetBall | null,
        lastFlight: null as NetBall | null,
        goalCount: side > 0 ? sim.stats.home.goals : sim.stats.away.goals,
        meshTime: 0,
        normalTime: 0,
        localBefore: new THREE.Vector3(),
        localBall: new THREE.Vector3(),
      };
      offset += geometry.getAttribute("position").count;
      return panel;
    });
    const parts = this.panels.map(({ face, spec, geometry }) => {
      const part = geometry.clone().applyMatrix4(spec.matrix),
        uv = part.getAttribute("uv") as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++)
        uv.setXY(
          i,
          uv.getX(i) * (face === "back" ? 14 : 4),
          uv.getY(i) * (face === "roof" ? 14 : 5),
        );
      return part;
    });
    this.geometry = mergeGeometries(parts)!;
    parts.forEach((part) => part.dispose());
    (this.geometry.getAttribute("position") as THREE.BufferAttribute).setUsage(
      THREE.DynamicDrawUsage,
    );
    (this.geometry.getAttribute("normal") as THREE.BufferAttribute).setUsage(
      THREE.DynamicDrawUsage,
    );
  }
  update(sim: SimView, dt: number, time: number) {
    const side = this.side;
    const output = this.geometry.getAttribute("position") as THREE.BufferAttribute;
    const normals = this.geometry.getAttribute("normal") as THREE.BufferAttribute;
    for (const panel of this.panels) {
      const { face, spec, geometry, wave, cols, rows, localBefore, localBall } = panel;

      const b = sim.visualBall ?? sim.ball;
      const prior = panel.previous;
      if (side * b.vx > 4 && side * b.x > FIELD_X - 20 && Math.abs(b.z) < 5)
        panel.lastFlight = { ...b };
      const goals = side > 0 ? sim.stats.home.goals : sim.stats.away.goals;
      // MatchSim restarts immediately after scoring. A confirmed score also
      // excites the cloth, using the last incoming trajectory when available.
      // Mounting an old replay score never triggers a spurious goal impact.
      if (goals > panel.goalCount && face === "back") {
        const flight = panel.lastFlight;
        const speed = flight ? Math.hypot(flight.vx, flight.vz) : 12;
        const depth = flight ? Math.max(0, side * (side * (FIELD_X + 1.72) - flight.x)) : 0;
        const travel =
          flight && side * flight.vx > 1 ? Math.min(0.4, depth / Math.abs(flight.vx)) : 0;
        const z = THREE.MathUtils.clamp((flight?.z ?? 0) + (flight?.vz ?? 0) * travel, -3.3, 3.3);
        const height = THREE.MathUtils.clamp(flight?.height ?? 1, 0.22, 2.22);
        wave.impact(0.5 - (side * z) / 7.32, 1 - height / 2.44, speed);
        panel.lastFlight = null;
      }
      panel.goalCount = goals;
      if (prior) {
        let impact = face === "back" ? rearNetImpact(prior, b, side, FIELD_X) : null;
        if (face !== "back") {
          const project = (target: THREE.Vector3, ball: NetBall) =>
            target
              .set(
                ball.x - side * FIELD_X - spec.position[0],
                ball.height - spec.position[1],
                ball.z - spec.position[2],
              )
              .applyQuaternion(spec.inverse);
          project(localBefore, prior);
          project(localBall, b);
          const delta = localBall.z - localBefore.z;
          if (localBefore.z < -0.12 && localBall.z >= -0.12 && delta < 5) {
            const alpha = (-0.12 - localBefore.z) / delta;
            const x = THREE.MathUtils.lerp(localBefore.x, localBall.x, alpha);
            const y = THREE.MathUtils.lerp(localBefore.y, localBall.y, alpha);
            if (Math.abs(x) < spec.width / 2 && Math.abs(y) < spec.height / 2)
              impact = {
                u: x / spec.width + 0.5,
                v: 0.5 - y / spec.height,
                speed: Math.max(Math.hypot(b.vx, b.vz), Math.hypot(prior.vx, prior.vz)),
              };
          }
        }
        if (impact) wave.impact(impact.u, impact.v, impact.speed);
      }
      if (!panel.previous) panel.previous = { ...b };
      else Object.assign(panel.previous, b);
      const strength = sim.wind?.strength01 ?? 0.25;
      const normalWind =
        face === "back"
          ? Math.abs(sim.wind?.x ?? 0)
          : face === "roof"
            ? strength * 0.2
            : Math.abs(sim.wind?.z ?? 0);
      wave.step(dt, time, Math.min(1, normalWind));
      panel.meshTime += dt;
      panel.normalTime += dt;
      if (panel.meshTime < 1 / 30) continue;
      panel.meshTime %= 1 / 30;
      const positions = geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let y = 0; y <= rows; y++) {
        for (let x = 0; x <= cols; x++) {
          const index = y * (cols + 1) + x;
          const tie = Math.sin((Math.PI * x) / cols) * Math.sin((Math.PI * y) / rows);
          positions.setZ(index, -0.12 * tie + wave.displacement[index]!);
        }
      }
      positions.needsUpdate = true;
      const normalChanged = panel.normalTime >= 1 / 15;
      if (normalChanged) {
        geometry.computeVertexNormals();
        panel.normalTime %= 1 / 15;
      }
      const localNormals = geometry.getAttribute("normal");
      for (let index = 0; index < positions.count; index++) {
        this.point.fromBufferAttribute(positions, index).applyMatrix4(spec.matrix);
        output.setXYZ(panel.offset + index, this.point.x, this.point.y, this.point.z);
        if (normalChanged) {
          this.point
            .fromBufferAttribute(localNormals, index)
            .applyMatrix3(spec.normalMatrix)
            .normalize();
          normals.setXYZ(panel.offset + index, this.point.x, this.point.y, this.point.z);
        }
      }
      output.needsUpdate = true;
      if (normalChanged) normals.needsUpdate = true;
    }
  }
  dispose() {
    this.geometry.dispose();
    for (const panel of this.panels) panel.geometry.dispose();
  }
}
