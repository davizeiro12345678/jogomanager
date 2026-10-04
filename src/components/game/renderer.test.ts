import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("localStorage", new MemoryStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("WebGPU renderer capability gate", () => {
  it("only asks for a GPU adapter after the player opts in", async () => {
    const requestAdapter = vi.fn(async () => ({}));
    vi.stubGlobal("navigator", { gpu: { requestAdapter } });
    const renderer = await import("./renderer");

    expect(await renderer.detectWebGPU()).toBe(false);
    expect(requestAdapter).not.toHaveBeenCalled();

    renderer.setWebgpuEnabled(true);
    expect(await renderer.detectWebGPU()).toBe(true);
    expect(requestAdapter).toHaveBeenCalledOnce();
  });

  it("persists a device failure until the player explicitly retries", async () => {
    const renderer = await import("./renderer");
    renderer.setWebgpuEnabled(true);
    expect(renderer.webgpuEnabled()).toBe(true);

    renderer.markWebgpuFailed();
    expect(renderer.webgpuEnabled()).toBe(false);

    renderer.setWebgpuEnabled(true);
    expect(renderer.webgpuEnabled()).toBe(true);
  });

  it("treats denied browser storage as an unavailable opt-in, without crashing", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new DOMException("Blocked by browser privacy policy", "SecurityError");
      },
      setItem: () => {
        throw new DOMException("Blocked by browser privacy policy", "SecurityError");
      },
      removeItem: () => {
        throw new DOMException("Blocked by browser privacy policy", "SecurityError");
      },
    });
    const renderer = await import("./renderer");

    expect(renderer.webgpuEnabled()).toBe(false);
    expect(() => renderer.setWebgpuEnabled(true)).not.toThrow();
    expect(() => renderer.markWebgpuFailed()).not.toThrow();
  });

  it("does not call an internally WebGL2 WebGPURenderer native WebGPU", async () => {
    const renderer = await import("./renderer");

    expect(renderer.hasNativeWebGPUBackend({ backend: { isWebGPUBackend: true } })).toBe(true);
    expect(renderer.hasNativeWebGPUBackend({ backend: { isWebGLBackend: true } })).toBe(false);
    expect(renderer.hasNativeWebGPUBackend({})).toBe(false);
  });
});
