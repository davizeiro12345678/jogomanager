import { describe, expect, it } from "vitest";
import { catalogImageUrl } from "./catalog-media";

describe("public catalog media", () => {
  it.each([
    "http://example.test/image.png",
    "javascript:alert(1)",
    "data:image/png;base64,a",
    "https://user:secret@example.test/x",
    null,
    undefined,
    "",
  ])("rejects unsafe image URL %s", (value) => {
    expect(catalogImageUrl(value)).toBeUndefined();
  });
  it("accepts public HTTPS provider images", () => {
    expect(catalogImageUrl("https://media.api-sports.io/football/teams/127.png")).toBe(
      "https://media.api-sports.io/football/teams/127.png",
    );
  });
});
