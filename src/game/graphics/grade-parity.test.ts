import { expect, it } from "vitest";
import { applyRecipe, clearGradeLuts, gradeFor, gradeLut, LUT_SIZE } from "./grade";

it("preserves every LUT byte for all time, weather and match moments", () => {
  try {
    for (const time of ["dia", "entardecer", "noite"] as const) {
      for (const weather of ["limpo", "nublado", "chuva", "neve"] as const) {
        for (const moment of ["match", "replay", "drama"] as const) {
          const recipe = gradeFor(time, weather, moment);
          const data = gradeLut(time, weather, moment).image.data as Uint8Array;
          let index = 0;
          for (let z = 0; z < LUT_SIZE; z++) {
            for (let y = 0; y < LUT_SIZE; y++) {
              for (let x = 0; x < LUT_SIZE; x++) {
                const rgb = applyRecipe(
                  x / (LUT_SIZE - 1),
                  y / (LUT_SIZE - 1),
                  z / (LUT_SIZE - 1),
                  recipe,
                );
                for (const value of rgb) {
                  const expected = Math.round(Math.min(1, Math.max(0, value)) * 255);
                  if (data[index] !== expected)
                    throw new Error(
                      `${time}/${weather}/${moment} byte ${index}: ${data[index]} != ${expected}`,
                    );
                  index++;
                }
                if (data[index++] !== 255)
                  throw new Error(`Unexpected LUT alpha in ${time}/${weather}/${moment}`);
              }
            }
          }
        }
      }
    }
    expect(LUT_SIZE).toBeGreaterThan(1);
  } finally {
    clearGradeLuts();
  }
});
