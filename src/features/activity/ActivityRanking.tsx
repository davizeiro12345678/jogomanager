import { useCallback, useEffect, useRef, useState } from "react";

import { BarChart3, Clock3, ShieldCheck } from "lucide-react";

import { Crest } from "@/components/game/Crest";

import { Button } from "@/components/ui/button";

import { HudCard, HudChip, HudStat } from "@/components/ui/hud";

import { CLUBS } from "@/game/data/leagues";

import type { CareerState } from "@/game/types";

import { getConfiguredSupabaseClient } from "@/integrations/supabase/client";

type PublicRankingRow = {
  rank: number;
  public_name: string;
  club_id: string | null;
  weekly_active_seconds: number;
  active_streak: number;
  matches_completed: number;
  wins: number;
};

type OwnRankingRow = {
  public_name: string;
  club_id: string;
  active_seconds: number;
  weekly_active_seconds: number;
  active_streak: number;
  opted_in: boolean;
  matches_completed: number;
  wins: number;
};

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;
}

export function ActivityRanking({
  career,
  signedIn,
}: {
  career: CareerState;
  signedIn: boolean | null;
}) {
  const [rows, setRows] = useState<PublicRankingRow[]>([]);
  const [mine, setMine] = useState<OwnRankingRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const request = useRef(0);
  const load = useCallback(async () => {
    const generation = ++request.current;
    setLoading(true);
    setError("");
    setMine(null);
    try {
      const supabase = getConfiguredSupabaseClient();
      if (!supabase) throw new Error();
      const [ranking, own] = await Promise.all([
        supabase.rpc("get_public_activity_rankings", { p_limit: 20 }),
        signedIn ? supabase.rpc("get_own_activity_ranking") : null,
      ]);
      if (request.current !== generation) return;
      if (ranking.error || own?.error) throw new Error();
      setRows(ranking.data ?? []);
      setMine(own?.data?.[0] ?? null);
    } catch {
      if (request.current === generation) {
        setRows([]);
        setError("O ranking está temporariamente indisponível.");
      }
    } finally {
      if (request.current === generation) setLoading(false);
    }
  }, [signedIn]);

  useEffect(() => {
    void load();
    return () => {
      request.current += 1;
    };
  }, [load]);

  const setParticipation = async (optedIn: boolean) => {
    const generation = request.current;
    setSaving(true);
    setError("");
    try {
      const supabase = getConfiguredSupabaseClient();
      if (!signedIn || !supabase) throw new Error();
      const { error } = await supabase.rpc("set_activity_ranking_preferences", {
        p_opted_in: optedIn,
        p_public_name: career.managerName || "Treinador",
        p_club_id: career.clubId,
      });
      if (error) throw error;
      if (request.current === generation) await load();
    } catch {
      if (request.current === generation) setError("Não foi possível salvar sua escolha agora.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <HudCard
      title="Ranking de atividade"
      tone="neutral"
      className="md:col-span-2"
      badge={<HudChip>Sem dados pessoais</HudChip>}
    >
      {!signedIn ? (
        <p className="text-sm text-muted-foreground">
          Entre na sua conta para escolher participar do ranking público.
        </p>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
          <div>
            <p className="text-sm font-semibold">Participação pública opcional</p>
            <p className="mt-1 max-w-xl text-xs text-muted-foreground">
              Conta apenas tempo com a página visível e atividade recente. Exibe nome do treinador,
              clube e números agregados.
            </p>
          </div>
          <Button
            type="button"
            variant={mine?.opted_in ? "outline" : "default"}
            disabled={saving}
            onClick={() => void setParticipation(!mine?.opted_in)}
          >
            <ShieldCheck /> {mine?.opted_in ? "Sair do ranking" : "Participar"}
          </Button>
        </div>
      )}

      {mine ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <HudStat label="Seu tempo" value={formatDuration(mine.active_seconds)} />
          <HudStat label="Nesta semana" value={formatDuration(mine.weekly_active_seconds)} />
          <HudStat label="Sequência" value={`${mine.active_streak}d`} />
        </div>
      ) : null}

      <ol className="mt-4 divide-y divide-border/60">
        {loading ? (
          <li className="py-4 text-sm text-muted-foreground">Carregando ranking…</li>
        ) : null}
        {!loading && !error && rows.length === 0 ? (
          <li className="py-4 text-sm text-muted-foreground">
            Ainda não há participantes nesta semana.
          </li>
        ) : null}
        {rows.map((row, index) => {
          const club = row.club_id ? CLUBS[row.club_id] : undefined;
          return (
            <li
              key={`${row.rank}-${row.public_name}-${row.club_id}`}
              className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 py-3"
            >
              <span className="hud-num text-center text-sm font-bold text-muted-foreground">
                {row.rank ?? index + 1}
              </span>
              <div className="flex min-w-0 items-center gap-3">
                {club ? (
                  <Crest club={club} size={32} detail="simple" />
                ) : (
                  <BarChart3 className="text-muted-foreground" size={26} />
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{row.public_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {club?.name ?? "Clube não informado"}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="hud-num flex items-center justify-end gap-1 text-sm font-bold">
                  <Clock3 size={13} /> {formatDuration(row.weekly_active_seconds)}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </HudCard>
  );
}
