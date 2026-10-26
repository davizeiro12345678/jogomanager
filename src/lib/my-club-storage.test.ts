import { afterEach, expect, it, vi } from "vitest";
import { readMyClub } from "./my-club-storage";

afterEach(() => vi.unstubAllGlobals());
function stored(raw: string) {
  vi.stubGlobal("window", { localStorage: { getItem: () => raw } });
}
it("reads only the display identity from an untrusted local club", () => {
  stored('{"id":"my-exemplo","name":"Exemplo","strength":100000}');
  expect(readMyClub()).toEqual({ id: "my-exemplo", name: "Exemplo" });
});
it.each([
  '{"id":"constructor","name":"Exemplo"}',
  '{"id":"my-exemplo","name":{}}',
  '{"id":"my-exemplo","name":"  "}',
  '{"id":"my-exemplo","name":"Exemplo","__proto__":{}}',
  "{",
])("rejects malformed or unsafe display identities: %s", (raw) => {
  stored(raw);
  expect(readMyClub()).toBeNull();
});
