import type { ReactNode } from "react";
import { ArrowLeft, Clapperboard, UserRound } from "lucide-react";
import { useT } from "@/i18n/provider";
import { I18nProvider } from "@/i18n/provider";
import { AccessibilityProvider } from "@/components/accessibility/AccessibilityProvider";
import "./studio.css";

export function StudioShell({
  current,
  children,
}: {
  current: "players" | "cinema";
  children: ReactNode;
}) {
  return (
    <I18nProvider
      pathname={current === "players" ? "/player-studio.html" : "/cinematic-studio.html"}
    >
      <AccessibilityProvider>
        <StudioChrome current={current}>{children}</StudioChrome>
      </AccessibilityProvider>
    </I18nProvider>
  );
}

function StudioChrome({
  current,
  children,
}: {
  current: "players" | "cinema";
  children: ReactNode;
}) {
  const { t, lang } = useT();
  return (
    <main className="studio-page">
      <div className="studio-shell">
        <nav className="studio-nav" aria-label={t("cinemaStudio.navigation")}>
          <span className="studio-brand">
            JOGOMANAGER <span className="text-primary">/</span> STUDIO
          </span>
          <a href={`/?lang=${lang}`} className="studio-back">
            <ArrowLeft size={15} aria-hidden="true" />
            {lang.startsWith("pt") ? "Voltar ao jogo" : "Back to game"}
          </a>
          <a
            href={`/player-studio.html?lang=${lang}`}
            aria-current={current === "players" ? "page" : undefined}
          >
            <UserRound size={15} />
            {t("cinemaStudio.players")}
          </a>
          <a
            href={`/cinematic-studio.html?lang=${lang}`}
            aria-current={current === "cinema" ? "page" : undefined}
          >
            <Clapperboard size={15} />
            {t("cinemaStudio.cinema")}
          </a>
        </nav>
        <h1 className="sr-only">
          {t(current === "players" ? "cinemaStudio.playerTitle" : "cinemaStudio.title")}
        </h1>
        {children}
      </div>
    </main>
  );
}
