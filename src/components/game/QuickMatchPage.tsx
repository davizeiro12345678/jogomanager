import { Link } from "@tanstack/react-router";
import { Shuffle } from "lucide-react";
import { lazy, Suspense, useId, useMemo, useRef, useState } from "react";

import AccessibilitySettings from "@/components/accessibility/AccessibilitySettings";
import { Crest } from "@/components/game/Crest";
import { Flag } from "@/components/game/Flag";
import { MatchLoading } from "@/components/game/MatchLoading";
import type { Club, League } from "@/game/types";
import type { Difficulty } from "@/game/quickMatch";
import { loadQuickLive } from "@/game/quick-match-entry";
import {
  DEFAULT_QUICK_MATCH_LEAGUE,
  preloadQuickMatchCatalog,
  QUICK_MATCH_LEAGUE_DIRECTORY,
  type QuickMatchLeagueSummary,
} from "@/game/quick-match-catalog";
import { useT } from "@/i18n/provider";
import { existingCareerAnalyticsId } from "@/lib/career-analytics-id";

const QuickLive = lazy(loadQuickLive);
const preloadQuickLive = () => loadQuickLive().catch(() => undefined);
const DIFFS: Difficulty[] = ["facil", "normal", "dificil"];

export function QuickMatchPage() {
  const { t, lang } = useT();
  const [leagueId, setLeagueId] = useState(DEFAULT_QUICK_MATCH_LEAGUE.id);
  const [league, setLeague] = useState<League>(DEFAULT_QUICK_MATCH_LEAGUE);
  const [myClub, setMyClub] = useState(DEFAULT_QUICK_MATCH_LEAGUE.clubs[0]!.id);
  const [oppClub, setOppClub] = useState(DEFAULT_QUICK_MATCH_LEAGUE.clubs[1]!.id);
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [started, setStarted] = useState(false);
  const [seed, setSeed] = useState(() => `quick-${Date.now()}`);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState(false);
  const catalogRequest = useRef(0);
  // Directory identities are immutable. Difficulty/club selection must not
  // rebuild and sort every league option or recreate ICU's collator.
  const leagueGroups = useMemo(() => {
    const countryCompare = new Intl.Collator(lang).compare;
    const groups = QUICK_MATCH_LEAGUE_DIRECTORY.reduce<Record<string, QuickMatchLeagueSummary[]>>(
      (grouped, entry) => {
        (grouped[entry.country] ??= []).push(entry);
        return grouped;
      },
      {},
    );
    return Object.entries(groups).sort(([a], [b]) =>
      a === "Brasil" ? -1 : b === "Brasil" ? 1 : countryCompare(a, b),
    );
  }, [lang]);

  async function chooseLeague(id: string) {
    const request = ++catalogRequest.current;
    setCatalogError(false);
    setLeagueId(id);

    if (id === league.id) {
      setCatalogLoading(false);
      return;
    }
    if (id === DEFAULT_QUICK_MATCH_LEAGUE.id) {
      setLeague(DEFAULT_QUICK_MATCH_LEAGUE);
      setMyClub(DEFAULT_QUICK_MATCH_LEAGUE.clubs[0]!.id);
      setOppClub(DEFAULT_QUICK_MATCH_LEAGUE.clubs[1]!.id);
      setCatalogLoading(false);
      return;
    }

    setCatalogLoading(true);
    try {
      const { getLeague } = await preloadQuickMatchCatalog();
      if (request !== catalogRequest.current) return;
      const nextLeague = getLeague(id);
      if (nextLeague.id !== id) throw new Error("Selected league was not found.");
      const home = nextLeague.clubs[0];
      const away = nextLeague.clubs.find((club) => club.id !== home?.id);
      if (!home || !away) throw new Error("Selected league needs two clubs.");
      setLeague(nextLeague);
      setMyClub(home.id);
      setOppClub(away.id);
    } catch {
      if (request === catalogRequest.current) {
        setCatalogError(true);
        setLeagueId(league.id);
      }
    } finally {
      if (request === catalogRequest.current) setCatalogLoading(false);
    }
  }

  async function randomize() {
    const request = ++catalogRequest.current;
    setCatalogError(false);
    setCatalogLoading(true);
    try {
      const { LEAGUES } = await preloadQuickMatchCatalog();
      if (request !== catalogRequest.current) return;
      const candidates = LEAGUES.filter((candidate) => candidate.clubs.length >= 2);
      const nextLeague = candidates[Math.floor(Math.random() * candidates.length)];
      if (!nextLeague) throw new Error("No league with two clubs is available.");
      const homeIndex = Math.floor(Math.random() * nextLeague.clubs.length);
      const home = nextLeague.clubs[homeIndex]!;
      let away = nextLeague.clubs[Math.floor(Math.random() * nextLeague.clubs.length)]!;
      if (away.id === home.id) away = nextLeague.clubs[(homeIndex + 1) % nextLeague.clubs.length]!;
      setLeague(nextLeague);
      setLeagueId(nextLeague.id);
      setMyClub(home.id);
      setOppClub(away.id);
    } catch {
      if (request === catalogRequest.current) setCatalogError(true);
    } finally {
      if (request === catalogRequest.current) setCatalogLoading(false);
    }
  }

  if (started) {
    return (
      <Suspense fallback={<MatchLoading />}>
        <QuickLive
          myId={myClub}
          oppId={oppClub}
          difficulty={difficulty}
          seed={seed}
          onExit={() => {
            setSeed(`quick-${Date.now()}`);
            setStarted(false);
          }}
        />
      </Suspense>
    );
  }

  const selectedLeagueSummary =
    QUICK_MATCH_LEAGUE_DIRECTORY.find((entry) => entry.id === leagueId) ?? league;

  return (
    <main className="min-h-dvh bg-background px-4 py-8 sm:py-10">
      <div className="mx-auto max-w-5xl">
        {/* Keep the reading control in its column when the detected language
            changes the title width; reserve the mobile title's two lines. */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
          <h1 className="min-h-[2lh] font-display text-4xl uppercase tracking-wide sm:min-h-0">
            {t("quick.title")}
          </h1>
          <AccessibilitySettings />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{t("quick.description")}</p>

        {/* The small directory stays SSR-visible; club data loads after interaction. */}
        <div className="mt-6 flex max-w-md items-center gap-3">
          <Flag
            league={selectedLeagueSummary.id}
            country={selectedLeagueSummary.country}
            size={24}
          />
          <label htmlFor="quick-league" className="sr-only">
            {t("nav.league")}
          </label>
          <select
            id="quick-league"
            value={leagueId}
            onChange={(event) => void chooseLeague(event.target.value)}
            onPointerEnter={() => void preloadQuickMatchCatalog().catch(() => undefined)}
            onFocus={() => void preloadQuickMatchCatalog().catch(() => undefined)}
            disabled={catalogLoading}
            className="min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {leagueGroups.map(([country, leagues]) => (
              <optgroup key={country} label={country}>
                {leagues.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {catalogLoading ? (
          <div
            className="mt-6 grid min-h-56 place-items-center rounded-2xl border border-border/60 surface-card"
            aria-busy="true"
          >
            <p role="status" className="text-sm text-muted-foreground">
              {t("common.loading")}
            </p>
          </div>
        ) : (
          <>
            {catalogError && (
              <p className="mt-4 text-sm text-destructive" role="alert">
                {t("screen.error")}
              </p>
            )}
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <TeamPicker
                title={t("quick.home")}
                clubs={league.clubs}
                value={myClub}
                onChange={setMyClub}
                disabled={oppClub}
              />
              <TeamPicker
                title={t("quick.away")}
                clubs={league.clubs}
                value={oppClub}
                onChange={setOppClub}
                disabled={myClub}
              />
            </div>
          </>
        )}

        <p className="mt-3 text-xs text-muted-foreground">{t("quick.hint")}</p>
        <div className="mt-6 grid gap-3 sm:flex sm:flex-wrap sm:items-center">
          <div className="grid grid-cols-3 gap-2 sm:flex">
            {DIFFS.map((difficultyOption) => (
              <button
                key={difficultyOption}
                onClick={() => setDifficulty(difficultyOption)}
                aria-pressed={difficulty === difficultyOption}
                className={`min-h-11 rounded-lg border px-3 py-2 font-display text-xs uppercase tracking-wide ${
                  difficulty === difficultyOption
                    ? "border-primary bg-primary/15"
                    : "border-border surface-card text-muted-foreground"
                }`}
              >
                {t(
                  difficultyOption === "facil"
                    ? "quick.easy"
                    : difficultyOption === "dificil"
                      ? "quick.hard"
                      : "quick.normal",
                )}
              </button>
            ))}
          </div>
          <button
            onClick={() => void randomize()}
            disabled={catalogLoading}
            className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border surface-card px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            <Shuffle size={14} aria-hidden="true" /> {t("quick.random")}
          </button>
          <button
            onClick={() => {
              setStarted(true);
              const careerId = existingCareerAnalyticsId();
              window.__lovableEvents?.track?.("project.match_started", {
                ...(careerId ? { career_id: careerId } : {}),
                mode: "quick",
                entry: "quick_match",
              });
            }}
            onPointerEnter={preloadQuickLive}
            onFocus={preloadQuickLive}
            disabled={catalogLoading || myClub === oppClub}
            className="min-h-12 rounded-lg bg-primary px-6 py-2 font-display text-base uppercase tracking-wide text-primary-foreground shadow-lg disabled:opacity-40"
          >
            {t("quick.start")}
          </button>
          <Link
            to="/"
            className="py-2 text-center text-xs text-muted-foreground underline sm:text-left"
          >
            {t("quick.back")}
          </Link>
        </div>
      </div>
    </main>
  );
}

function TeamPicker({
  title,
  clubs,
  value,
  onChange,
  disabled,
}: {
  title: string;
  clubs: Club[];
  value: string;
  onChange: (id: string) => void;
  disabled: string;
}) {
  const pickerId = useId();
  const selected = clubs.find((club) => club.id === value) ?? clubs[0]!;
  return (
    <section className="rounded-2xl border border-border/60 surface-card p-4">
      <h2 className="font-display text-xs uppercase tracking-[0.25em] text-muted-foreground">
        <label htmlFor={pickerId}>{title}</label>
      </h2>
      <div className="mt-3 flex items-center gap-3">
        <Crest club={selected} size={44} detail="full" loading="idle" />
        <span className="font-display text-lg">{selected.name}</span>
        <span
          className="ml-auto rounded-md border border-primary/25 bg-primary/10 px-2 py-1 text-xs tabular-nums text-primary"
          aria-label={`Força de referência ${selected.strength}`}
        >
          Força {selected.strength}
        </span>
      </div>
      <select
        id={pickerId}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        className="mt-3 min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {clubs.map((club) => (
          <option key={club.id} value={club.id} disabled={club.id === disabled}>
            {club.name}
          </option>
        ))}
      </select>
    </section>
  );
}
