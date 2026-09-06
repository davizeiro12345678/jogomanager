import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  BarChart3,
  Briefcase,
  Coins,
  Clapperboard,
  Dumbbell,
  FastForward,
  Gauge,
  Globe,
  History,
  Home,
  LayoutGrid,
  Medal,
  MessagesSquare,
  Newspaper,
  Play,
  Search,
  ShoppingBag,
  Sparkles,
  Table2,
  Trophy,
  Users,
  Wrench,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import { CLUBS } from "@/game/data/leagues";
import { useClubTheme } from "@/game/theme";
import { useSignedIn } from "@/hooks/useCareer";
import { LANGS, LANG_NAMES, useT, type Lang } from "@/i18n";
import { Crest } from "./Crest";
import type { CareerState } from "@/game/types";

const TABS: { to: string; key: string; icon: ComponentType<{ size?: number }> }[] = [
  { to: "/dashboard", key: "nav.panel", icon: Gauge },
  { to: "/club", key: "nav.central", icon: Home },
  { to: "/squad", key: "nav.squad", icon: Users },
  { to: "/tactics", key: "nav.tactics", icon: LayoutGrid },
  { to: "/training", key: "nav.training", icon: Dumbbell },
  { to: "/league", key: "nav.league", icon: Table2 },
  { to: "/cup", key: "nav.cups", icon: Trophy },
  { to: "/transfers", key: "nav.market", icon: ArrowLeftRight },
  { to: "/scouting", key: "nav.scouting", icon: Search },
  { to: "/finances", key: "nav.finances", icon: Coins },
  { to: "/board", key: "nav.board", icon: Briefcase },
  { to: "/stats", key: "nav.stats", icon: BarChart3 },
  { to: "/news", key: "nav.news", icon: Newspaper },
  { to: "/history", key: "nav.history", icon: History },
  { to: "/carreira", key: "nav.coach", icon: Clapperboard },
  { to: "/temporada-automatica", key: "nav.auto", icon: FastForward },
  { to: "/conquistas", key: "nav.awards", icon: Medal },
  { to: "/assistente", key: "nav.ai", icon: Sparkles },
  { to: "/editor", key: "nav.editor", icon: Wrench },
  { to: "/chat", key: "nav.chat", icon: MessagesSquare },
  { to: "/loja", key: "nav.store", icon: ShoppingBag },
];

/** Atalhos mostrados na barra inferior do celular. */
const MOBILE = ["/dashboard", "/squad", "/tactics", "/league", "/transfers"];

export function GameShell({
  career,
  children,
}: {
  career: CareerState | null;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const signedIn = useSignedIn();
  const { t, lang, setLang } = useT();
  const club = career ? CLUBS[career.clubId] : undefined;
  useClubTheme(club);

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-0 h-64 opacity-70"
        style={{
          background:
            "radial-gradient(70% 100% at 50% 0%, var(--club-glow, transparent), transparent 70%)",
        }}
      />
      <header className="sticky top-0 z-30 border-b border-border/60 bg-card/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 lg:flex-row lg:items-center lg:gap-4">
          <div className="flex items-center gap-3">
            {club ? <Crest club={club} size={36} /> : null}
            <div className="leading-tight">
              <p className="font-display text-lg tracking-wide">{club?.name ?? "Manager 3D"}</p>
              {career ? (
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-muted-foreground">
                    {t("shell.season")} {career.season}
                  </span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-muted-foreground">
                    {t("shell.round")} {career.round}
                  </span>
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-primary">
                    €{career.finances.budget.toFixed(1)}M
                  </span>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">{t("shell.career")}</p>
              )}
            </div>
            <Link
              to="/match"
              className="ml-auto flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 font-display text-xs uppercase tracking-wider text-primary-foreground lg:hidden"
            >
              <Play size={13} /> {t("action.play")}
            </Link>
          </div>

          <nav className="-mx-1 hidden flex-wrap items-center justify-end gap-0.5 md:flex lg:mx-0 lg:ml-auto">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.to}
                  to={tab.to}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-display text-xs uppercase tracking-wider text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground [&.active]:bg-primary/15 [&.active]:text-primary"
                >
                  <Icon size={13} />
                  {t(tab.key)}
                </Link>
              );
            })}
            <Link
              to="/match"
              className="ml-1 hidden shrink-0 items-center gap-1 rounded-lg bg-primary px-3 py-1.5 font-display text-xs uppercase tracking-wider text-primary-foreground lg:flex"
            >
              <Play size={13} /> {t("action.play")}
            </Link>
            <label className="ml-1 flex shrink-0 items-center gap-1 rounded-md px-2 py-1.5 text-muted-foreground">
              <Globe size={13} />
              <span className="sr-only">{t("shell.language")}</span>
              <select
                aria-label={t("shell.language")}
                value={lang}
                onChange={(e) => setLang(e.target.value as Lang)}
                className="max-w-[7.5rem] cursor-pointer bg-transparent text-xs outline-none [&>option]:bg-card [&>option]:text-foreground"
              >
                {LANGS.map((l) => (
                  <option key={l} value={l}>
                    {LANG_NAMES[l]}
                  </option>
                ))}
              </select>
            </label>
            {signedIn ? (
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  navigate({ to: "/" });
                }}
                className="ml-2 shrink-0 rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                {t("action.signOut")}
              </button>
            ) : (
              <Link
                to="/auth"
                className="ml-2 shrink-0 rounded-md border border-primary/50 px-3 py-1.5 text-xs text-primary hover:bg-primary/10"
              >
                {t("action.saveCloud")}
              </Link>
            )}
          </nav>

          {/* Navegação secundária rolável no celular */}
          <nav className="-mx-1 flex gap-1 overflow-x-auto pb-1 md:hidden">
            {TABS.filter((tab) => !MOBILE.includes(tab.to)).map((tab) => (
              <Link
                key={tab.to}
                to={tab.to}
                className="shrink-0 rounded-lg bg-secondary/60 px-3 py-1.5 font-display text-[11px] uppercase tracking-wider text-muted-foreground [&.active]:bg-primary/15 [&.active]:text-primary"
              >
                {t(tab.key)}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {signedIn === false && (
        <div className="border-b border-border/50 bg-secondary/40">
          <p className="mx-auto max-w-6xl px-4 py-2 text-xs text-muted-foreground">
            {t("guest.line1")}{" "}
            <Link to="/auth" className="text-primary underline underline-offset-2">
              {t("guest.cta")}
            </Link>{" "}
            {t("guest.line2")}
          </p>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 py-6 pb-24 md:pb-6">{children}</main>

      {/* Barra inferior do celular */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border/60 bg-card/95 backdrop-blur-xl md:hidden">
        {TABS.filter((tab) => MOBILE.includes(tab.to)).map((tab) => {
          const Icon = tab.icon;
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] uppercase tracking-wider text-muted-foreground [&.active]:text-primary"
            >
              <Icon size={17} />
              {t(tab.key)}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
