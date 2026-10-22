import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import RAPIER from "@dimforge/rapier3d-compat";
import { rolldown } from "rolldown";
import { transformWithOxc } from "vite";
import { afterEach, describe, expect, it, vi } from "vitest";
import { rapierSourceModules, sharedRapierBindings } from "../../scripts/rapier-source-modules";

const modulePath = createRequire(import.meta.url)
  .resolve("@dimforge/rapier3d-compat")
  .replace(/rapier\.cjs$/, "rapier.mjs");
const wasm = readFileSync(path.join(path.dirname(modulePath), "rapier_wasm3d_bg.wasm"));
const url = "https://bundle.test/rapier.wasm";

async function compiledApi() {
  const modules = rapierSourceModules(modulePath, JSON.stringify(url));
  const directory = mkdtempSync(path.join(tmpdir(), "rapier-source-parity-"));
  const bindings = await sharedRapierBindings(modulePath);
  const bindingsPath = path.join(directory, "bindings.mjs");
  writeFileSync(bindingsPath, bindings.code);
  const build = await rolldown({
    input: "index.ts",
    treeshake: { moduleSideEffects: false },
    plugins: [
      {
        name: "official-source-parity",
        resolveId(id, importer) {
          if (id === "index.ts") return "index.ts";
          if (!importer || !id.startsWith(".")) return null;
          const relative = path.posix.normalize(path.posix.join(path.posix.dirname(importer), id));
          if (relative === "rapier_wasm3d.js")
            return { id: pathToFileURL(bindingsPath).href, external: "absolute" };
          return [relative, `${relative}.ts`, `${relative}/index.ts`].find((file) =>
            modules.has(file),
          );
        },
        async load(id) {
          const source = modules.get(id);
          if (source) return transformWithOxc(source, id, { lang: "ts", target: "es2022" });
          return null;
        },
      },
    ],
  });
  try {
    const { output } = await build.generate({ format: "es", minify: true });
    const entry = output.find((item) => item.type === "chunk");
    if (!entry) throw new Error("Missing Rapier source entry");
    expect(entry.code.length).toBeLessThan(180_000);
    expect(bindings.code.length).toBeLessThan(180_000);
    expect(entry.code).toContain(pathToFileURL(bindingsPath).href);
    expect(entry.code).not.toContain("AGFzbQE");
    const entryPath = path.join(directory, "entry.mjs");
    writeFileSync(entryPath, entry.code);
    return (await import(
      /* @vite-ignore */ pathToFileURL(entryPath).href
    )) as typeof import("@dimforge/rapier3d-compat");
  } finally {
    await build.close();
  }
}

function scenario(api: typeof RAPIER, variant: number) {
  const world = new api.World({ x: variant * 0.1, y: -9.81, z: 0 });
  try {
    world.numSolverIterations = 8;
    world.maxCcdSubsteps = 4;
    world.createCollider(api.ColliderDesc.cuboid(20, 0.1, 20).setFriction(0.45));
    const body = world.createRigidBody(
      api.RigidBodyDesc.dynamic()
        .setTranslation(0, 4, 0)
        .setCcdEnabled(true)
        .setLinearDamping(0.16),
    );
    world.createCollider(api.ColliderDesc.ball(0.12).setRestitution(0.6).setFriction(0.4), body);
    body.setLinvel({ x: variant * 2, y: 0, z: -variant }, true);
    const states = [];
    for (let frame = 0; frame < 180; frame++) {
      if (frame === 60) body.applyImpulse({ x: variant * 0.01, y: 0.02, z: 0 }, true);
      world.step();
      states.push({
        position: { ...body.translation() },
        velocity: { ...body.linvel() },
        rotation: { ...body.rotation() },
      });
    }
    return states;
  } finally {
    world.free();
  }
}

afterEach(() => vi.unstubAllGlobals());
describe("shared official Rapier source modules", () => {
  it("preserves the complete API and exact WASM results across 540 steps", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(wasm)),
    );
    const compiled = await compiledApi();
    await Promise.all([compiled.init(), RAPIER.init()]);
    expect(compiled.version()).toBe(RAPIER.version());
    expect(Object.keys(compiled.default).sort()).toEqual(Object.keys(RAPIER).sort());
    expect(Object.isFrozen(compiled.default)).toBe(true);
    for (const variant of [0, 1, 2])
      expect(scenario(compiled.default, variant)).toEqual(scenario(RAPIER, variant));
  });
  it("uses byte-identical content-addressed bindings for document and worker builds", async () => {
    const [document, worker] = await Promise.all([
      sharedRapierBindings(modulePath),
      sharedRapierBindings(modulePath),
    ]);
    expect(document.fileName).toMatch(/^rapier-bindings-[a-f0-9]{16}\.js$/);
    expect(document).toEqual(worker);
  });
  it("fails closed when the external WASM cannot be fetched", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 503 })),
    );
    const compiled = await compiledApi();
    await expect(compiled.init()).rejects.toThrow("Rapier WASM failed: 503");
  });
});
