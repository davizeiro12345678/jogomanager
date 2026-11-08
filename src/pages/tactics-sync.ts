import type { SyncState } from "@/hooks/useCareer";

export function tacticsSyncMessage(sync: SyncState, saving: boolean) {
  if (saving) return "Salvamento: salvando alterações…";
  if (sync === "syncing") return "Salvamento: sincronizando alterações…";
  if (sync === "synced") return "Salvamento: alterações salvas e sincronizadas na nuvem.";
  if (sync === "pending") {
    return "Salvamento: alterações salvas neste aparelho; aguardando sincronização.";
  }
  if (sync === "offline") {
    return "Salvamento: alterações salvas neste aparelho; serão sincronizadas quando a conexão voltar.";
  }
  return "Salvamento: alterações salvas neste aparelho.";
}
