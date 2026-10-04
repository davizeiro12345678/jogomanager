import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import RAPIER from "@dimforge/rapier3d-compat";
import { afterEach, describe, expect, it, vi } from "vitest";
import { externalizeRapierWasm, isRapierCompatModule } from "../../scripts/rapier-wasm-asset";

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

afterEach(() => vi.unstubAllGlobals());

describe("Rapier worker bundle", () => {
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
    const run = (api: typeof RAPIER) => {
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
    };
    expect(run(adapted.default)).toEqual(run(RAPIER));
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
  });
});
