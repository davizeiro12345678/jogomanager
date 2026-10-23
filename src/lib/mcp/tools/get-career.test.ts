import { beforeEach, describe, expect, it, vi } from "vitest";

const deps = vi.hoisted(() => ({ scoped: vi.fn(), read: vi.fn(), owner: vi.fn() }));
vi.mock("@lovable.dev/mcp-js", () => ({ defineTool: (definition: unknown) => definition }));
vi.mock("../supabase", () => ({ supabaseForUser: deps.scoped }));
import tool from "./get-career";

const call = tool.handler as unknown as (
  input: Record<string, never>,
  context: { isAuthenticated: () => boolean; getUserId: () => string },
) => Promise<{ content: Array<{ text: string }>; isError?: boolean; structuredContent?: unknown }>;
const context = { isAuthenticated: () => true, getUserId: () => "owner-fixture" };

beforeEach(() => {
  vi.resetAllMocks();
  const query = { select: () => query, eq: deps.owner, maybeSingle: deps.read };
  deps.owner.mockReturnValue(query);
  deps.scoped.mockReturnValue({ from: () => query });
});

describe("MCP career read boundary", () => {
  it.each([
    "permission denied for table private.careers",
    "provider detail contains personal-account@example.test and internal database host",
  ])("keeps database diagnostics out of a tool response: %s", async (message) => {
    deps.read.mockResolvedValue({ data: null, error: { message } });
    const result = await call({}, context);
    expect(result).toEqual({
      content: [{ type: "text", text: "Career data is unavailable right now. Try again later." }],
      isError: true,
    });
    expect(JSON.stringify(result)).not.toContain(message);
  });

  it("rejects unauthenticated reads before opening a database client", async () => {
    expect(await call({}, { ...context, isAuthenticated: () => false })).toMatchObject({
      isError: true,
    });
    expect(deps.scoped).not.toHaveBeenCalled();
  });

  it("returns the signed-in owner's career and timestamp with the existing response shape", async () => {
    const state = { clubId: "fixture-club", managerName: "Fixture manager" };
    deps.read.mockResolvedValue({
      data: { state, updated_at: "2026-10-20T19:00:00Z" },
      error: null,
    });
    const result = await call({}, context);
    expect(deps.scoped).toHaveBeenCalledWith(context);
    expect(deps.owner).toHaveBeenCalledWith("user_id", "owner-fixture");
    expect(result.structuredContent).toEqual({ state, updatedAt: "2026-10-20T19:00:00Z" });
    expect(JSON.parse(result.content[0]!.text)).toEqual(state);
    expect(result.isError).toBeUndefined();
  });

  it("preserves the existing empty-career result", async () => {
    deps.read.mockResolvedValue({ data: null, error: null });
    const result = await call({}, context);
    expect(result.content[0]!.text).toContain("No saved career");
    expect(result.isError).toBeUndefined();
  });
});
