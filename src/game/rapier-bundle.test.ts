import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import RAPIER from "@dimforge/rapier3d-compat";
import { rolldown } from "rolldown";
import type { Plugin } from "vite";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  externalizeRapierWasm,
  isRapierCompatModule,
  rapierWasmAsset,
} from "../../scripts/rapier-wasm-asset";

const require = createRequire(import.meta.url);
const packageDir = path.dirname(require.resolve("@dimforge/rapier3d-compat"));
const source = readFileSync(path.join(packageDir, "rapier.mjs"), "utf8");
const wasm = readFileSync(path.join(packageDir, "rapier_wasm3d_bg.wasm"));
const assetUrl = "https://bundle.test/rapier.wasm";

async function adaptedApi(suffix: string) {
  const code = externalizeRapierWasm(source, wasm, JSON.stringify(assetUrl));
  return (await import(
    /* @vite-ignore */ `data:text/javascript;base64,${Buffer.from(code + `\n// ${suffix}`).toString("base64")}`
  )) as typeof import("@dimforge/rapier3d-compat");
}

async function treeShakenApi() {
  const adapted = externalizeRapierWasm(source, wasm, JSON.stringify(assetUrl));
  const bundle = await rolldown({
    input: "game-physics",
    plugins: [
      {
        name: "rapier-compiled-contract",
        resolveId(id) {
          if (id === "game-physics" || id === "rapier") return `\0${id}`;
          return null;
        },
        load(id) {
          if (id === "\0game-physics")
            return 'export {World,ColliderDesc,RigidBodyDesc,ActiveEvents,init} from "rapier";';
          if (id === "\0rapier") return adapted;
          return null;
        },
      },
    ],
  });
  try {
    const { output } = await bundle.generate({ format: "es", minify: true });
    const chunk = output.find((item) => item.type === "chunk");
    if (!chunk) throw new Error("Compiled Rapier contract has no JavaScript output");
    expect(chunk.code).not.toContain("AGFzbQE");
    return (await import(
      /* @vite-ignore */ `data:text/javascript;base64,${Buffer.from(chunk.code).toString("base64")}`
    )) as Pick<typeof RAPIER, "World" | "ColliderDesc" | "RigidBodyDesc" | "ActiveEvents" | "init">;
  } finally {
    await bundle.close();
  }
}

function runPhysics(api: Pick<typeof RAPIER, "World" | "ColliderDesc" | "RigidBodyDesc">) {
  const world = new api.World({ x: 0, y: -9.81, z: 0 });
  try {
    world.createCollider(api.ColliderDesc.cuboid(5, 0.1, 5));
    const body = world.createRigidBody(api.RigidBodyDesc.dynamic().setTranslation(0, 4, 0));
    world.createCollider(api.ColliderDesc.ball(0.2).setRestitution(0.6), body);
    const positions = [];
    for (let frame = 0; frame < 180; frame++) {
      world.step();
      positions.push({ position: body.translation(), velocity: body.linvel() });
    }
    return positions;
  } finally {
    world.free();
  }
}

afterEach(() => vi.unstubAllGlobals());

describe("Rapier browser bundles", () => {
  it("externalizes browser and worker environments without changing server initialization", () => {
    const apply = rapierWasmAsset().applyToEnvironment;
    type Environment = Parameters<NonNullable<Plugin["applyToEnvironment"]>>[0];
    const environment = (name: string, consumer: "client" | "server") =>
      ({ name, config: { consumer } }) as Environment;
    expect(apply?.(environment("client", "client"))).toBe(true);
    expect(apply?.(environment("worker", "client"))).toBe(true);
    expect(apply?.(environment("ssr", "server"))).toBe(false);
    expect(apply?.(environment("nitro", "server"))).toBe(false);
  });

  it("recognizes the current compat ESM entry without relying on a stale path layout", () => {
    expect(
      isRapierCompatModule(
        "C:\\workspace\\node_modules\\@dimforge\\rapier3d-compat\\dist\\rapier.mjs?worker_file&type=module",
      ),
    ).toBe(true);
    expect(
      isRapierCompatModule("/workspace/node_modules/@dimforge/rapier3d-compat/rapier.mjs"),
    ).toBe(true);
    expect(isRapierCompatModule("/workspace/node_modules/@dimforge/rapier3d/rapier.mjs")).toBe(
      false,
    );
  });

  it("keeps the official physics results with WASM loaded as an asset", async () => {
    const fetchAsset = vi.fn(async () => new Response(wasm, { status: 200 }));
    vi.stubGlobal("fetch", fetchAsset);
    const adapted = await adaptedApi("physics");
    await Promise.all([adapted.init(), RAPIER.init()]);
    expect(fetchAsset).toHaveBeenCalledWith(assetUrl);
    expect(adapted.version()).toBe(RAPIER.version());
    expect(Object.keys(adapted.default).sort()).toEqual(Object.keys(RAPIER).sort());
    expect(Object.isFrozen(adapted.default)).toBe(true);
    expect(runPhysics(adapted.default)).toEqual(runPhysics(RAPIER));
  });

  it("preserves all 180 physics steps after production tree shaking and minification", async () => {
    const fetchAsset = vi.fn(async () => new Response(wasm, { status: 200 }));
    vi.stubGlobal("fetch", fetchAsset);
    const compiled = await treeShakenApi();
    await Promise.all([compiled.init(), RAPIER.init()]);
    expect(fetchAsset).toHaveBeenCalledWith(assetUrl);
    expect(runPhysics(compiled)).toEqual(runPhysics(RAPIER));
  });

  it("propagates a failed asset load instead of initializing broken physics", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 503 })),
    );
    const adapted = await adaptedApi("failed");
    await expect(adapted.init()).rejects.toThrow("Rapier WASM failed: 503");
  });

  it("rejects a changed binary or init format during the build", () => {
    const changed = Buffer.from(wasm);
    changed[8] = changed[8]! ^ 1;
    expect(() => externalizeRapierWasm(source, changed, JSON.stringify(assetUrl))).toThrow(
      "Rapier WASM changed",
    );
    expect(() =>
      externalizeRapierWasm("export function init() {}", wasm, JSON.stringify(assetUrl)),
    ).toThrow("Rapier WASM changed");
    expect(() =>
      externalizeRapierWasm(
        source.replace("Object.freeze({__proto__:null", "Object.freeze({changed:null"),
        wasm,
        JSON.stringify(assetUrl),
      ),
    ).toThrow("Rapier namespace changed");
  });
});
