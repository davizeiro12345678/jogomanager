import type { Database as GeneratedDatabase } from "./types";

type PublicSchema = GeneratedDatabase["public"];
type Functions = PublicSchema["Functions"];
type CompleteImportPhase = Functions["complete_api_football_import_phase"];

/**
 * PostgreSQL RPC arguments can accept NULL even when introspection generates a
 * non-null TypeScript argument. This RPC explicitly uses a NULL next offset to
 * finish a phase and a NULL error to mark success. Keep that SQL contract here
 * so regenerating types never changes completion into another import batch.
 */
export type Database = Omit<GeneratedDatabase, "public"> & {
  public: Omit<PublicSchema, "Functions"> & {
    Functions: Omit<Functions, "complete_api_football_import_phase"> & {
      complete_api_football_import_phase: Omit<CompleteImportPhase, "Args"> & {
        Args: Omit<CompleteImportPhase["Args"], "p_next_offset" | "p_error"> & {
          p_next_offset: CompleteImportPhase["Args"]["p_next_offset"] | null;
          p_error?: CompleteImportPhase["Args"]["p_error"] | null;
        };
      };
    };
  };
};
