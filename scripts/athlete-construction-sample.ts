import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";
import type { RigSkin } from "../src/game/rig-skin";

const [root, output, pass] = process.argv.slice(2);
if (!root || !output || !pass) throw new Error("Expected source root, result path and ABBA pass");
const load = (file: string) => import(pathToFileURL(path.join(root, "src/game", file)).href);
const [{ lookFor, proportionsFor }, { playerMaterials }, { buildRigSkin }, { sculptedHead }] =
  await Promise.all([
    load("player-model.ts"),
    load("player-materials.ts"),
    load("rig-skin.ts"),
    load("player-sculpt.ts"),
  ]);
const digest = (data: Uint8Array | string) => createHash("sha256").update(data).digest("hex");
const kit = {
  base: "#af1830",
  detail: "#15191f",
  pattern: "hoops",
  shorts: "#eeeeee",
  socks: "#171b20",
};
const fixtures = ["MF", "GK"].map((role) => {
  const look = lookFor(`construction-20261025-${role}`, role, true),
    P = proportionsFor(look);
  const mats = playerMaterials(look, kit, null, "alta");
  const ctx = {
    P,
    look,
    mats,
    hi: true,
    portrait: true,
    segs: { radial: 24, cap: 6 },
    handR: P.handR * (look.gloves ? 1.25 : 1),
    handMat: look.gloves ? mats.glove : mats.skin,
    jerseyInk: "#ffffff",
  };
  return { role, look, P, ctx };
});
const identity = fixtures.map(({ role, look, P, ctx }) => {
  const head = sculptedHead(P, look.seed, true, true);
  const headAttributes = Object.fromEntries(
    ["position", "normal", "uv", "color"].map((name) => {
      const a = head.getAttribute(name).array;
      return [name, digest(new Uint8Array(a.buffer, a.byteOffset, a.byteLength))];
    }),
  );
  head.dispose();
  const skin = buildRigSkin(ctx, [0, 0, 0]) as RigSkin;
  const topology = {
    triangles: skin.groups.reduce((n, g) => n + (g.geometry.index?.count ?? 0) / 3, 0),
    draws: skin.groups.length,
  };
  skin.dispose();
  return { role, look, headAttributes, topology };
});
const samples: { round: number; role: string; ms: number }[] = [];
for (let round = -2; round < 8; round++)
  for (const { role, ctx } of fixtures) {
    const start = performance.now();
    const skin = buildRigSkin(ctx, [0, 0, 0]) as RigSkin;
    const ms = performance.now() - start;
    skin.dispose();
    if (round >= 0) samples.push({ round, role, ms });
  }
writeFileSync(
  output,
  JSON.stringify(
    {
      pass,
      node: process.version,
      lockfile: digest(readFileSync(path.join(root, "package-lock.json"))),
      fixtureHash: digest(JSON.stringify(fixtures.map((f) => f.look))),
      identity,
      samples,
    },
    null,
    2,
  ) + "\n",
);
