import { createRoot } from "react-dom/client";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import PlayerStudio from "../src/components/game/players/PlayerStudio";
import { StudioShell } from "../src/components/game/cinematic/StudioShell";
import "../src/styles.css";

// The product's actual player renderer and controls, without authentication
// or a career save. Served alongside the existing graphics fixture.
const params = new URLSearchParams(location.search);
const inspection = params.has("movement")
  ? {
      movement: params.get("movement") ?? "idle",
      phase: Number(params.get("phase") ?? 0.45),
      framing: params.get("framing") ?? "body",
      angle: params.get("angle") ?? "threeQuarter",
    }
  : undefined;
const requestedPosition =
  params.get("position") ?? (inspection?.movement.startsWith("keeper") ? "GK" : "MF");
const position = ["GK", "DF", "MF", "FW"].includes(requestedPosition) ? requestedPosition : "MF";
export function PlayerStudioApp() {
  return (
    <StudioShell current="players">
      <PlayerStudio
        initialPosition={position}
        {...(inspection ? { initialInspection: inspection } : {})}
      />
    </StudioShell>
  );
}
const rootRoute = createRootRoute();
const studioRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/player-studio.html",
  component: PlayerStudioApp,
});
const router = createRouter({
  routeTree: rootRoute.addChildren([studioRoute]),
  history: createMemoryHistory({ initialEntries: ["/player-studio.html"] }),
});
createRoot(document.getElementById("root")!).render(<RouterProvider router={router} />);
