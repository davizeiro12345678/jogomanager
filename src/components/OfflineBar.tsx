import { CloudCheck, CloudUpload, RefreshCw, WifiOff } from "lucide-react";

import { useOnline } from "@/hooks/useOnline";

import type { SyncState } from "@/hooks/useCareer";

import { cn } from "@/lib/utils";

const LABEL: Record<SyncState, string> = {
  local: "Salvo neste aparelho",
  saving: "Salvando neste aparelho…",
  unsaved: "Alterações não salvas — exporte a carreira",
  syncing: "Sincronizando…",
  synced: "Sincronizado",
  pending: "Aguardando sincronizar",
  offline: "Offline — salvo no aparelho",
};

/** Selo discreto com o estado do salvamento. */
export function SyncBadge({ sync, className }: { sync: SyncState; className?: string }) {
  const online = useOnline();
  const state: SyncState = sync === "unsaved" ? "unsaved" : online ? sync : "offline";
  const Icon =
    state === "synced"
      ? CloudCheck
      : state === "syncing"
        ? RefreshCw
        : state === "offline"
          ? WifiOff
          : CloudUpload;

  return (
    <span
      data-career-sync={state}
      title={LABEL[state]}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
        state === "synced" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
        state === "syncing" && "border-sky-500/30 bg-sky-500/10 text-sky-400",
        state === "unsaved" && "border-red-500/50 bg-red-500/10 text-red-300",
        state === "offline" && "border-amber-500/30 bg-amber-500/10 text-amber-400",
        (state === "pending" || state === "local") &&
          "border-muted-foreground/25 bg-muted/40 text-muted-foreground",
        className,
      )}
    >
      <Icon className={cn("h-3.5 w-3.5", state === "syncing" && "animate-spin")} />
      <span className="hidden sm:inline">{LABEL[state]}</span>
    </span>
  );
}

/** Faixa fixa mostrada apenas quando a conexão cai. */
export function OfflineBar() {
  const online = useOnline();
  if (online) return null;
  return (
    <div className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-300 backdrop-blur">
      <WifiOff className="h-3.5 w-3.5" />
      Sem internet — a carreira e as partidas seguem funcionando e sincronizam depois.
    </div>
  );
}
