// ============================================================================
//  world.ts
//  Monta o mundo do jogo (clubes, edições e clube criado) de acordo com a
//  campanha ativa. Trocar de campanha desfaz o mundo anterior antes de montar
//  o novo, então uma campanha nunca contamina a outra.
// ============================================================================

import { applyCustomToWorld, revertCustomWorld } from "@/lib/customData";
import { loadDbCatalog } from "@/lib/db-catalog";
import { applyMyClubToWorld, readMyClub, restoreWorld } from "@/lib/myClub";
import { activeWorldId, newWorldId, setActiveWorld } from "@/lib/world-scope";

/** Monta o mundo da campanha ativa. Chamado no boot do app. */
export function applyWorld() {
  void loadDbCatalog();
  applyCustomToWorld();
  applyMyClubToWorld();
}

/** Desfaz tudo que a campanha ativa injetou no mundo. */
export function unloadWorld() {
  const my = readMyClub();
  if (my) restoreWorld(my);
  revertCustomWorld();
}

/** Troca para outra campanha já existente. */
export function switchWorld(worldId: string) {
  if (worldId === activeWorldId()) return;
  unloadWorld();
  setActiveWorld(worldId);
  applyWorld();
}

/** Cria um mundo novo e vazio para uma campanha que está começando agora. */
export function startWorldForNewCareer(clubId: string): string {
  unloadWorld();
  const id = newWorldId(clubId);
  setActiveWorld(id);
  applyWorld();
  return id;
}
