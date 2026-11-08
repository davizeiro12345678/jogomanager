import { createFileRoute } from "@tanstack/react-router";
import { readOfficialAssets } from "@/lib/football-assets.server";

export const Route = createFileRoute("/api/public/football-assets")({
  server: {
    handlers: {
      GET: async () => Response.json(await readOfficialAssets()),
    },
  },
});
