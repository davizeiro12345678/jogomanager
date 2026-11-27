import { describe, expect, it, vi } from "vitest";
import { createDormantResourcePool } from "./dormant-resource-pool";

function resource(bytes = 100) {
  return { value: { mutablePose: 0 }, estimatedBytes: bytes, dispose: vi.fn() };
}

describe("exclusive dormant render resources", () => {
  it("never shares an active mutable rig and reuses an idle lease", () => {
    const pool = createDormantResourcePool<string, { mutablePose: number }>();
    const first = resource();
    const second = resource();
    const a = pool.acquire("same-rig", () => first);
    const b = pool.acquire("same-rig", () => second);
    expect(a.value).not.toBe(b.value);
    a.value.mutablePose = 42;
    expect(b.value.mutablePose).toBe(0);
    a.release();
    a.release();
    const factory = vi.fn(() => resource());
    const c = pool.acquire("same-rig", factory);
    expect(c.value).toBe(first.value);
    expect(factory).not.toHaveBeenCalled();
    expect(pool.stats.activeLeases).toBe(2);
    b.release();
    c.release();
    pool.dispose();
    expect(first.dispose).toHaveBeenCalledTimes(1);
    expect(second.dispose).toHaveBeenCalledTimes(1);
  });

  it("evicts only idle resources in release order and obeys byte and entry caps", () => {
    const pool = createDormantResourcePool<string, object>({
      maxDormantEntries: 2,
      maxDormantBytes: 150,
    });
    const a = resource(100),
      b = resource(100),
      active = resource(100);
    const held = pool.acquire("active", () => active);
    pool.acquire("a", () => a).release();
    pool.acquire("b", () => b).release();
    expect(a.dispose).toHaveBeenCalledTimes(1);
    expect(b.dispose).not.toHaveBeenCalled();
    expect(active.dispose).not.toHaveBeenCalled();
    expect(pool.stats).toMatchObject({ dormantEntries: 1, dormantBytes: 100, activeLeases: 1 });
    pool.dispose();
    held.release();
    expect(active.dispose).toHaveBeenCalledTimes(1);
  });

  it("retains at most two idle promotion cycles", () => {
    const pool = createDormantResourcePool<string, object>();
    const item = resource();
    pool.acquire("rig", () => item).release();
    pool.advanceCycle();
    pool.advanceCycle();
    expect(item.dispose).not.toHaveBeenCalled();
    pool.advanceCycle();
    expect(item.dispose).toHaveBeenCalledTimes(1);
    expect(pool.stats.dormantBytes).toBe(0);
  });

  it("closes without destroying active resources and rejects new acquisitions", () => {
    const pool = createDormantResourcePool<string, object>();
    const item = resource();
    const lease = pool.acquire("rig", () => item);
    pool.dispose();
    pool.dispose();
    expect(item.dispose).not.toHaveBeenCalled();
    expect(() => pool.acquire("rig", () => resource())).toThrow(/closed/);
    lease.release();
    lease.release();
    expect(item.dispose).toHaveBeenCalledTimes(1);
    expect(pool.stats.activeLeases).toBe(0);
  });

  it("disposes oversized, invalid and zero-budget resources rather than retaining them", () => {
    for (const bytes of [NaN, Infinity, -1, 0.5]) {
      const pool = createDormantResourcePool<string, object>();
      const item = resource(bytes);
      expect(() => pool.acquire("rig", () => item)).toThrow(/size/);
      expect(item.dispose).toHaveBeenCalledTimes(1);
      expect(pool.stats.activeLeases).toBe(0);
    }
    const pool = createDormantResourcePool<string, object>({ maxDormantBytes: 50 });
    const large = resource(100);
    pool.acquire("rig", () => large).release();
    expect(large.dispose).toHaveBeenCalledTimes(1);
    const disabled = createDormantResourcePool<string, object>({ maxDormantEntries: 0 });
    const other = resource();
    disabled.acquire("rig", () => other).release();
    expect(other.dispose).toHaveBeenCalledTimes(1);
  });

  it("keeps cleanup idempotent when a disposer throws and preserves factory failure", () => {
    const errors = vi.fn();
    const pool = createDormantResourcePool<string, object>({ onDisposeError: errors });
    const item = resource();
    item.dispose.mockImplementation(() => {
      throw new Error("dispose");
    });
    pool.acquire("rig", () => item).release();
    pool.dispose();
    pool.dispose();
    expect(errors).toHaveBeenCalledTimes(1);
    const fresh = createDormantResourcePool<string, object>();
    expect(() =>
      fresh.acquire("rig", () => {
        throw new Error("factory");
      }),
    ).toThrow("factory");
    expect(fresh.stats.activeLeases).toBe(0);
  });
});
