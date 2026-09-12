export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      ai_budget_usage: {
        Row: {
          kind: string;
          month: string;
          requests: number;
          spent_cents: number;
          updated_at: string;
        };
        Insert: {
          kind: string;
          month: string;
          requests?: number;
          spent_cents?: number;
          updated_at?: string;
        };
        Update: {
          kind?: string;
          month?: string;
          requests?: number;
          spent_cents?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      careers: {
        Row: {
          created_at: string;
          id: string;
          state: Json;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          state: Json;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          state?: Json;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      chat_messages: {
        Row: {
          body: string;
          created_at: string;
          display_name: string;
          hidden: boolean;
          id: string;
          user_id: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          display_name: string;
          hidden?: boolean;
          id?: string;
          user_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          display_name?: string;
          hidden?: boolean;
          id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      chat_reports: {
        Row: {
          created_at: string;
          id: string;
          message_id: string;
          reason: string;
          reporter_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          message_id: string;
          reason: string;
          reporter_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          message_id?: string;
          reason?: string;
          reporter_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chat_reports_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "chat_messages";
            referencedColumns: ["id"];
          },
        ];
      };
      club_external_ids: {
        Row: {
          club_id: string;
          confirmed: boolean;
          created_at: string;
          external_id: string;
          id: string;
          source: string;
          updated_at: string;
        };
        Insert: {
          club_id: string;
          confirmed?: boolean;
          created_at?: string;
          external_id: string;
          id?: string;
          source: string;
          updated_at?: string;
        };
        Update: {
          club_id?: string;
          confirmed?: boolean;
          created_at?: string;
          external_id?: string;
          id?: string;
          source?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "club_external_ids_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
        ];
      };
      clubs: {
        Row: {
          city: string | null;
          competition_id: string | null;
          country: string | null;
          created_at: string;
          crest_url: string | null;
          founded: number | null;
          full_name: string | null;
          id: string;
          name: string;
          primary_color: string;
          secondary_color: string;
          short_name: string;
          stadium_id: string | null;
          strength: number;
          updated_at: string;
        };
        Insert: {
          city?: string | null;
          competition_id?: string | null;
          country?: string | null;
          created_at?: string;
          crest_url?: string | null;
          founded?: number | null;
          full_name?: string | null;
          id: string;
          name: string;
          primary_color?: string;
          secondary_color?: string;
          short_name: string;
          stadium_id?: string | null;
          strength?: number;
          updated_at?: string;
        };
        Update: {
          city?: string | null;
          competition_id?: string | null;
          country?: string | null;
          created_at?: string;
          crest_url?: string | null;
          founded?: number | null;
          full_name?: string | null;
          id?: string;
          name?: string;
          primary_color?: string;
          secondary_color?: string;
          short_name?: string;
          stadium_id?: string | null;
          strength?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clubs_competition_id_fkey";
            columns: ["competition_id"];
            isOneToOne: false;
            referencedRelation: "competitions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "clubs_stadium_id_fkey";
            columns: ["stadium_id"];
            isOneToOne: false;
            referencedRelation: "stadiums";
            referencedColumns: ["id"];
          },
        ];
      };
      competitions: {
        Row: {
          club_count: number;
          country: string;
          created_at: string;
          external_id: string | null;
          external_source: string | null;
          flag: string | null;
          id: string;
          logo_url: string | null;
          name: string;
          tier: number;
          updated_at: string;
        };
        Insert: {
          club_count?: number;
          country: string;
          created_at?: string;
          external_id?: string | null;
          external_source?: string | null;
          flag?: string | null;
          id: string;
          logo_url?: string | null;
          name: string;
          tier?: number;
          updated_at?: string;
        };
        Update: {
          club_count?: number;
          country?: string;
          created_at?: string;
          external_id?: string | null;
          external_source?: string | null;
          flag?: string | null;
          id?: string;
          logo_url?: string | null;
          name?: string;
          tier?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      import_runs: {
        Row: {
          created_at: string;
          error: string | null;
          finished_at: string | null;
          id: string;
          items_imported: number;
          scope: string | null;
          source: string;
          started_at: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          error?: string | null;
          finished_at?: string | null;
          id?: string;
          items_imported?: number;
          scope?: string | null;
          source: string;
          started_at?: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          error?: string | null;
          finished_at?: string | null;
          id?: string;
          items_imported?: number;
          scope?: string | null;
          source?: string;
          started_at?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      kits: {
        Row: {
          base_color: string;
          club_id: string;
          created_at: string;
          detail_color: string;
          id: string;
          image_url: string | null;
          kind: string;
          pattern: string;
          season: string;
          shorts_color: string;
          socks_color: string;
          updated_at: string;
        };
        Insert: {
          base_color?: string;
          club_id: string;
          created_at?: string;
          detail_color?: string;
          id?: string;
          image_url?: string | null;
          kind?: string;
          pattern?: string;
          season?: string;
          shorts_color?: string;
          socks_color?: string;
          updated_at?: string;
        };
        Update: {
          base_color?: string;
          club_id?: string;
          created_at?: string;
          detail_color?: string;
          id?: string;
          image_url?: string | null;
          kind?: string;
          pattern?: string;
          season?: string;
          shorts_color?: string;
          socks_color?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "kits_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
        ];
      };
      match_rooms: {
        Row: {
          code: string;
          created_at: string;
          guest_club: string | null;
          guest_id: string | null;
          host_club: string;
          host_id: string;
          id: string;
          minute: number;
          seed: string;
          state: Json;
          status: string;
          updated_at: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          guest_club?: string | null;
          guest_id?: string | null;
          host_club: string;
          host_id: string;
          id?: string;
          minute?: number;
          seed: string;
          state?: Json;
          status?: string;
          updated_at?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          guest_club?: string | null;
          guest_id?: string | null;
          host_club?: string;
          host_id?: string;
          id?: string;
          minute?: number;
          seed?: string;
          state?: Json;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      player_profiles: {
        Row: {
          birth_year: number | null;
          created_at: string;
          guardian_approved_at: string | null;
          guardian_email: string | null;
          nickname: string | null;
          supervised: boolean;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          birth_year?: number | null;
          created_at?: string;
          guardian_approved_at?: string | null;
          guardian_email?: string | null;
          nickname?: string | null;
          supervised?: boolean;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          birth_year?: number | null;
          created_at?: string;
          guardian_approved_at?: string | null;
          guardian_email?: string | null;
          nickname?: string | null;
          supervised?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      players: {
        Row: {
          age: number;
          club_id: string;
          created_at: string;
          id: string;
          name: string;
          nationality: string | null;
          overall: number;
          photo_url: string | null;
          position: string;
          potential: number | null;
          shirt_number: number | null;
          source: string | null;
          updated_at: string;
        };
        Insert: {
          age?: number;
          club_id: string;
          created_at?: string;
          id?: string;
          name: string;
          nationality?: string | null;
          overall?: number;
          photo_url?: string | null;
          position: string;
          potential?: number | null;
          shirt_number?: number | null;
          source?: string | null;
          updated_at?: string;
        };
        Update: {
          age?: number;
          club_id?: string;
          created_at?: string;
          id?: string;
          name?: string;
          nationality?: string | null;
          overall?: number;
          photo_url?: string | null;
          position?: string;
          potential?: number | null;
          shirt_number?: number | null;
          source?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "players_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
        ];
      };
      stadiums: {
        Row: {
          capacity: number | null;
          city: string | null;
          country: string | null;
          created_at: string;
          id: string;
          name: string;
          photo_url: string | null;
          updated_at: string;
        };
        Insert: {
          capacity?: number | null;
          city?: string | null;
          country?: string | null;
          created_at?: string;
          id?: string;
          name: string;
          photo_url?: string | null;
          updated_at?: string;
        };
        Update: {
          capacity?: number | null;
          city?: string | null;
          country?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          photo_url?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      store_products: {
        Row: {
          active: boolean;
          coins: number;
          created_at: string;
          currency: string;
          description: string;
          id: string;
          key: string;
          kind: string;
          name: string;
          price_cents: number;
        };
        Insert: {
          active?: boolean;
          coins?: number;
          created_at?: string;
          currency?: string;
          description?: string;
          id?: string;
          key: string;
          kind?: string;
          name: string;
          price_cents?: number;
        };
        Update: {
          active?: boolean;
          coins?: number;
          created_at?: string;
          currency?: string;
          description?: string;
          id?: string;
          key?: string;
          kind?: string;
          name?: string;
          price_cents?: number;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null;
          created_at: string | null;
          current_period_end: string | null;
          current_period_start: string | null;
          environment: string;
          id: string;
          price_id: string;
          product_id: string;
          status: string;
          stripe_customer_id: string;
          stripe_subscription_id: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          cancel_at_period_end?: boolean | null;
          created_at?: string | null;
          current_period_end?: string | null;
          current_period_start?: string | null;
          environment?: string;
          id?: string;
          price_id: string;
          product_id: string;
          status?: string;
          stripe_customer_id: string;
          stripe_subscription_id: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          cancel_at_period_end?: boolean | null;
          created_at?: string | null;
          current_period_end?: string | null;
          current_period_start?: string | null;
          environment?: string;
          id?: string;
          price_id?: string;
          product_id?: string;
          status?: string;
          stripe_customer_id?: string;
          stripe_subscription_id?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      user_achievements: {
        Row: {
          achievement_key: string;
          id: string;
          unlocked_at: string;
          user_id: string;
        };
        Insert: {
          achievement_key: string;
          id?: string;
          unlocked_at?: string;
          user_id: string;
        };
        Update: {
          achievement_key?: string;
          id?: string;
          unlocked_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_blocks: {
        Row: {
          blocked_id: string;
          created_at: string;
          user_id: string;
        };
        Insert: {
          blocked_id: string;
          created_at?: string;
          user_id: string;
        };
        Update: {
          blocked_id?: string;
          created_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_boosts: {
        Row: {
          training_until: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          training_until?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          training_until?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_purchases: {
        Row: {
          amount_cents: number;
          created_at: string;
          error: string | null;
          id: string;
          product_key: string;
          reference: string | null;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          amount_cents?: number;
          created_at?: string;
          error?: string | null;
          id?: string;
          product_key: string;
          reference?: string | null;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          amount_cents?: number;
          created_at?: string;
          error?: string | null;
          id?: string;
          product_key?: string;
          reference?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_wallet: {
        Row: {
          coins: number;
          scout_reports: number;
          season_pass: boolean;
          season_pass_until: string | null;
          training_boosts: number;
          unlocked_themes: string[];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          coins?: number;
          scout_reports?: number;
          season_pass?: boolean;
          season_pass_until?: string | null;
          training_boosts?: number;
          unlocked_themes?: string[];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          coins?: number;
          scout_reports?: number;
          season_pass?: boolean;
          season_pass_until?: string | null;
          training_boosts?: number;
          unlocked_themes?: string[];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      wallet_item_log: {
        Row: {
          created_at: string;
          detail: string | null;
          id: string;
          item: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          detail?: string | null;
          id?: string;
          item: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          detail?: string | null;
          id?: string;
          item?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      activate_training_boost: {
        Args: { _user_id: string };
        Returns: {
          training_boosts: number;
          training_until: string;
        }[];
      };
      consume_wallet_item: {
        Args: { _detail?: string; _item: string; _user_id: string };
        Returns: {
          scout_reports: number;
          training_boosts: number;
        }[];
      };
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string };
        Returns: boolean;
      };
      reserve_ai_budget: {
        Args: { _cents: number; _kind: string };
        Returns: boolean;
      };
      send_chat_message_for: {
        Args: { _user_id: string; message_body: string };
        Returns: string;
      };
      spend_coins_for: {
        Args: { _user_id: string; amount: number };
        Returns: {
          coins: number;
          season_pass: boolean;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
