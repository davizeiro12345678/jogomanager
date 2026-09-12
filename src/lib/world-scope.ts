// ============================================================================
//  world-scope.ts
//  Cada campanha tem o seu próprio "mundo": clube criado pelo usuário, edições
//  do editor e competições personalizadas ficam guardados por campanha, e não
//  mais num único lugar compartilhado por todos os saves.
//
//  A campanha antiga continua usando exatamente as chaves antigas do navegador
//  (mundo "default"), então nada do que já existe é perdido.
// ============================================================================

const ACTIVE_KEY = "manager3d.world.active";
export const DEFAULT_WORLD = "default";

let cached: string | null = null;

/** Id do mundo da campanha ativa. */
export function activeWorldId(): string {
  if (typeof window === "undefined") return DEFAULT_WORLD;
  if (cached) return cached;
  try {
    cached = window.localStorage.getItem(ACTIVE_KEY) || DEFAULT_WORLD;
  } catch {
    cached = DEFAULT_WORLD;
  }
  return cached;
}

/** Troca o mundo ativo (chamado ao começar ou carregar uma campanha). */
export function setActiveWorld(id: string) {
  const clean = id.trim() || DEFAULT_WORLD;
  cached = clean;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ACTIVE_KEY, clean);
  } catch {
    /* espaço cheio: segue com o valor em memória */
  }
}

/** Cria um id novo de mundo para uma campanha que está começando agora. */
export function newWorldId(clubId: string): string {
  return `${clubId}-${Date.now().toString(36)}`;
}

/** Chave do navegador já com o mundo da campanha ativa. */
export function scopedKey(base: string): string {
  const world = activeWorldId();
  return world === DEFAULT_WORLD ? base : `${base}::${world}`;
}

/** Apaga tudo que pertence a um mundo (usado ao descartar uma campanha). */
export function clearWorld(id: string, bases: string[]) {
  if (typeof window === "undefined" || id === DEFAULT_WORLD) return;
  for (const base of bases) {
    try {
      window.localStorage.removeItem(`${base}::${id}`);
    } catch {
      /* ignora */
    }
  }
}
