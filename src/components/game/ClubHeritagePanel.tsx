import { Building2, CalendarDays, MapPin, Trophy } from "lucide-react";

import { HudCard, HudChip } from "@/components/ui/hud";
import { useClubHeritage } from "@/hooks/useClubHeritage";

interface ClubHeritagePanelProps {
  clubId: string;
  compact?: boolean;
  className?: string;
}

const formatter = new Intl.NumberFormat("pt-BR");

export function ClubHeritagePanel({ clubId, compact = false, className }: ClubHeritagePanelProps) {
  const { data, isPending, isError } = useClubHeritage(clubId);

  return (
    <HudCard title="Identidade do clube" tone="neutral" {...(className ? { className } : {})}>
      {isPending ? (
        <div className="space-y-3" aria-label="Carregando história do clube">
          <div className="h-5 w-3/4 animate-pulse rounded bg-foreground/10" />
          <div className="h-16 animate-pulse rounded bg-foreground/5" />
        </div>
      ) : isError || !data ? (
        <p className="text-sm text-muted-foreground">
          A ficha histórica ainda não está disponível para este clube.
        </p>
      ) : (
        <>
          {data.stadium?.photoUrl ? (
            <img
              src={data.stadium.photoUrl}
              alt={`Vista do ${data.stadium.name}`}
              className="mb-3 aspect-[16/7] w-full rounded-lg border border-border/60 object-cover"
              loading="lazy"
              decoding="async"
            />
          ) : null}
          <dl className="grid gap-2 text-xs sm:grid-cols-2">
            <div className="flex items-center gap-2 rounded-lg border border-border/60 p-2">
              <CalendarDays className="size-4 text-primary" aria-hidden />
              <div>
                <dt className="text-muted-foreground">Fundação</dt>
                <dd className="font-semibold">{data.founded ?? "Não informada"}</dd>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-border/60 p-2">
              <MapPin className="size-4 text-primary" aria-hidden />
              <div>
                <dt className="text-muted-foreground">Cidade</dt>
                <dd className="font-semibold">
                  {data.city ?? data.stadium?.city ?? "Não informada"}
                </dd>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-border/60 p-2 sm:col-span-2">
              <Building2 className="size-4 text-primary" aria-hidden />
              <div>
                <dt className="text-muted-foreground">Estádio</dt>
                <dd className="font-semibold">
                  {data.stadium?.name ?? "Não informado"}
                  {data.stadium?.capacity
                    ? ` · ${formatter.format(data.stadium.capacity)} lugares`
                    : ""}
                </dd>
              </div>
            </div>
          </dl>
          {data.description ? (
            <p
              className={`mt-3 text-sm leading-relaxed text-muted-foreground ${compact ? "line-clamp-4" : ""}`}
            >
              {data.description}
            </p>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              A fonte ainda não publicou uma biografia para este clube.
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/50 pt-3 text-[10px] text-muted-foreground">
            {data.source ? <HudChip>Fonte: {data.source}</HudChip> : null}
            {data.updatedAt ? (
              <span>Atualizado em {new Date(data.updatedAt).toLocaleDateString("pt-BR")}</span>
            ) : null}
          </div>
        </>
      )}
    </HudCard>
  );
}

export function ClubHonoursPanel({
  clubId,
  className,
}: Pick<ClubHeritagePanelProps, "clubId" | "className">) {
  const { data, isPending, isError } = useClubHeritage(clubId);
  return (
    <HudCard
      title="Títulos históricos do clube"
      tone={data?.honours.length ? "good" : "neutral"}
      {...(className ? { className } : {})}
    >
      {isPending ? (
        <div
          className="h-20 animate-pulse rounded bg-foreground/5"
          aria-label="Carregando títulos reais"
        />
      ) : null}
      {!isPending && (isError || !data?.honours.length) ? (
        <p className="text-sm text-muted-foreground">
          Nenhum título histórico foi confirmado pela fonte para este clube.
        </p>
      ) : null}
      {data?.honours.length ? (
        <ul className="grid gap-2 sm:grid-cols-2">
          {data.honours.slice(0, 12).map((honour) => (
            <li
              key={honour.id}
              className="flex gap-3 rounded-lg border border-border/60 bg-foreground/[0.03] p-3"
            >
              <Trophy className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0">
                <p className="text-xs font-semibold">{honour.competition}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {honour.titleCount} {honour.titleCount === 1 ? "título" : "títulos"}
                  {honour.seasons.length ? ` · ${honour.seasons.slice(-4).join(", ")}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </HudCard>
  );
}
