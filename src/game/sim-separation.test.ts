import { expect, it } from "vitest";
import { FIELD_X, FIELD_Z, MatchSim, type SimPlayer } from "./sim";
import { athleteContact } from "./athlete-dynamics";
import { buildTeamSetup } from "./quickMatch";
type SeparationState = {
  players: SimPlayer[];
  ball: { holder: string | null };
  rnd(): number;
  separate(): void;
};
function referenceSeparate(this: SeparationState) {
  const R = 0.85; // raio do corpo
  const list = this.players;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i]!;
      const b = list[j]!;
      let dx = b.x - a.x;
      let dz = b.z - a.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > 2.89) continue; // (0.85 * 2)^2
      let d = Math.sqrt(d2);
      if (d > R * 2) continue;
      if (d < 1e-4) {
        dx = (this.rnd() - 0.5) * 0.02;
        dz = (this.rnd() - 0.5) * 0.02;
        d = Math.hypot(dx, dz) || 1e-4;
      }
      const overlap = R * 2 - d;
      // Quem conduz a bola cede menos, mas a soma dos deslocamentos sempre
      // resolve toda a sobreposição para não deixar atletas grudados.
      const aWeight = a.id === this.ball.holder ? 0.25 : 1;
      const bWeight = b.id === this.ball.holder ? 0.25 : 1;
      const totalWeight = aWeight + bWeight;
      const nx = dx / d;
      const nz = dz / d;
      athleteContact(a, b, nx, nz);
      a.x -= nx * overlap * (aWeight / totalWeight);
      a.z -= nz * overlap * (aWeight / totalWeight);
      b.x += nx * overlap * (bWeight / totalWeight);
      b.z += nz * overlap * (bWeight / totalWeight);
    }
  }
  for (const p of list) {
    p.x = Math.max(-FIELD_X - 1, Math.min(FIELD_X + 1, p.x));
    p.z = Math.max(-FIELD_Z - 1, Math.min(FIELD_Z + 1, p.z));
  }
}

it("preserves sequential contacts, boundary distances, invalid coordinates and PRNG", () => {
  for (const spread of [0, 0.1, 1.7, -1.7, 1.7000000000000002, 4, 50, -50, NaN, Infinity]) {
    const current = new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), "contacts");
    const reference = new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), "contacts");
    try {
      for (const sim of [current, reference]) {
        for (let i = 0; i < sim.players.length; i++) {
          const player = sim.players[i]!;
          player.x = (i % 5) * spread;
          player.z = Math.floor(i / 5) * spread;
          player.vx = i * 0.1;
          player.vz = -i * 0.2;
        }
        sim.ball.holder = sim.players[0]!.id;
        // A finite, distant x with NaN z must still take the legacy recovery path.
        if (spread === 50) sim.players[sim.players.length - 1]!.z = NaN;
      }
      for (let pass = 0; pass < 8; pass++) {
        (current as unknown as SeparationState).separate();
        referenceSeparate.call(reference as unknown as SeparationState);
        expect(current.players).toEqual(reference.players);
        expect(current.checkpoint()).toEqual(reference.checkpoint());
      }
    } finally {
      current.dispose();
      reference.dispose();
    }
  }
});
