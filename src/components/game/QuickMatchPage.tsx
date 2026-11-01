import { Link, useLoaderData } from "@tanstack/react-router";
import { Shuffle } from "lucide-react";
import { lazy, memo, Suspense, useEffect, useRef, useState } from "react";

import { Crest } from "@/components/game/Crest";
import { Flag } from "@/components/game/Flag";
import { MatchLoading } from "@/components/game/MatchLoading";
import { loadQuickCatalogue, type QuickSelection } from "@/game/quick-selection";
import type { Club } from "@/game/types";
import type { Difficulty } from "@/game/quickMatch";
import { loadQuickLive } from "@/game/quick-match-entry";
import AccessibilitySettings from "@/components/accessibility/AccessibilitySettings";
import { useT } from "@/i18n/provider";

const QuickLive = lazy(loadQuickLive);
const preloadQuickLive = () => loadQuickLive().catch(() => undefined);

const DIFFS: Difficulty[] = ["facil", "normal", "dificil"];

type SelectionIntent = { leagueId: string } | { random: true };
const preloadCatalogue = () => void loadQuickCatalogue().catch(() => undefined);

export function QuickMatchRoute() {
  const initialSelection = useLoaderData({ from: "/partida-rapida" });
  return <QuickMatchPage initialSelection={initialSelection} />;
}

export function QuickMatchPage({ initialSelection }: { initialSelection: QuickSelection }) {
  const { t, lang } = useT();
  const [league, setLeague] = useState(initialSelection.league);
  const leagueId = league.id;
  const [myClub, setMyClub] = useState(league.clubs[0]!.id);
  const [oppClub, setOppClub] = useState(league.clubs[1]!.id);
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [started, setStarted] = useState(false);
  const [seed, setSeed] = useState(() => `quick-${Date.now()}`);
  const [intent, setIntent] = useState<SelectionIntent | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const selectionRequest = useRef({ epoch: 0, active: true });
  useEffect(() => {
    const request = selectionRequest.current;
    request.active = true;
    return () => {
      request.active = false;
      request.epoch++;
    };
  }, []);

  async function chooseSelection(next: SelectionIntent) {
    const request = selectionRequest.current,
      epoch = ++request.epoch;
    setLoadFailed(false);
    if ("leagueId" in next && next.leagueId === leagueId) {
      setIntent(null);
      return;
    }
    setIntent(next);
    try {
      const { LEAGUES } = await loadQuickCatalogue();
      if (!request.active || request.epoch !== epoch) return;
      const l =
        "random" in next
          ? LEAGUES[Math.floor(Math.random() * LEAGUES.length)]!
          : LEAGUES.find((candidate) => candidate.id === next.leagueId);
      if (!l || l.clubs.length < 2) throw new Error("League unavailable");
      let a = l.clubs[0]!,
        b = l.clubs[1]!;
      if ("random" in next) {
        a = l.clubs[Math.floor(Math.random() * l.clubs.length)]!;
        b = l.clubs[Math.floor(Math.random() * l.clubs.length)]!;
        if (b.id === a.id) b = l.clubs[(l.clubs.indexOf(a) + 1) % l.clubs.length]!;
      }
      setLeague(l);
      setMyClub(a.id);
      setOppClub(b.id);
      setIntent(null);
    } catch {
      if (request.active && request.epoch === epoch) setLoadFailed(true);
    }
  }

  function randomize() {
    void chooseSelection({ random: true });
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

  // localeCompare with an explicit locale constructs ICU collation work for
  // every sort comparison. Share one comparator without caching mutable leagues.
  const countryCompare = new Intl.Collator(lang).compare;
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
            value={intent && "leagueId" in intent ? intent.leagueId : leagueId}
            onChange={(e) => void chooseSelection({ leagueId: e.target.value })}
            onFocus={preloadCatalogue}
            onPointerEnter={preloadCatalogue}
            aria-busy={intent !== null && !loadFailed}
            className="w-full rounded-lg border border-input bg-background/70 px-3 py-2 text-sm outline-none focus:border-primary"
          >
            {Object.entries(
              initialSelection.leagues.reduce<Record<string, QuickSelection["leagues"]>>(
                (acc, l) => {
                  (acc[l.country] ??= []).push(l);
                  return acc;
                },
                {},
              ),
            )
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
        {intent ? (
          <div className="mt-2 text-sm text-muted-foreground">
            <p role={loadFailed ? "alert" : "status"}>
              {t(loadFailed ? "quick.loadError" : "quick.loadingTeams")}
            </p>
            {loadFailed ? (
              <div className="mt-2 flex gap-4">
                <button
                  type="button"
                  className="underline"
                  onClick={() => void chooseSelection(intent)}
                >
                  {t("common.retry")}
                </button>
                <button
                  type="button"
                  className="underline"
                  onClick={() => window.location.reload()}
                >
                  {t("common.reload")}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

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
            disabled={myClub === oppClub || intent !== null}
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

function TeamPicker({ title, ...selection }: TeamSelectionProps & { title: string }) {
  return (
    <section className="rounded-2xl border border-border/60 surface-card p-4">
      <h2 className="font-display text-xs uppercase tracking-[0.25em] text-muted-foreground">
        {title}
      </h2>
      <TeamSelection {...selection} />
    </section>
  );
}

interface TeamSelectionProps {
  clubs: Club[];
  value: string;
  onChange: (id: string) => void;
  disabled: string;
}

// Language detection and difficulty changes only affect labels outside this
// catalogue. Keep all clubs hydrated and interactive, but avoid reconciling
// their SVG crests again until the league or either selection changes.
const TeamSelection = memo(function TeamSelection({
  clubs,
  value,
  onChange,
  disabled,
}: TeamSelectionProps) {
  const selected = clubs.find((club) => club.id === value)!;
  return (
    <>
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
        {clubs.map((club) => (
          <button
            key={club.id}
            onClick={() => onChange(club.id)}
            disabled={club.id === disabled}
            className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition ${
              club.id === value
                ? "bg-primary/15 text-foreground"
                : "text-muted-foreground hover:bg-muted/40"
            } disabled:opacity-30`}
          >
            <Crest club={club} size={20} detail="simple" />
            {club.name}
          </button>
        ))}
      </div>
    </>
  );
});
