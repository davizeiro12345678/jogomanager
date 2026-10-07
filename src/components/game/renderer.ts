/**
 * Renderização WebGPU com volta automática para WebGL2.
 *
 * O grafo de cena continua o mesmo: quando o aparelho tem WebGPU, trocamos
 * apenas o renderizador (three.js `WebGPURenderer`), que aceita os mesmos
 * materiais padrão e ganha bastante em cenas com muito instancing — que é
 * exatamente o caso do estádio (torcida, fibras de grama, assentos).
 *
 * Se qualquer etapa falhar (navegador sem suporte, adaptador ocupado, driver
 * antigo), devolvemos `null` e o chamador segue com o caminho WebGL2 antigo.
 */

import { reportSilent } from "@/lib/silent-errors";

export type GpuBackend = "webgpu" | "webgl2";

const PREF_KEY = "manager3d.webgpu";
const FAIL_KEY = "manager3d.webgpu.failed";

function safeStorage(): Storage | null {
  try {
    return globalThis.localStorage;
  } catch {
    // Sandboxed iframes and privacy modes can expose the global but reject
    // every access with SecurityError. Rendering must still fall back safely.
    return null;
  }
}

function readStored(key: string): string | null {
  try {
    return safeStorage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string) {
  try {
    safeStorage()?.setItem(key, value);
  } catch {
    // Storage is only a player preference cache, never a rendering dependency.
  }
}

function removeStored(key: string) {
  try {
    safeStorage()?.removeItem(key);
  } catch {
    // Storage is only a player preference cache, never a rendering dependency.
  }
}

/**
 * WebGPU é experimental: fica desligado por padrão (o caminho WebGL2 é o
 * estável) e só liga quando o jogador marca a opção nas Configurações.
 * Se o driver falhar uma vez, gravamos o fracasso e nunca mais tentamos
 * nesta máquina até o jogador religar manualmente.
 */
export function webgpuEnabled(): boolean {
  if (readStored(FAIL_KEY) === "1") return false;
  return readStored(PREF_KEY) === "on";
}

export function setWebgpuEnabled(on: boolean) {
  writeStored(PREF_KEY, on ? "on" : "off");
  if (on) removeStored(FAIL_KEY);
}

/** Marca que o renderizador WebGPU falhou neste aparelho. */
export function markWebgpuFailed() {
  writeStored(FAIL_KEY, "1");
}

let cachedSupport: Promise<boolean> | null = null;

/** Detecta suporte real a WebGPU pedindo um adaptador de verdade (uma vez só). */
export function detectWebGPU(): Promise<boolean> {
  if (typeof navigator === "undefined") return Promise.resolve(false);
  if (!webgpuEnabled()) return Promise.resolve(false);
  if (cachedSupport) return cachedSupport;
  cachedSupport = (async () => {
    const gpu = navigator.gpu;
    if (!gpu) return false;
    try {
      const adapter = await gpu.requestAdapter();
      return Boolean(adapter);
    } catch (error) {
      reportSilent("graphics.renderer", error, {
        classification: "degradation",
        feature: "webgpu",
        phase: "adapter",
        dedupeKey: "webgpu-adapter",
      });
      return false;
    }
  })();
  return cachedSupport;
}

let extended = false;

type WebGPURendererInternals = {
  init: () => Promise<unknown>;
  backend?: { isWebGPUBackend?: boolean; device?: GPUDevice };
  dispose?: () => void | Promise<void>;
};

/** Three's WebGPURenderer may initialize a WebGL2 backend internally. */
export function hasNativeWebGPUBackend(renderer: unknown): boolean {
  return (renderer as WebGPURendererInternals | null)?.backend?.isWebGPUBackend === true;
}

async function disposeAfterFailedInit(renderer: WebGPURendererInternals | null) {
  try {
    await renderer?.dispose?.();
  } catch {
    // A partially initialized renderer must not prevent the WebGL2 recovery.
  }
}

/**
 * Fábrica de renderizador para o `<Canvas>` do react-three-fiber.
 * Devolve `null` quando WebGPU não está disponível — nesse caso o chamador
 * não deve passar `gl` como função e deixa o padrão WebGL2 assumir.
 */
export async function createWebGPURenderer(
  props: Record<string, unknown>,
  onDeviceError?: () => void,
): Promise<unknown | null> {
  if (!(await detectWebGPU())) return null;
  let renderer: WebGPURendererInternals | null = null;
  try {
    const [webgpu, fiber] = await Promise.all([
      import("three/webgpu"),
      import("@react-three/fiber"),
    ]);
    if (!extended) {
      // Disponibiliza os materiais/nós WebGPU como elementos JSX; as classes
      // de núcleo (geometrias, luzes, malhas) são as mesmas do three padrão.
      (fiber.extend as (catalogue: unknown) => void)(webgpu);
      extended = true;
    }
    const rendererInstance = new webgpu.WebGPURenderer({
      ...(props as ConstructorParameters<typeof webgpu.WebGPURenderer>[0]),
      forceWebGL: false,
    });
    const rendererInternals = rendererInstance as unknown as WebGPURendererInternals;
    renderer = rendererInternals;
    await rendererInstance.init();

    // WebGPURenderer silently offers its own WebGL2 fallback. Do not report
    // that renderer as native WebGPU: the scene needs the WebGL material path
    // and the surrounding Canvas will construct an ordinary WebGLRenderer.
    if (!hasNativeWebGPUBackend(rendererInstance)) {
      await disposeAfterFailedInit(rendererInternals);
      markWebgpuFailed();
      return null;
    }

    // Qualquer erro de validação do driver derruba o modo experimental na hora:
    // gravamos a falha e o chamador remonta o palco em WebGL2.
    const device = rendererInternals.backend?.device;
    if (device) {
      let tripped = false;
      const trip = () => {
        if (tripped) return;
        tripped = true;
        markWebgpuFailed();
        onDeviceError?.();
      };
      device.onuncapturederror = trip;
      void device.lost?.then(trip);
    }
    return rendererInstance;
  } catch (err) {
    // Do not retry a renderer that failed while compiling its first pipeline
    // on every route transition. The preference UI is the explicit retry.
    await disposeAfterFailedInit(renderer);
    markWebgpuFailed();
    console.warn("WebGPU indisponível, seguindo em WebGL2:", err);
    reportSilent("graphics.renderer", err, {
      classification: "degradation",
      feature: "webgpu",
      phase: "init",
      dedupeKey: "webgpu-init",
    });
    return null;
  }
}
