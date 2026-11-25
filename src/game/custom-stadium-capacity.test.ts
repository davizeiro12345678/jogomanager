import { afterEach, expect, it } from "vitest";
import { initCareer } from "./career";
import { clearClubStyle, setClubStyle } from "./customStyle";
import { applyStadiumUpgrade } from "./coin-services";

afterEach(() => clearClubStyle("fla"));

it.each([8000, 42000, 90000])(
  "starts at the selected custom stadium capacity of %i seats",
  (capacity) => {
    setClubStyle("fla", {
      stadium: { name: "Arena QA", capacity, roof: "parcial", seatColor: "#333333" },
    });
    const career = initCareer("bra", "fla", "Capacity QA");
    expect(career.capacity).toBe(capacity);
    expect(applyStadiumUpgrade(career).capacity).toBe(Math.round(capacity * 1.05));
  },
);

it.each([NaN, -1, 1e9])("ignores out-of-contract custom stadium capacity %s", (capacity) => {
  const original = initCareer("bra", "fla", "Capacity QA").capacity;
  setClubStyle("fla", {
    stadium: { name: "Arena QA", capacity, roof: "parcial", seatColor: "#333333" },
  });
  expect(initCareer("bra", "fla", "Capacity QA").capacity).toBe(original);
});
