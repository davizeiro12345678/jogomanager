import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, Clock3, ShieldCheck, Trophy } from "lucide-react";

import { Crest } from "@/components/game/Crest";
import { Button } from "@/components/ui/button";
import { HudCard, HudChip, HudStat } from "@/components/ui/hud";
import { CLUBS } from "@/game/data/leagues";
import type { CareerState } from "@/game/types";
import { supabase } from "@/integrations/supabase/client";

type RankingRow = {
  rank?: number;
  public_name: string;
  club_id: string | null;
  active_seconds: number;
  weekly_active_seconds: number;
  matches_completed: number;
  wins: number;
  active_streak: number;
  opted_in: boolean;
};

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;
}

function careerStats(career: CareerState) {
  const matches = career.results.filter((result) => result.home === career.clubId || result.away === career.clubId);
  const wins = matches.filter((result) => {
    const isHome = result.home === career.clubId;
    return isHome ? result.hg > result.ag : result.ag > result.hg;
  }).length;
  return { matches: matches.length, wins };
}

export function useActiveTimeTracking(career: CareerState | null, signedIn: boolean | null) {
  const lastInteraction = useRef(0);
  const stats = useMemo(() => (career ? careerStats(career) : null), [career]);

  useEffect(() => {
    if (!career || !signedIn) return;
    lastInteraction.current = Date.now();
    const markActive = () => { lastInteraction.current = Date.now(); };
    const events: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "scroll", "touchstart"];
    events.forEach((event) => window.addEventListener(event, markActive, { passive: true }));

    const heartbeat = async () => {
      if (document.hidden || Date.now() - lastInteraction.current > 90_000) return;
      await supabase.rpc("record_active_time", {
        p_public_name: career.managerName || "Treinador",
        p_club_id: career.clubId,
        p_matches_started: stats?.matches ?? 0,
        p_matches_completed: stats?.matches ?? 0,
        p_wins: stats?.wins ?? 0,
        p_seasons: Math.max(1, career.season),
      });
    };
    void heartbeat();
    const timer = window.setInterval(() => void heartbeat(), 60_000);
    return () => {
      window.clearInterval(timer);
      events.forEach((event) => window.removeEventListener(event, markActive));
    };
  }, [career, signedIn, stats]);
}

export function ActivityRanking({ career, signedIn }: { career: CareerState; signedIn: boolean | null }) {
  const [rows, setRows] = useState<RankingRow[]>([]);
  const [mine, setMine] = useState<RankingRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    const [{ data: session }, ranking] = await Promise.all([
      supabase.auth.getSession(),
      supabase.rpc("get_public_activity_rankings", { p_limit: 20 }),
    ]);
    if (ranking.error) setError("O ranking está temporariamente indisponível.");
    setRows((ranking.data ?? []) as RankingRow[]);
    if (session.session?.user.id) {
      const own = await supabase.rpc("get_own_activity_ranking");
      setMine(((own.data?.[0] as RankingRow | undefined) ?? null));
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const setParticipation = async (optedIn: boolean) => {
    setSaving(true);
    setError("");
    const { error: saveError } = await supabase.rpc("set_activity_ranking_preferences", {
      p_opted_in: optedIn,
      p_public_name: career.managerName || "Treinador",
      p_club_id: career.clubId,
    });
    if (saveError) setError("Não foi possível salvar sua escolha agora.");
    else await load();
    setSaving(false);
  };

  return (
    <HudCard title="Ranking de atividade" tone="neutral" className="md:col-span-2" badge={<HudChip>Sem dados pessoais</HudChip>}>
      {!signedIn ? (
        <p className="text-sm text-muted-foreground">Entre na sua conta para escolher participar do ranking público.</p>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
          <div>
            <p className="text-sm font-semibold">Participação pública opcional</p>
            <p className="mt-1 max-w-xl text-xs text-muted-foreground">Conta apenas tempo com a página visível e atividade recente. Exibe nome do treinador, clube e números agregados.</p>
          </div>
          <Button type="button" variant={mine?.opted_in ? "outline" : "default"} disabled={saving} onClick={() => void setParticipation(!mine?.opted_in)}>
            <ShieldCheck /> {mine?.opted_in ? "Sair do ranking" : "Participar"}
          </Button>
        </div>
      )}

      {mine ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <HudStat label="Seu tempo" value={formatDuration(mine.active_seconds)} />
          <HudStat label="Nesta semana" value={formatDuration(mine.weekly_active_seconds)} />
          <HudStat label="Partidas" value={mine.matches_completed} />
          <HudStat label="Sequência" value={`${mine.active_streak}d`} />
        </div>
      ) : null}

      <ol className="mt-4 divide-y divide-border/60">
        {loading ? <li className="py-4 text-sm text-muted-foreground">Carregando ranking…</li> : null}
        {!loading && rows.length === 0 ? <li className="py-4 text-sm text-muted-foreground">Ainda não há participantes nesta semana.</li> : null}
        {rows.map((row, index) => {
          const club = row.club_id ? CLUBS[row.club_id] : undefined;
          return (
            <li key={`${row.rank}-${row.public_name}-${row.club_id}`} className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 py-3">
              <span className="hud-num text-center text-sm font-bold text-muted-foreground">{row.rank ?? index + 1}</span>
              <div className="flex min-w-0 items-center gap-3">
                {club ? <Crest club={club} size={32} detail="simple" /> : <BarChart3 className="text-muted-foreground" size={26} />}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{row.public_name}</p>
                  <p className="truncate text-xs text-muted-foreground">{club?.name ?? "Clube não informado"} · {row.wins} vitórias</p>
                </div>
              </div>
              <div className="text-right">
                <p className="hud-num flex items-center justify-end gap-1 text-sm font-bold"><Clock3 size={13} /> {formatDuration(row.weekly_active_seconds)}</p>
                <p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-muted-foreground"><Trophy size={11} /> {row.matches_completed} jogos</p>
              </div>
            </li>
          );
        })}
      </ol>
      {error ? <p role="alert" className="mt-3 text-sm text-destructive">{error}</p> : null}
    </HudCard>
  );
}