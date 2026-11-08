import type { CareerState } from "@/game/types";
import type { Json } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface CareerTombstone {
  generation: number;
  deletedAt: string;
}

type CareerMutationRow = {
  status: string;
  generation: number;
  deleted_at: string | null;
};

function firstMutationRow(data: CareerMutationRow[] | null): CareerMutationRow {
  const row = data?.[0];
  if (!row) throw new Error("A operação de carreira não retornou um head.");
  return row;
}

export async function deleteCareerByUser(userId: string): Promise<CareerTombstone> {
  const { data, error } = await supabaseAdmin.rpc("delete_manager_career", {
    p_user_id: userId,
  });
  if (error) throw new Error("Não foi possível excluir a carreira.");
  const row = firstMutationRow(data);
  if (!row.deleted_at || !Number.isSafeInteger(row.generation) || row.generation < 1)
    throw new Error("A exclusão da carreira não confirmou seu tombstone.");
  return { generation: row.generation, deletedAt: row.deleted_at };
}

export type CareerCreateResult =
  | { ok: true; generation: number }
  | { ok: false; deleted: true; conflict: true; generation: number; deletedAt: string }
  | { ok: false; conflict: true; generation: number };

export async function createCareerByUser(
  userId: string,
  state: CareerState,
  verifiedProgress: boolean,
  expectedGeneration: number | null,
): Promise<CareerCreateResult> {
  const { data, error } = await supabaseAdmin.rpc("create_manager_career", {
    p_user_id: userId,
    p_state: state as unknown as Json,
    p_expected_generation: expectedGeneration,
    p_verified_progress: verifiedProgress,
  });
  if (error) throw new Error("Não foi possível criar a carreira.");
  const row = firstMutationRow(data);
  if (!Number.isSafeInteger(row.generation) || row.generation < 1)
    throw new Error("A criação da carreira não confirmou sua geração.");
  if (row.status === "applied") return { ok: true, generation: row.generation };
  if (row.status === "conflict_deleted" && row.deleted_at)
    return {
      ok: false,
      deleted: true,
      conflict: true,
      generation: row.generation,
      deletedAt: row.deleted_at,
    };
  return { ok: false, conflict: true, generation: row.generation };
}
