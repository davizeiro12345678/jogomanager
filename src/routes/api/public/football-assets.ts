import { createFileRoute } from "@tanstack/react-router";
import { readOfficialAssets } from "@/lib/football-assets.server";
import {
  officialAssetsEdgeCache,
  serveOfficialAssets,
} from "@/lib/official-assets-response.server";

export const Route = createFileRoute("/api/public/football-assets")({
  server: {
    handlers: {
      GET: ({ request }) =>
        serveOfficialAssets(request, readOfficialAssets, officialAssetsEdgeCache()),
    },
  },
});
