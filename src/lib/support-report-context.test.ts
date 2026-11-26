import { describe, expect, it } from "vitest";
import { reportPrefill, reportRoomFromSearch } from "./support-report-context";

const room = "45fd1d08-4f81-44bc-9072-1e35ce9d1d94";

describe("multiplayer report context", () => {
  it("extracts only a valid room identifier", () => {
    expect(reportRoomFromSearch(`?reportRoom=${room}`)).toBe(room);
    expect(reportRoomFromSearch("?reportRoom=../../../private")).toBeNull();
    expect(reportRoomFromSearch("?reportRoom=%3Cscript%3E")).toBeNull();
    expect(reportRoomFromSearch("?irrelevant=true")).toBeNull();
  });

  it("fills a safe editable report without accusing an individual", () => {
    const prefill = reportPrefill(room);
    expect(prefill?.category).toBe("report");
    expect(prefill?.subject).toContain("multiplayer");
    expect(prefill?.message).toContain(room);
    expect(reportPrefill("../bad")).toBeNull();
  });
});
