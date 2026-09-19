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
  Menu,
  MessagesSquare,
  Newspaper,
  Play,
  Receipt,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Swords,
  Table2,
  Trophy,
  Users,
  Wrench,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";

import { OfflineBar, SyncBadge, useServiceWorker } from "@/components/OfflineBar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { CLUBS } from "@/game/data/leagues";
import { useClubTheme } from "@/game/theme";
import { useCareer, useSignedIn } from "@/hooks/useCareer";
import { LANGS, LANG_NAMES, useT, type Lang } from "@/i18n";
import { CommandPalette } from "./CommandPalette";
import { Crest } from "./Crest";
import type { CareerState } from "@/game/types";

const TABS: {
  to: string;
  key: string;
  icon: ComponentType<{ size?: number }>;
  group: string;
}[] = [
  { to: "/dashboard", key: "nav.panel", icon: Gauge, group: "Clube" },
  { to: "/club", key: "nav.central", icon: Home, group: "Clube" },
  { to: "/squad", key: "nav.squad", icon: Users, group: "Equipe" },
  { to: "/tactics", key: "nav.tactics", icon: LayoutGrid, group: "Equipe" },
  { to: "/training", key: "nav.training", icon: Dumbbell, group: "Equipe" },
  { to: "/league", key: "nav.league", icon: Table2, group: "Competição" },
  { to: "/cup", key: "nav.cups", icon: Trophy, group: "Competição" },
  { to: "/transfers", key: "nav.market", icon: ArrowLeftRight, group: "Mercado" },
  { to: "/scouting", key: "nav.scouting", icon: Search, group: "Mercado" },
  { to: "/finances", key: "nav.finances", icon: Coins, group: "Clube" },
  { to: "/board", key: "nav.board", icon: Briefcase, group: "Clube" },
  { to: "/stats", key: "nav.stats", icon: BarChart3, group: "Competição" },
  { to: "/news", key: "nav.news", icon: Newspaper, group: "Competição" },
  { to: "/history", key: "nav.history", icon: History, group: "Competição" },
  { to: "/carreira", key: "nav.coach", icon: Clapperboard, group: "Carreira" },
  { to: "/temporada-automatica", key: "nav.auto", icon: FastForward, group: "Carreira" },
  { to: "/conquistas", key: "nav.awards", icon: Medal, group: "Carreira" },
  { to: "/assistente", key: "nav.ai", icon: Sparkles, group: "Extras" },
  { to: "/editor", key: "nav.editor", icon: Wrench, group: "Extras" },
  { to: "/chat", key: "nav.chat", icon: MessagesSquare, group: "Extras" },
  { to: "/loja", key: "nav.store", icon: ShoppingBag, group: "Extras" },
  { to: "/compras", key: "nav.purchases", icon: Receipt, group: "Extras" },
  { to: "/multiplayer", key: "nav.versus", icon: Swords, group: "Extras" },
  { to: "/replays", key: "nav.replays", icon: Clapperboard, group: "Extras" },
  { to: "/visual", key: "nav.visual", icon: SlidersHorizontal, group: "Extras" },
];

/** Atalhos mostrados na barra inferior do celular. */
const MOBILE = ["/dashboard", "/squad", "/tactics", "/league", "/transfers"];

