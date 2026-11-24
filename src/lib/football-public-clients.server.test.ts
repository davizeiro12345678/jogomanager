import { beforeEach, describe, expect, it, vi } from "vitest";

const configuration = vi.hoisted(() => ({
  get: vi.fn<
    () => { SUPABASE_URL: string | undefined; SUPABASE_PUBLISHABLE_KEY: string | undefined }
  >(),
}));
vi.mock("./football-public-env.server", () => ({ footballPublicEnvironment: configuration.get }));

import { publicClient } from "./football-public-db.server";
import { createFootballPublicClient } from "./football-public.server";

describe("football public clients", () => {
  beforeEach(() => configuration.get.mockReset());

  for (const create of [publicClient, createFootballPublicClient]) {
    it("accepts the resolved public Worker configuration", () => {
      configuration.get.mockReturnValue({
        SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture",
      });
      expect(() => create()).not.toThrow();
      expect(configuration.get).toHaveBeenCalledOnce();
    });

    it("fails closed when public configuration is missing", () => {
      configuration.get.mockReturnValue({
        SUPABASE_URL: undefined,
        SUPABASE_PUBLISHABLE_KEY: undefined,
      });
      expect(() => create()).toThrow("Os dados públicos de futebol estão indisponíveis.");
    });
  }
});
