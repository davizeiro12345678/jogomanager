import { createRoot } from "react-dom/client";
import PlayerStudio from "../src/components/game/players/PlayerStudio";
import { StudioShell } from "../src/components/game/cinematic/StudioShell";
import { I18nProvider } from "../src/i18n/provider";
import { AccessibilityProvider } from "../src/components/accessibility/AccessibilityProvider";
import "../src/styles.css";

// The product's actual player renderer and controls, without authentication
// or a career save. Served alongside the existing graphics fixture.
createRoot(document.getElementById("root")!).render(
  <I18nProvider>
    <AccessibilityProvider>
      <StudioShell current="players">
        <PlayerStudio />
      </StudioShell>
    </AccessibilityProvider>
  </I18nProvider>,
);
