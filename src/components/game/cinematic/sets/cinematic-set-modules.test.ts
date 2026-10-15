import { describe, expect, it } from "vitest";
import { BusArrival } from "./BusArrival";
import { LockerRoom } from "./LockerRoom";
import { Office } from "./Office";
import { PitchEntry } from "./PitchEntry";
import { PressRoom } from "./PressRoom";
import { Stands } from "./Stands";
import { Tunnel } from "./Tunnel";

describe("cinematic set modules", () => {
  it("exports every environment as a callable component", () => {
    const components = [LockerRoom, Tunnel, PressRoom, PitchEntry, Stands, Office, BusArrival];

    expect(components).toHaveLength(7);
    components.forEach((component) => expect(typeof component).toBe("function"));
  });
});
