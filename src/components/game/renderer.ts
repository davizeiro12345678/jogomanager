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

export type GpuBackend = "webgpu" | "webgl2";

const PREF_KEY = "manager3d.webgpu";
const FAIL_KEY = "manager3d.webgpu.failed";

/**
 * WebGPU é experimental: fica desligado por padrão (o caminho WebGL2 é o
 * estável) e só liga quando o jogador marca a opção nas Configurações.
 * Se o driver falhar uma vez, gravamos o fracasso e nunca mais tentamos
 * nesta máquina até o jogador religar manualmente.
 */
export function webgpuEnabled(): boolean {
  if (typeof localStorage === "undefined") return false;
  if (localStorage.getItem(FAIL_KEY) === "1") return false;
  return localStorage.getItem(PREF_KEY) === "on";
}

export function setWebgpuEnabled(on: boolean) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(PREF_KEY, on ? "on" : "off");
  if (on) localStorage.removeItem(FAIL_KEY);
}

/** Marca que o renderizador WebGPU falhou neste aparelho. */
export function markWebgpuFailed() {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(FAIL_KEY, "1");
}

let cachedSupport: Promise<boolean> | null = null;

/** Detecta suporte real a WebGPU pedindo um adaptador de verdade (uma vez só). */
export function detectWebGPU(): Promise<boolean> {
  if (typeof navigator === "undefined") return Promise.resolve(false);
  if (!webgpuEnabled()) return Promise.resolve(false);
  if (cachedSupport) return cachedSupport;
  cachedSupport = (async () => {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
    if (!gpu) return false;
    try {
      const adapter = await gpu.requestAdapter();
      return Boolean(adapter);
    } catch {
      return false;
    }
  })();
  return cachedSupport;
}

let extended = false;

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
    const renderer = new webgpu.WebGPURenderer({
      ...(props as ConstructorParameters<typeof webgpu.WebGPURenderer>[0]),
      forceWebGL: false,
    });
    await renderer.init();

    // Qualquer erro de validação do driver derruba o modo experimental na hora:
    // gravamos a falha e o chamador remonta o palco em WebGL2.
    const device = (renderer as unknown as { backend?: { device?: GPUDeviceLike } }).backend
      ?.device;
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
    return renderer;
  } catch (err) {
    console.warn("WebGPU indisponível, seguindo em WebGL2:", err);
    return null;
  }
}

/** Superfície mínima do dispositivo WebGPU que usamos (evita depender dos tipos globais). */
interface GPUDeviceLike {
  onuncapturederror: ((ev: unknown) => void) | null;
  lost?: Promise<unknown>;
}
