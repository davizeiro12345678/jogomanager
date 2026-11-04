import { afterEach, describe, expect, it, vi } from "vitest";

class FakeLink extends EventTarget {
  rel = "stylesheet";
  href = "";
  sheet: object | null = null;
  removed = false;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  getAttribute(name: string) {
    return name === "href" ? this.href : null;
  }
  remove() {
    this.removed = true;
  }
  fire(type: "load" | "error") {
    this.dispatchEvent(new Event(type));
    this[`on${type}`]?.();
  }
}

function fakeDocument() {
  const links: FakeLink[] = [];
  return {
    links,
    readyState: "loading",
    querySelectorAll: () => links.filter((link) => !link.removed),
    createElement: () => new FakeLink(),
    head: { appendChild: (link: FakeLink) => links.push(link) },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("game stylesheet loading", () => {
  it("waits for an existing stylesheet that is still loading", async () => {
    const doc = fakeDocument();
    vi.stubGlobal("document", doc);
    const { ensureGameStylesheet } = await import("./game-stylesheet-loader");
    const { GAME_STYLESHEET_URL } = await import("./game-stylesheet");
    const existing = new FakeLink();
    existing.href = GAME_STYLESHEET_URL;
    doc.links.push(existing);
    let finished = false;
    const first = ensureGameStylesheet().then(() => {
      finished = true;
    });
    await Promise.resolve();
    expect(finished).toBe(false);
    expect(doc.links).toHaveLength(1);
    existing.sheet = {};
    existing.fire("load");
    await first;
    expect(finished).toBe(true);
  });

  it("does not block on a failed load and retries on the next request", async () => {
    const doc = fakeDocument();
    vi.stubGlobal("document", doc);
    const { ensureGameStylesheet } = await import("./game-stylesheet-loader");
    const first = ensureGameStylesheet();
    expect(ensureGameStylesheet()).toBe(first);
    doc.links[0]!.fire("error");
    await first;
    expect(doc.links[0]!.removed).toBe(true);
    const retry = ensureGameStylesheet();
    expect(doc.links).toHaveLength(2);
    doc.links[1]!.sheet = {};
    doc.links[1]!.fire("load");
    await retry;
  });

  it("immediately accepts an already loaded stylesheet", async () => {
    const doc = fakeDocument();
    vi.stubGlobal("document", doc);
    const { ensureGameStylesheet } = await import("./game-stylesheet-loader");
    const { GAME_STYLESHEET_URL } = await import("./game-stylesheet");
    const existing = new FakeLink();
    existing.href = GAME_STYLESHEET_URL;
    existing.sheet = {};
    doc.links.push(existing);
    await ensureGameStylesheet();
    expect(doc.links).toHaveLength(1);
  });

  it("retries a link that may have failed before listeners were attached", async () => {
    const doc = fakeDocument();
    doc.readyState = "complete";
    vi.stubGlobal("document", doc);
    const { ensureGameStylesheet } = await import("./game-stylesheet-loader");
    const { GAME_STYLESHEET_URL } = await import("./game-stylesheet");
    const existing = new FakeLink();
    existing.href = GAME_STYLESHEET_URL;
    doc.links.push(existing);
    const loading = ensureGameStylesheet();
    expect(existing.removed).toBe(true);
    expect(doc.links).toHaveLength(2);
    doc.links[1]!.sheet = {};
    doc.links[1]!.fire("load");
    await loading;
  });
});
