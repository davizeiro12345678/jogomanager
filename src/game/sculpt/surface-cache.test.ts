import { describe, expect, it } from "vitest";
import { lookFor, proportionsFor } from "../player-model";
import { sculptedHair, sculptedHead } from "./head";

const look = lookFor("surface-cache-MF", "MF", true);
const proportions = proportionsFor(look);

function expectIndependentBuffers(
  first: ReturnType<typeof sculptedHead>,
  second: ReturnType<typeof sculptedHead>,
) {
  for (const name of ["position", "normal", "uv", "color"]) {
    const a = first.getAttribute(name);
    const b = second.getAttribute(name);
    expect(a.count).toBe(b.count);
    expect(a.array).not.toBe(b.array);
    expect(a.array).toEqual(b.array);
  }
  expect(first.getIndex()?.array).toEqual(second.getIndex()?.array);
  expect(first.getIndex()?.array).not.toBe(second.getIndex()?.array);
}

describe("bounded sculpt cache", () => {
  it("returns identical independent head geometry after disposal and caller mutation", () => {
    const first = sculptedHead(proportions, look.seed, true, true);
    const second = sculptedHead(proportions, look.seed, true, true);
    expect(first).not.toBe(second);
    expectIndependentBuffers(first, second);

    const originalX = second.getAttribute("position").getX(0);
    first.getAttribute("position").setX(0, originalX + 10);
    first.dispose();
    const third = sculptedHead(proportions, look.seed, true, true);
    expect(third.getAttribute("position").getX(0)).toBe(originalX);
    expectIndependentBuffers(second, third);

    second.dispose();
    third.dispose();
  });

  it("keeps hair color/style variants separate and returns independent geometry", () => {
    const first = sculptedHair(proportions, look, true);
    const second = sculptedHair(proportions, look, true);
    expectIndependentBuffers(first, second);
    const firstZ = second.getAttribute("position").getZ(0);
    first.getAttribute("position").setZ(0, firstZ + 10);
    first.dispose();
    const third = sculptedHair(proportions, look, true);
    expect(third.getAttribute("position").getZ(0)).toBe(firstZ);

    const alternateStyle = look.hairStyle === "afro" ? "short" : "afro";
    const otherStyle = sculptedHair(proportions, { ...look, hairStyle: alternateStyle }, true);
    expect(otherStyle.getAttribute("position").array).not.toEqual(
      third.getAttribute("position").array,
    );

    for (const geometry of [second, third, otherStyle]) geometry.dispose();
  });
});
