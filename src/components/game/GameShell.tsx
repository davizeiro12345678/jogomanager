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
import { useEffect, useState, type ComponentType, type ReactNode } from "react";

import { OfflineBar, SyncBadge, useServiceWorker } from "@/components/OfflineBar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { CLUBS } from "@/game/data/leagues";
import { useClubTheme } from "@/game/theme";
import { useCareer, useSignedIn } from "@/hooks/useCareer";
import { LANGS, LANG_NAMES, useT, type Lang } from "@/i18n";
import { CommandPalette } from "./CommandPalette";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { Crest } from "./Crest";
import type { CareerState } from "@/game/types";
import { useActiveTimeTracking } from "@/features/activity/ActivityRanking";
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
  const { t, lang, setLang } = useT();
  const { sync } = useCareer();
  const [menuOpen, setMenuOpen] = useState(false);
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
  useClubTheme(club);
  useActiveTimeTracking(career, signedIn);

  function navigationLinks(group: string, closeMenu = false) {
    return TABS.filter((tab) => tab.group === group && tab.to !== "/dashboard").map((tab) => {
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
      className="game-shell career-shell min-h-[100dvh] bg-background text-foreground"
      data-density={density}
    >
      <OfflineBar />
      <a href="#career-content" className="career-skip">
        Ir para o conteúdo
      </a>
      <header className="game-shell-header career-header">
        <div className="career-header-inner">
          <button
            type="button"
            className="career-menu-trigger"
            aria-label="Abrir menu da carreira"
            aria-expanded={menuOpen}
            aria-controls="career-mobile-menu"
            onClick={() => setMenuOpen(true)}
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
          <div className="career-current-page">
            <span>{current?.group ?? "Carreira"}</span>
            <ChevronRight size={13} />
            <strong>{current ? t(current.key) : "Manager 3D"}</strong>
          </div>
          <div className="career-header-actions">
            <CommandPalette
              items={TABS.map((tab) => ({ to: tab.to, label: t(tab.key), group: tab.group }))}
            />
            <div className="hidden sm:block">
              <ShortcutsDialog />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger className="career-icon-button" aria-label="Preferências e conta">
                <Settings2 size={19} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="career-preferences w-72">
                <p className="mb-3 text-sm font-semibold">Preferências e conta</p>
                <p className="text-xs text-muted-foreground" id="career-density-label">
                  Espaçamento da interface
                </p>
                <div className="career-density" role="group" aria-labelledby="career-density-label">
                  <button
                    type="button"
                    aria-pressed={density === "comfortable"}
                    onClick={() => changeDensity("comfortable")}
                  >
                    Confortável
                  </button>
                  <button
                    type="button"
                    aria-pressed={density === "compact"}
                    onClick={() => changeDensity("compact")}
                  >
                    Compacta
                  </button>
                </div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  {t("shell.language")}
                </label>
                <Select value={lang} onValueChange={(value) => setLang(value as Lang)}>
                  <SelectTrigger aria-label={t("shell.language")} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGS.map((l) => (
                      <SelectItem key={l} value={l}>
                        {LANG_NAMES[l]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
        <aside className="career-sidebar" aria-label="Menu da carreira">
          <nav aria-label="Navegação principal da carreira">
            {overview()}
            {NAV_GROUPS.filter((group) => group !== "Extras").map((group) => (
              <div key={group} className="career-nav-group">
                <p className="career-nav-heading">{group}</p>
                {navigationLinks(group)}
              </div>
            ))}
            <details className="career-nav-group" open={current?.group === "Extras" || undefined}>
              <summary className="career-nav-heading cursor-pointer">Mais recursos</summary>
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
              <span>Sua carreira é salva neste aparelho.</span>
              <Link to="/auth" search={{ next: pathname }}>
                Salvar na nuvem <ChevronRight size={13} />
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
          side="left"
          id="career-mobile-menu"
          className="career-menu-sheet"
          closeLabel="Fechar menu da carreira"
        >
          <SheetTitle className="pr-10 font-display">Menu da carreira</SheetTitle>
          <SheetDescription>Escolha o que você quer gerenciar.</SheetDescription>
          <nav aria-label="Todas as áreas da carreira" className="mt-5">
            {overview(true)}
            {NAV_GROUPS.map((group) => (
              <div key={group} className="career-nav-group">
                <p className="career-nav-heading">{group === "Extras" ? "Mais recursos" : group}</p>
                {navigationLinks(group, true)}
              </div>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
      <nav aria-label="Navegação principal no celular" className="career-bottom-nav">
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
          onClick={() => setMenuOpen(true)}
          aria-label="Abrir todas as áreas"
          aria-expanded={menuOpen}
          aria-controls="career-mobile-menu"
        >
          <Menu size={20} />
          <span>Menu</span>
        </button>
      </nav>
    </div>
  );
}