/** Abas sempre visíveis no topo; o resto vive no menu "Mais". */
const PRIMARY = ["/dashboard", "/squad", "/tactics", "/league", "/transfers", "/finances"];

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
  const { sync } = useCareer();
  useServiceWorker();
  const club = career ? CLUBS[career.clubId] : undefined;
  useClubTheme(club);

  const primary = TABS.filter((tab) => PRIMARY.includes(tab.to));
  const rest = TABS.filter((tab) => !PRIMARY.includes(tab.to));
  const groups = Array.from(new Set(rest.map((tab) => tab.group)));

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <OfflineBar />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-0 h-64 opacity-70"
        style={{
          background:
            "radial-gradient(70% 100% at 50% 0%, var(--club-glow, transparent), transparent 70%)",
        }}
      />
      <header className="sticky top-0 z-30 border-b border-border/60 bg-card/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
          {/* Identidade do clube */}
          <div className="flex min-w-0 items-center gap-2.5">
            {club ? <Crest club={club} size={34} /> : null}
            <div className="min-w-0 leading-tight">
              <p className="truncate font-display text-base tracking-wide">
                {club?.name ?? "Manager 3D"}
              </p>
              {career ? (
                <p className="hud-num truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t("shell.season")} {career.season} · {t("shell.round")} {career.round} ·{" "}
                  <span className="text-primary">€{career.finances.budget.toFixed(1)}M</span>
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground">{t("shell.career")}</p>
              )}
            </div>
          </div>

          {/* Navegação principal */}
          <nav aria-label="Navegação principal da carreira" className="ml-auto hidden items-center gap-0.5 md:flex">
            {primary.map((tab) => {
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.to}
                  to={tab.to}
                  className="flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-lg px-2.5 font-display text-xs uppercase tracking-wider text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground [&.active]:bg-primary/15 [&.active]:text-primary"
                >
                  <Icon size={13} />
                  {t(tab.key)}
                </Link>
              );
            })}

            <DropdownMenu>
              <DropdownMenuTrigger className="flex min-h-[38px] items-center gap-1.5 rounded-lg px-2.5 font-display text-xs uppercase tracking-wider text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
                <Menu size={13} />
                {t("shell.more")}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[30rem] p-3">
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  {groups.map((g) => (
                    <div key={g}>
                      <p className="mb-1 px-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {g}
                      </p>
                      {rest
                        .filter((tab) => tab.group === g)
                        .map((tab) => {
                          const Icon = tab.icon;
                          return (
                            <DropdownMenuItem key={tab.to} asChild>
                              <Link
                                to={tab.to}
                                className="flex min-h-[36px] cursor-pointer items-center gap-2 text-xs"
                              >
                                <Icon size={14} />
                                {t(tab.key)}
                              </Link>
                            </DropdownMenuItem>
                          );
                        })}
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/60 pt-3">
                  <label className="flex items-center gap-1.5 text-muted-foreground">
                    <Globe size={14} />
                    <span className="sr-only">{t("shell.language")}</span>
                    <select
                      aria-label={t("shell.language")}
                      value={lang}
                      onChange={(e) => setLang(e.target.value as Lang)}
                      className="cursor-pointer bg-transparent text-xs outline-none [&>option]:bg-card [&>option]:text-foreground"
                    >
                      {LANGS.map((l) => (
                        <option key={l} value={l}>
                          {LANG_NAMES[l]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <SyncBadge sync={sync} />
                  {signedIn ? (
                    <button
                      onClick={async () => {
                        await supabase.auth.signOut();
                        navigate({ to: "/" });
                      }}
                      className="shrink-0 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {t("action.signOut")}
                    </button>
                  ) : (
                    <Link
                      to="/auth"
                      className="shrink-0 rounded-md border border-primary/50 px-2.5 py-1.5 text-xs text-primary hover:bg-primary/10"
                    >
                      {t("action.saveCloud")}
                    </Link>
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>

          {/* Ações */}
          <div className="ml-auto flex shrink-0 items-center gap-1 md:ml-2">
            {signedIn === false ? (
              <Link
                to="/auth"
                search={{ next: "/dashboard" }}
                className="hidden min-h-[38px] items-center rounded-lg border border-primary/50 px-3 font-display text-xs uppercase text-primary sm:inline-flex"
              >
                Salvar carreira
              </Link>
            ) : null}
            <div className="hidden lg:block">
              <CommandPalette
                items={TABS.map((tab) => ({ to: tab.to, label: t(tab.key), group: tab.group }))}
              />
            </div>
            <Link
              to="/match"
              className="flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 font-display text-xs uppercase tracking-wider text-primary-foreground transition-transform hover:scale-[1.03]"
            >
              <Play size={13} /> {t("action.play")}
            </Link>
          </div>
        </div>

        {/* Navegação secundária rolável no celular */}
        <nav aria-label="Mais áreas da carreira" className="flex gap-1 overflow-x-auto px-4 pb-2 md:hidden">
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
      </header>

      {signedIn === false && (
        <div className="border-b border-border/50 bg-secondary/40">
          <p className="mx-auto max-w-6xl px-4 py-2 text-xs text-muted-foreground">
            {t("guest.line1")}{" "}
            <Link to="/auth" search={{ next: "/dashboard" }} className="text-primary underline underline-offset-2">
              {t("guest.cta")}
            </Link>{" "}
            {t("guest.line2")}
          </p>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 py-6 pb-24 md:pb-6">{children}</main>

      {/* Barra inferior do celular */}
      <nav aria-label="Navegação principal no celular" className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border/60 bg-card/95 backdrop-blur-xl md:hidden">
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
