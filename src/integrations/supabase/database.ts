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
      create_match_room_for: {
        Args: { p_host_id: string; p_host_club: string; p_code: string; p_seed: string };
        Returns: {
          result: "created" | "room_active_limit" | "room_hourly_limit";
          room: PublicSchema["Tables"]["match_rooms"]["Row"] | null;
        }[];
      };
      create_support_ticket: {
        Args: {
          p_user_id: string;
          p_email: string;
          p_request_id: string;
          p_category: string;
          p_subject: string;
          p_message: string;
        };
        Returns: { ticket_id: string; status: "queued" | "delivered" | "delivery_failed" }[];
      };
      claim_support_deliveries: {
        Args: { p_limit?: number; p_ticket_id?: string | null };
        Returns: {
          ticket_id: string;
          user_id: string;
          email: string;
          category: string;
          subject: string;
          message: string;
          created_at: string;
          lease_token: string;
          attempts: number;
        }[];
      };
      complete_support_delivery: {
        Args: {
          p_ticket_id: string;
          p_lease_token: string;
          p_delivered: boolean;
          p_error_code?: string;
          p_retryable?: boolean;
        };
        Returns: boolean;
      };
      complete_api_football_import_phase: Omit<CompleteImportPhase, "Args"> & {
        Args: Omit<CompleteImportPhase["Args"], "p_next_offset" | "p_error"> & {
          p_next_offset: CompleteImportPhase["Args"]["p_next_offset"] | null;
          p_error?: CompleteImportPhase["Args"]["p_error"] | null;
        };
      };
    };
  };
};
