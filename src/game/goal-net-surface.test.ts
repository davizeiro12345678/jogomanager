import { expect, it } from "vitest";
import { GoalNetSurface } from "./goal-net-surface";
import reference from "./goal-net-reference.json";
import type { SimView } from "./sim";

it.each(["baixa", "media"] as const)(
  "preserves recorded panel contacts, wind, positions, normals and texture repeats in one %s draw",
  (quality) => {
    for (const side of [-1, 1]) {
      const sim = {
        stats: { home: { goals: 0 }, away: { goals: 0 } },
        wind: { x: 0.7, z: -0.4, strength01: 0.4 },
        ball: { x: 0, z: 0, height: 1, vx: 0, vz: 0 },
      } as unknown as SimView;
      const surface = new GoalNetSurface(side, quality, sim);
      try {
        expect(surface.geometry.groups).toHaveLength(0);
        for (let tick = 1; tick <= 60; tick++) {
          Object.assign(sim.ball, {
            x: side * (50.5 + tick * 0.3),
            z: Math.sin(tick * 0.17),
            height: 1 + 0.3 * Math.sin(tick * 0.1),
            vx: side * 9,
            vz: 1.7,
          });
          if (tick === 20) (side > 0 ? sim.stats.home : sim.stats.away).goals++;
          surface.update(sim, 1 / 30, tick / 30);
          const frame = reference.records.find(
            (r) => r.quality === quality && r.side === side && r.tick === tick,
          );
          if (!frame) continue;
          expect(surface.geometry.index!.count).toBe(
            frame.panels.reduce((n, p) => n + p.indices, 0),
          );
          for (const panel of frame.panels) {
            const output = surface.panels.find((p) => p.face === panel.face)!;
            for (const sample of panel.samples) {
              const index = output.offset + sample.index,
                p = surface.geometry.getAttribute("position"),
                n = surface.geometry.getAttribute("normal"),
                uv = surface.geometry.getAttribute("uv");
              const actual = [
                p.getX(index),
                p.getY(index),
                p.getZ(index),
                n.getX(index),
                n.getY(index),
                n.getZ(index),
                uv.getX(index),
                uv.getY(index),
              ];
              actual.forEach((value, i) => expect(value).toBeCloseTo(sample.values[i]!, 5));
            }
          }
        }
      } finally {
        surface.dispose();
      }
    }
  },
);
