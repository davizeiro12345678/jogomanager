import { describe, expect, it } from "vitest";
import { cardForFoul } from "./sim-rules";

const challenge = {
  slide: true,
  tactical: false,
  goalDenied: true,
  rapSheet: 0,
  ref: { name: "Fixture", strict: 0.6 },
  rnd: () => 0.6,
  penaltyAwarded: true,
  attemptBall: true,
};

describe("DOGSO penalty ball challenges (IFAB Law 12)", () => {
  it.each([true, false])("cautions a nonviolent penalty ball challenge (slide=%s)", (slide) => {
    expect(cardForFoul({ ...challenge, slide })).toBe("yellow");
  });
  it("retains red for a serious foul even when a penalty is awarded", () => {
    expect(cardForFoul({ ...challenge, rnd: () => 0 })).toBe("red");
  });
  it("retains red for DOGSO outside the penalty area", () => {
    expect(cardForFoul({ ...challenge, penaltyAwarded: false })).toBe("red");
  });
  it("retains red for DOGSO with no attempt to play or challenge for the ball", () => {
    expect(cardForFoul({ ...challenge, attemptBall: false })).toBe("red");
  });
  it("sends off a standing DOGSO challenge outside the area regardless of the card roll", () => {
    expect(cardForFoul({ ...challenge, slide: false, penaltyAwarded: false, rnd: () => 0.9 })).toBe(
      "red",
    );
  });
});
