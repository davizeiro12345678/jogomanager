import { untypedDb } from "@/lib/untyped-db";
import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  AthleteDeleteSchema,
  AthleteMutationResult,
  AthleteMutationSchema,
} from "@/lib/player-career-schema";

type AthleteMutation = { status: "applied" | "conflict"; revision: number };

/** A revision is assigned by PostgreSQL, never by a browser clock or a local save. */
async function mutateAthleteCloud(
  supabase: SupabaseClient<Database>,
  slot: number,
  expectedRevision: number,
  operation: "save" | "delete",
  state: unknown,
): Promise<AthleteMutation> {
  // The authenticated client is scoped by requireSupabaseAuth. SQL owns CAS and RLS.
  const { data, error } = await supabase.rpc("mutate_player_career", {
    p_slot: slot,
    p_expected_revision: expectedRevision,
    p_operation: operation,
    p_state: state as Json | null,
  });
  if (error) {
    throw new Error(
      "Não foi possível sincronizar: verifique se a migração de saves está instalada.",
    );
  }
  const result = AthleteMutationResult.parse(data)[0]!;
  return { status: result.status, revision: result.new_revision };
}

/** Saves pessoais nunca são prova de títulos, coins ou conquistas oficiais. */
export const saveAthleteCloud = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => AthleteMutationSchema.parse(input))
  .handler(async ({ data, context }) => {
    if (JSON.stringify(data.state).length > 400_000) throw new Error("Save grande demais.");
    return mutateAthleteCloud(
      untypedDb(context.supabase),
      data.slot,
      data.expectedRevision,
      "save",
      data.state,
    );
  });

export const loadAthletesCloud = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await untypedDb(context.supabase)
      .from("player_careers")
      .select("slot, state, updated_at, sync_revision, deleted_at")
      .eq("user_id", context.userId);
    if (error) throw new Error("Não foi possível carregar seus atletas.");
    return (data ?? []).map((row) => ({
      slot: row.slot as number,
      state: JSON.stringify(row.state),
      revision: row.sync_revision as number,
      deleted: Boolean(row.deleted_at),
      updatedAt: row.updated_at as string,
    }));
  });

/** Deletar cria um tombstone, para que um dispositivo offline não reviva um atleta apagado. */
export const deleteAthleteCloud = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => AthleteDeleteSchema.parse(input))
  .handler(async ({ data, context }) =>
    mutateAthleteCloud(untypedDb(context.supabase), data.slot, data.expectedRevision, "delete", null),
  );
