import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  table: null as unknown,
  error: null as Error | null,
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: object) => ({ options }),
  notFound: () => new Error("not-found"),
  getRouteApi: () => ({ useLoaderData: () => ({ table: null, label: { name: "", country: "" } }) }),
  Link: () => null,
}));

vi.mock("@/lib/real-football.functions", () => ({
  getLeagueTable: async () => {
    if (state.error) throw state.error;
    return state.table;
  },
}));

// The route module only needs the page component to build its options.
vi.mock("@/pages/tabelas.$slug", () => ({ LeaguePage: () => null }));

type Loader = (context: { params: { slug: string } }) => Promise<{
  table: unknown;
  label: { name: string; country: string };
}>;

async function loader(): Promise<Loader> {
  const module = await import("./tabelas.$slug");
  const options = (module.Route as unknown as { options: { loader: Loader } }).options;
  return options.loader;
}

describe("tabelas/$slug loader", () => {
  beforeEach(() => {
    state.table = { season: 2027, groups: [[]] };
    state.error = null;
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("returns the league table and its label", async () => {
    const load = await loader();
    await expect(load({ params: { slug: "brasileirao-serie-a" } })).resolves.toMatchObject({
      table: { season: 2027 },
      label: { name: expect.stringContaining("Brasileir") },
    });
  });

  it("degrades to an unavailable table instead of failing the route", async () => {
    state.error = new Error("Missing Supabase environment variable(s)");
    const load = await loader();
    const result = await load({ params: { slug: "brasileirao-serie-a" } });
    expect(result.table).toBeNull();
    expect(result.label.name).toContain("Brasileir");
  });

  it("keeps unknown leagues out of the route", async () => {
    const load = await loader();
    await expect(load({ params: { slug: "liga-inexistente" } })).rejects.toThrow("not-found");
  });
});
