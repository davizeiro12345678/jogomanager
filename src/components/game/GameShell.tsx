import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  BarChart3,
  Briefcase,
  Coins,
  Clapperboard,
  Dumbbell,
  FastForward,
  Gauge,
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
  UserRound,
  ChevronRight,
  Settings2,
} from "lucide-react";
import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";

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
import { useT } from "@/i18n/provider";
import { AccessibilitySettings } from "@/components/accessibility/AccessibilitySettings";
import { CommandPalette } from "./CommandPalette";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { Crest } from "./Crest";
import type { CareerState } from "@/game/types";
import { useActiveTimeTracking } from "@/features/activity/ActivityRanking";
import { useDrag } from "@use-gesture/react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { nextFixture } from "@/game/season";

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
  { to: "/perfil", key: "nav.profile", icon: UserRound, group: "Carreira" },
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
const MOBILE = ["/dashboard", "/squad", "/tactics", "/transfers"];

const NAV_GROUPS = ["Equipe", "Competição", "Mercado", "Clube", "Carreira", "Extras"];
const GROUP_KEYS: Record<string, string> = {
  Equipe: "group.team",
  Competição: "group.competition",
  Mercado: "group.market",
  Clube: "group.club",
  Carreira: "group.career",
  Extras: "group.extras",
};

