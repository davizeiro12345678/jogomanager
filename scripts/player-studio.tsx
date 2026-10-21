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
import { I18nProvider } from "../src/i18n/provider";
import { AccessibilityProvider } from "../src/components/accessibility/AccessibilityProvider";
import "../src/styles.css";

// The product's actual player renderer and controls, without authentication
// or a career save. Served alongside the existing graphics fixture.
export function PlayerStudioApp() {
  return (
    <I18nProvider>
      <AccessibilityProvider>
        <StudioShell current="players">
          <PlayerStudio />
        </StudioShell>
      </AccessibilityProvider>
    </I18nProvider>
  );
}

// The production translation provider observes the active route. A memory
// router supplies that contract without importing application routes, auth,
// server functions or career state into the isolated renderer fixture.
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
