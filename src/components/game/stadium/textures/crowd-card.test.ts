import { afterEach, describe, expect, it, vi } from "vitest";
import { crowdCard } from "./crowd-card";

function canvasFixture() {
  const hands: number[][] = [];
  const tiles: number[][] = [];
  const gradient = { addColorStop: vi.fn() };
  const context = {
    beginPath() {},
    fill() {},
    fillRect() {},
    save() {},
    restore() {},
    rect() {},
    clip() {},
    moveTo() {},
    lineTo() {},
    quadraticCurveTo() {},
    closePath() {},
    stroke() {},
    translate(x: number, y: number) {
      tiles.push([x, y]);
    },
    ellipse(x: number, y: number, rx: number) {
      if (rx === 3.5) hands.push([x, y]);
    },
    createLinearGradient: () => gradient,
  };
  const canvas = { width: 0, height: 0, getContext: () => context };
  vi.stubGlobal("document", { createElement: () => canvas });
  return { canvas, hands, tiles };
}
afterEach(() => vi.unstubAllGlobals());
describe("animated crowd impostor atlas", () => {
  it("renders eight distinct phases per gesture into a bounded 512-square allocation", () => {
    const { canvas, hands, tiles } = canvasFixture();
    const texture = crowdCard(true);
    expect([canvas.width, canvas.height]).toEqual([512, 512]);
    expect(tiles).toHaveLength(32);
    expect(new Set(tiles.map((tile) => tile.join())).size).toBe(32);
    // Eight sampled phases include a mirrored recovery; hands actually move,
    // rather than duplicating a static drawing in every atlas column.
    for (let gesture = 0; gesture < 4; gesture++) {
      const left = hands.slice(gesture * 16, gesture * 16 + 16).filter((_, i) => i % 2 === 0);
      expect(new Set(left.map((hand) => hand.join())).size).toBeGreaterThanOrEqual(5);
      for (const [x, y] of left) {
        expect(x).toBeGreaterThanOrEqual(3.5);
        expect(x).toBeLessThanOrEqual(60.5);
        expect(y).toBeGreaterThanOrEqual(4);
        expect(y).toBeLessThanOrEqual(124);
      }
    }
    texture.dispose();
  });
  it("keeps the non-animated backend at its original allocation", () => {
    const { canvas, hands, tiles } = canvasFixture();
    const texture = crowdCard(false);
    expect([canvas.width, canvas.height]).toEqual([64, 128]);
    expect(tiles).toHaveLength(0);
    expect(hands).toHaveLength(2);
    texture.dispose();
  });
});