export function GameShell({
  career,
  children,
}: {
  career: CareerState | null;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const pathname = useLocation({ select: (location) => location.pathname });
  const signedIn = useSignedIn();
  const { t, dir } = useT();
  const { sync } = useCareer();
  const shell = useRef<HTMLDivElement>(null);
  const header = useRef<HTMLElement>(null);
  const bottomNav = useRef<HTMLElement>(null);
  const menuTrigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    // Each career screen mounts its own shell after its lazy content loads.
    // Focusing here avoids announcing the outgoing page during navigation.
    const frame = requestAnimationFrame(() => {
      const heading = shell.current?.querySelector<HTMLElement>("#career-content h1");
      if (heading) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  const [menuOpen, setMenuOpen] = useState(false);
  // deslizar o menu para fora fecha (gesto natural no celular)
  const bindMenuSwipe = useDrag(
    ({ last, movement: [mx], velocity: [vx] }) => {
      const outward = dir === "rtl" ? mx : -mx;
      if (last && (outward > 70 || (outward > 20 && vx > 0.5))) setMenuOpen(false);
    },
    { axis: "x", filterTaps: true, pointer: { touch: true } },
  );
  const [menuQuery, setMenuQuery] = useState("");
  useEffect(() => {
    setMenuOpen(false);
    setMenuQuery("");
  }, [pathname]);
  useEffect(() => {
    const measure = () => {
      shell.current?.style.setProperty(
        "--career-header-height",
        `${header.current?.getBoundingClientRect().height ?? 0}px`,
      );
      shell.current?.style.setProperty(
        "--career-footer-height",
        `${bottomNav.current?.getBoundingClientRect().height ?? 0}px`,
      );
    };
    const observer = new ResizeObserver(measure);
    if (header.current) observer.observe(header.current);
    if (bottomNav.current) observer.observe(bottomNav.current);
    measure();
    return () => observer.disconnect();
  }, []);
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");
  useEffect(() => {
    try {
      if (localStorage.getItem("manager3d.career-density") === "compact") setDensity("compact");
    } catch {
      // The interface remains usable when browser storage is unavailable.
    }
  }, []);
  function changeDensity(value: "comfortable" | "compact") {
    setDensity(value);
    try {
      localStorage.setItem("manager3d.career-density", value);
    } catch {
      // Keep the preference for this session even without persistent storage.
    }
  }
  useServiceWorker();
  const club = career ? CLUBS[career.clubId] : undefined;
  const fixture = career ? nextFixture(career) : undefined;
  const current = TABS.find((tab) => tab.to === pathname);
  const searchText = (value: string) =>
    value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();
  const matchingTabs = TABS.filter((tab) =>
    searchText(`${t(tab.key)} ${tab.to}`).includes(searchText(menuQuery)),
  );
  useClubTheme(club);
  useActiveTimeTracking(career, signedIn);

  function navigationLinks(group: string, closeMenu = false) {
    return TABS.filter(
      (tab) =>
        tab.group === group &&
        tab.to !== "/dashboard" &&
        (!closeMenu || matchingTabs.includes(tab)),
    ).map((tab) => {
      const Icon = tab.icon;
      return (
        <Link
          key={tab.to}
          to={tab.to}
          onClick={() => closeMenu && setMenuOpen(false)}
          aria-current={pathname === tab.to ? "page" : undefined}
          className="career-nav-item"
        >
          <Icon size={17} aria-hidden="true" />
          <span>{t(tab.key)}</span>
          {pathname === tab.to && <ChevronRight size={14} aria-hidden="true" />}
        </Link>
      );
    });
  }

  const overview = (closeMenu = false) => (
    <Link
      to="/dashboard"
      onClick={() => closeMenu && setMenuOpen(false)}
      className="career-nav-item career-nav-overview"
      aria-current={pathname === "/dashboard" ? "page" : undefined}
    >
      <Gauge size={19} aria-hidden="true" />
      <span>{t("nav.panel")}</span>
    </Link>
  );

  return (
    <div
      ref={shell}
      className="game-shell career-shell min-h-[100dvh] bg-background text-foreground"
      data-density={density}
    >
      <OfflineBar />
      <a href="#career-content" className="career-skip">
        {t("common.skip")}
      </a>
      <header ref={header} className="game-shell-header career-header">
        <div className="career-header-inner">
          <button
            type="button"
            className="career-menu-trigger"
            aria-label={t("nav.openMenu")}
            aria-expanded={menuOpen}
            aria-controls="career-mobile-menu"
            onClick={(event) => {
              menuTrigger.current = event.currentTarget;
              setMenuOpen(true);
            }}
          >
            <Menu size={21} aria-hidden="true" />
          </button>
          <Link
            to="/dashboard"
            className="career-brand"
            aria-label={`${club?.name ?? "Manager 3D"} — painel`}
          >
            {club && <Crest club={club} size={37} />}
            <div className="min-w-0">
              <p className="truncate font-display text-sm sm:text-base">
                {club?.name ?? "Manager 3D"}
              </p>
              <p className="career-season">
                {career
                  ? `${t("shell.season")} ${career.season} · ${t("shell.round")} ${career.round}`
                  : t("shell.career")}
              </p>
            </div>
          </Link>
          <nav className="career-current-page" aria-label={t("nav.menu")}>
            <span>{t(GROUP_KEYS[current?.group ?? "Carreira"]!)}</span>
            <ChevronRight size={13} aria-hidden="true" />
            <strong>{current ? t(current.key) : "Manager 3D"}</strong>
          </nav>
          <div className="career-header-actions">
            <CommandPalette
              items={TABS.map((tab) => ({
                to: tab.to,
                label: t(tab.key),
                group: t(GROUP_KEYS[tab.group]!),
              }))}
            />
            <div className="hidden sm:block">
              <ShortcutsDialog />
            </div>
            <AccessibilitySettings className="career-icon-button" />
            <DropdownMenu>
              <DropdownMenuTrigger className="career-icon-button" aria-label={t("shell.account")}>
                <Settings2 size={19} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="career-preferences w-72">
                <p className="mb-3 text-sm font-semibold">Preferências e conta</p>
                <p className="text-xs text-muted-foreground" id="career-density-label">
                  {t("shell.density")}
                </p>
                <div className="career-density" role="group" aria-labelledby="career-density-label">
                  <button
                    type="button"
                    aria-pressed={density === "comfortable"}
                    onClick={() => changeDensity("comfortable")}
                  >
                    {t("shell.comfortable")}
                  </button>
                  <button
                    type="button"
                    aria-pressed={density === "compact"}
                    onClick={() => changeDensity("compact")}
                  >
                    {t("shell.compact")}
                  </button>
                </div>
                <div className="my-3">
                  <SyncBadge sync={sync} />
                </div>
                <DropdownMenuItem asChild>
                  <Link to="/visual">
                    <SlidersHorizontal size={16} />
                    {t("nav.visual")}
                  </Link>
                </DropdownMenuItem>
                {signedIn ? (
                  <DropdownMenuItem
                    onSelect={async () => {
                      await supabase.auth.signOut();
                      void navigate({ to: "/" });
                    }}
                  >
                    {t("action.signOut")}
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem asChild>
                    <Link to="/auth" search={{ next: pathname }}>
                      {t("action.saveCloud")}
                    </Link>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            {fixture && (
              <Link to="/match" className="career-primary-button career-header-play">
                <Play size={15} aria-hidden="true" />
                <span>{t("action.play")}</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="career-workspace">
        <aside className="career-sidebar" aria-label={t("nav.menu")}>
          <nav aria-label={t("nav.menu")}>
            {overview()}
            {NAV_GROUPS.filter((group) => group !== "Extras").map((group) => (
              <div key={group} className="career-nav-group">
                <h2 className="career-nav-heading">{t(GROUP_KEYS[group]!)}</h2>
                {navigationLinks(group)}
              </div>
            ))}
            <details className="career-nav-group" open={current?.group === "Extras" || undefined}>
              <summary className="career-nav-heading cursor-pointer">{t("group.extras")}</summary>
              {navigationLinks("Extras")}
            </details>
          </nav>
          <div className="career-sidebar-footer">
            <span className="career-manager-avatar">
              <UserRound size={18} />
            </span>
            <div>
              <p>{career?.managerName ?? "Seu treinador"}</p>
              <span>
                {career
                  ? `Meta: ${career.objective}º ou melhor`
                  : "Sua próxima conquista começa aqui"}
              </span>
            </div>
          </div>
        </aside>
        <div className="career-page">
          {signedIn === false && (
            <div className="career-save-note">
              <span>{t("shell.localSave")}</span>
              <Link to="/auth" search={{ next: pathname }}>
                {t("shell.cloudSave")} <ChevronRight size={13} />
              </Link>
            </div>
          )}
          <main id="career-content" tabIndex={-1} className="page-enter career-content">
            {children}
          </main>
        </div>
      </div>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent
          side={dir === "rtl" ? "right" : "left"}
          id="career-mobile-menu"
          className="career-menu-sheet"
          {...bindMenuSwipe()}
          style={{ touchAction: "pan-y" }}
          closeLabel={t("nav.closeMenu")}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            menuTrigger.current?.focus();
          }}
        >
          <SheetTitle className="pe-10 font-display">{t("nav.menu")}</SheetTitle>
          <SheetDescription>{t("nav.menuHint")}</SheetDescription>
          <input
            type="search"
            className="career-mobile-search"
            aria-label={t("nav.search")}
            placeholder={t("common.search")}
            value={menuQuery}
            onChange={(e) => setMenuQuery(e.target.value)}
          />
          <nav aria-label={t("nav.openMenu")} className="mt-5">
            {matchingTabs.some((tab) => tab.to === "/dashboard") ? overview(true) : null}
            {NAV_GROUPS.filter((group) =>
              matchingTabs.some((tab) => tab.group === group && tab.to !== "/dashboard"),
            ).map((group) => (
              <div key={group} className="career-nav-group">
                <h2 className="career-nav-heading">{t(GROUP_KEYS[group]!)}</h2>
                {navigationLinks(group, true)}
              </div>
            ))}
            {matchingTabs.length === 0 ? (
              <p className="career-menu-empty" role="status">
                {t("common.empty")}
              </p>
            ) : null}
          </nav>
        </SheetContent>
      </Sheet>
      <nav ref={bottomNav} aria-label={t("nav.mobile")} className="career-bottom-nav">
        {MOBILE.map((path) => {
          const tab = TABS.find((item) => item.to === path)!;
          const Icon = tab.icon;
          return (
            <Link key={path} to={path} aria-current={pathname === path ? "page" : undefined}>
              <Icon size={20} aria-hidden="true" />
              <span>{t(tab.key)}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={(event) => {
            menuTrigger.current = event.currentTarget;
            setMenuOpen(true);
          }}
          aria-label={t("nav.openMenu")}
          aria-expanded={menuOpen}
          aria-controls="career-mobile-menu"
        >
          <Menu size={20} />
          <span>{t("nav.mobileMenu")}</span>
        </button>
      </nav>
    </div>
  );
}
