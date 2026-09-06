/**
 * Compatibilidade: a persistência real vive em `@/lib/offline/store`.
 * Estas funções síncronas continuam existindo para leituras imediatas.
 */
export {
  readLocalCareer,
  loadLocalCareer,
  saveLocalCareer,
  clearLocalCareer,
  listSnapshots,
  queueSync,
  readOutbox,
  clearOutbox,
  localSavedAt,
  isOnline,
} from "@/lib/offline/store";

export { saveLocalCareer as writeLocalCareer } from "@/lib/offline/store";
