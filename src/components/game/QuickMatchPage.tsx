import { Link } from "@tanstack/react-router";
import { Shuffle } from "lucide-react";
import { lazy, Suspense, useState } from "react";

import { Crest } from "@/components/game/Crest";
import { Flag } from "@/components/game/Flag";
import { MatchLoading } from "@/components/game/MatchLoading";
import { BUNDLED_LEAGUES, LEAGUES, getLeague } from "@/game/data/leagues";
import { COUNTRY_ORDER, COUNTRY_COLLATION_EXCEPTIONS } from "@/game/quick-country-order.generated";
import type { Difficulty } from "@/game/quickMatch";
import { loadQuickLive } from "@/game/quick-match-entry";
import { safeClub } from "@/game/club-reference";
import AccessibilitySettings from "@/components/accessibility/AccessibilitySettings";
import { useT } from "@/i18n/provider";

const QuickLive = lazy(loadQuickLive);
const preloadQuickLive = () => loadQuickLive().catch(() => undefined);

const DIFFS: Difficulty[] = ["facil", "normal", "dificil"];
const countryRank = new Map(COUNTRY_ORDER.map((i, rank) => [BUNDLED_LEAGUES[i]!.country, rank]));

export function QuickMatchPage() {
  const { t, lang } = useT();
  const [leagueId, setLeagueId] = useState(LEAGUES[0]!.id);
  const league = getLeague(leagueId);
  const [myClub, setMyClub] = useState(league.clubs[0]!.id);
  const [oppClub, setOppClub] = useState(league.clubs[1]!.id);
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [started, setStarted] = useState(false);
  const [seed, setSeed] = useState(() => `quick-${Date.now()}`);

  function chooseLeague(id: string) {
    setLeagueId(id);
    const l = getLeague(id);
    setMyClub(l.clubs[0]!.id);
    setOppClub(l.clubs[1]!.id);
  }

  function randomize() {
    const l = LEAGUES[Math.floor(Math.random() * LEAGUES.length)]!;
    const a = l.clubs[Math.floor(Math.random() * l.clubs.length)]!;
    let b = l.clubs[Math.floor(Math.random() * l.clubs.length)]!;
    if (b.id === a.id) b = l.clubs[(l.clubs.indexOf(a) + 1) % l.clubs.length]!;
    setLeagueId(l.id);
    setMyClub(a.id);
    setOppClub(b.id);
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

  const groups = Object.entries(
    LEAGUES.reduce<Record<string, typeof LEAGUES>>((acc, league) => {
      (acc[league.country] ??= []).push(league);
      return acc;
    }, {}),
  );
  // 89 supported locales share this exact order. Avoid cold ICU setup during
  // hydration; preserve platform collation for exceptions and custom countries.
  const countryCompare =
    COUNTRY_COLLATION_EXCEPTIONS.has(lang) || groups.some(([c]) => !countryRank.has(c))
      ? new Intl.Collator(lang).compare
      : (a: string, b: string) => countryRank.get(a)! - countryRank.get(b)!;
  return (
    <div className="pitch-bg min-h-screen px-4 py-10">
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

        {/* All leagues, grouped by country (was a 40-button wall that hid most leagues). */}
        <div className="mt-6 flex max-w-md items-center gap-3">
          <Flag league={league.id} country={league.country} size={24} />
          <label htmlFor="quick-league" className="sr-only">
            {t("nav.league")}
          </label>
          <select
            id="quick-league"
            value={leagueId}
            onChange={(e) => chooseLeague(e.target.value)}
            className="w-full rounded-lg border border-input bg-background/70 px-3 py-2 text-sm outline-none focus:border-primary"
          >
            {groups
              .sort(([a], [b]) => (a === "Brasil" ? -1 : b === "Brasil" ? 1 : countryCompare(a, b)))
              .map(([country, ls]) => (
                <optgroup key={country} label={country}>
                  {ls.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </optgroup>
              ))}
          </select>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <TeamPicker
            title={t("quick.home")}
            clubs={league.clubs.map((c) => c.id)}
            value={myClub}
            onChange={setMyClub}
            disabled={oppClub}
          />
          <TeamPicker
            title={t("quick.away")}
            clubs={league.clubs.map((c) => c.id)}
            value={oppClub}
            onChange={setOppClub}
            disabled={myClub}
          />
        </div>

        <p className="mt-3 text-xs text-muted-foreground">{t("quick.hint")}</p>
        <div className="mt-6 grid gap-3 sm:flex sm:flex-wrap sm:items-center">
          <div className="grid grid-cols-3 gap-2 sm:flex">
            {DIFFS.map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                aria-pressed={difficulty === d}
                className={`min-h-11 rounded-lg border px-3 py-2 font-display text-xs uppercase tracking-wide ${
                  difficulty === d
                    ? "border-primary bg-primary/15"
                    : "border-border surface-card text-muted-foreground"
                }`}
              >
                {t(d === "facil" ? "quick.easy" : d === "dificil" ? "quick.hard" : "quick.normal")}
              </button>
            ))}
          </div>
          <button
            onClick={randomize}
            className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border surface-card px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground"
          >
            <Shuffle size={14} aria-hidden="true" /> {t("quick.random")}
          </button>
          <button
            onClick={() => setStarted(true)}
            onPointerEnter={preloadQuickLive}
            onFocus={preloadQuickLive}
            disabled={myClub === oppClub}
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
    </div>
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
  clubs: string[];
  value: string;
  onChange: (id: string) => void;
  disabled: string;
}) {
  const selected = safeClub(value);
  return (
    <section className="rounded-2xl border border-border/60 surface-card p-4">
      <h2 className="font-display text-xs uppercase tracking-[0.25em] text-muted-foreground">
        {title}
      </h2>
      <div className="mt-3 flex items-center gap-3">
        <Crest club={selected} size={44} detail="full" />
        <span className="font-display text-lg">{selected.name}</span>
        <span
          className="ml-auto rounded-md border border-primary/25 bg-primary/10 px-2 py-1 text-xs tabular-nums text-primary"
          aria-label={`Força de referência ${selected.strength}`}
        >
          Força {selected.strength}
        </span>
      </div>
      <div className="mt-3 grid max-h-56 gap-1 overflow-y-auto pr-1">
        {clubs.map((id) => (
          <button
            key={id}
            onClick={() => onChange(id)}
            disabled={id === disabled}
            className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition ${
              id === value
                ? "bg-primary/15 text-foreground"
                : "text-muted-foreground hover:bg-muted/40"
            } disabled:opacity-30`}
          >
            <Crest club={safeClub(id)} size={20} detail="simple" />
            {safeClub(id).name}
          </button>
        ))}
      </div>
    </section>
  );
}
