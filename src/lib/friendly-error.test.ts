import { describe, expect, it } from "vitest";
import { friendlyError } from "./friendly-error";

describe("friendlyError", () => {
  it("hides raw authorization errors behind a sign-in message", () => {
    expect(friendlyError(new Error("Unauthorized: No authorization header provided"), "x")).toBe(
      "Sua sessão expirou. Entre na sua conta e tente de novo.",
    );
  });
  it("explains network failures", () => {
    expect(friendlyError(new TypeError("Failed to fetch"), "x")).toMatch(/internet/);
  });
  it("uses the fallback for database errors", () => {
    expect(friendlyError(new Error('duplicate key violates constraint "a"'), "Tente de novo.")).toBe("Tente de novo.");
  });
  it("keeps short plain messages written for players", () => {
    expect(friendlyError(new Error("Cupom expirado."), "x")).toBe("Cupom expirado.");
  });
});
