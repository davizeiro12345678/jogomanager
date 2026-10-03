import { beforeEach, describe, expect, it, vi } from "vitest";
import { recordAdMetric, selectAd } from "./ad-manager";

function storage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    clear: () => data.clear(),
    key: () => null,
    get length() {
      return data.size;
    },
  } satisfies Storage;
}

describe("ad manager", () => {
  beforeEach(() => {
    vi.stubGlobal("sessionStorage", storage());
    vi.stubGlobal("localStorage", storage());
    vi.stubGlobal("window", {});
  });

  it("caps the same campaign at three impressions per session", () => {
    const ad = selectAd("news", "feed");
    expect(ad).not.toBeNull();
    if (!ad) return;
    recordAdMetric(ad.id, "feed", "impression");
    recordAdMetric(ad.id, "feed", "impression");
    recordAdMetric(ad.id, "feed", "impression");
    expect(selectAd("news", "feed")?.id).not.toBe(ad.id);
  });

  it("applies a placement cooldown after dismissal", () => {
    const ad = selectAd("postmatch", "corner");
    expect(ad).not.toBeNull();
    if (!ad) return;
    recordAdMetric(ad.id, "corner", "dismiss");
    expect(selectAd("postmatch", "corner")).toBeNull();
  });
});
