import type { Camera, Object3D, Scene } from "three";

export interface ProgramRenderer {
  compileAsync?:
    ((object: Object3D, camera: Camera, targetScene?: Scene) => Promise<unknown>) | undefined;
}

export type ProgramPreparation = "ready" | "cancelled" | "unsupported";

export async function promoteScenePrograms(
  renderer: ProgramRenderer,
  object: Object3D,
  camera: Camera,
  signal: AbortSignal,
  targetScene: Scene,
): Promise<ProgramPreparation | "failed" | "timed-out"> {
  const lifetime = new AbortController();
  const cancel = () => lifetime.abort();
  signal.addEventListener("abort", cancel, { once: true });
  if (signal.aborted) cancel();
  let timedOut = false;
  const deadline = setTimeout(() => {
    timedOut = true;
    cancel();
  }, 2500);
  try {
    let status: ProgramPreparation | "failed" | "timed-out";
    try {
      status = await prepareScenePrograms(renderer, object, camera, lifetime.signal, targetScene);
    } catch {
      status = "failed";
    }
    if (signal.aborted) return "cancelled";
    if (timedOut) status = "timed-out";
    if (status !== "cancelled") object.visible = true;
    return status;
  } finally {
    clearTimeout(deadline);
    signal.removeEventListener("abort", cancel);
  }
}

interface Compilation {
  object: Object3D;
  camera: Camera;
  targetScene: Scene;
  consumers: number;
  result: Promise<ProgramPreparation>;
}

interface RendererGeneration {
  lifetime: AbortController;
  jobs: Set<Compilation>;
}

const generations = new WeakMap<ProgramRenderer, RendererGeneration>();

/** Context loss invalidates pending promotions, never resources owned by Canvas. */
export function invalidateScenePrograms(renderer: ProgramRenderer): void {
  generations.get(renderer)?.lifetime.abort();
  generations.delete(renderer);
}

export function prepareScenePrograms(
  renderer: ProgramRenderer,
  object: Object3D,
  camera: Camera,
  signal: AbortSignal,
  targetScene: Scene,
): Promise<ProgramPreparation> {
  if (signal.aborted) return Promise.resolve("cancelled");
  if (!renderer.compileAsync) return Promise.resolve("unsupported");
  let generation = generations.get(renderer);
  if (!generation) {
    generation = { lifetime: new AbortController(), jobs: new Set() };
    generations.set(renderer, generation);
  }
  const current = generation;
  let job = [...current.jobs].find(
    (entry) =>
      entry.object === object && entry.camera === camera && entry.targetScene === targetScene,
  );
  if (!job) {
    const compilation: Compilation = {
      object,
      camera,
      targetScene,
      consumers: 0,
      result: Promise.resolve("cancelled"),
    };
    // Give immediately cancelled/unmounted consumers a chance to withdraw before
    // submitting driver work. Three cannot cancel a submitted compilation.
    compilation.result = Promise.resolve()
      .then(async (): Promise<ProgramPreparation> => {
        if (current.lifetime.signal.aborted || compilation.consumers === 0) return "cancelled";
        await renderer.compileAsync!(object, camera, targetScene);
        return current.lifetime.signal.aborted ? "cancelled" : "ready";
      })
      .finally(() => current.jobs.delete(compilation));
    current.jobs.add(compilation);
    job = compilation;
  }
  const shared = job;
  shared.consumers++;
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      settled = true;
      shared.consumers--;
      signal.removeEventListener("abort", cancelled);
      current.lifetime.signal.removeEventListener("abort", cancelled);
    };
    const cancelled = () => {
      if (settled) return;
      cleanup();
      resolve("cancelled");
    };
    signal.addEventListener("abort", cancelled, { once: true });
    current.lifetime.signal.addEventListener("abort", cancelled, { once: true });
    shared.result.then(
      (status) => {
        if (settled) return;
        cleanup();
        resolve(signal.aborted || current.lifetime.signal.aborted ? "cancelled" : status);
      },
      (error: unknown) => {
        if (settled) return;
        cleanup();
        reject(error);
      },
    );
  });
}
