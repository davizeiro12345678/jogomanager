export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_rankings: {
        Row: {
          active_seconds: number
          active_streak: number
          club_id: string | null
          created_at: string
          last_active_date: string | null
          last_heartbeat_at: string | null
          matches_completed: number
          matches_started: number
          opted_in: boolean
          public_name: string
          seasons: number
          updated_at: string
          user_id: string
          week_key: string
          weekly_active_seconds: number
          wins: number
        }
        Insert: {
          active_seconds?: number
          active_streak?: number
          club_id?: string | null
          created_at?: string
          last_active_date?: string | null
          last_heartbeat_at?: string | null
          matches_completed?: number
          matches_started?: number
          opted_in?: boolean
          public_name?: string
          seasons?: number
          updated_at?: string
          user_id: string
          week_key?: string
          weekly_active_seconds?: number
          wins?: number
        }
        Update: {
          active_seconds?: number
          active_streak?: number
          club_id?: string | null
          created_at?: string
          last_active_date?: string | null
          last_heartbeat_at?: string | null
          matches_completed?: number
          matches_started?: number
          opted_in?: boolean
          public_name?: string
          seasons?: number
          updated_at?: string
          user_id?: string
          week_key?: string
          weekly_active_seconds?: number
          wins?: number
        }
        Relationships: []
      }
      ai_budget_usage: {
        Row: {
          kind: string
          month: string
          requests: number
          spent_cents: number
          updated_at: string
        }
        Insert: {
          kind: string
          month: string
          requests?: number
          spent_cents?: number
          updated_at?: string
        }
        Update: {
          kind?: string
          month?: string
          requests?: number
          spent_cents?: number
          updated_at?: string
        }
        Relationships: []
      }
      api_football_data: {
        Row: {
          kind: string
          payload: Json
          ref: string
          updated_at: string
        }
        Insert: {
          kind: string
          payload: Json
          ref: string
          updated_at?: string
        }
        Update: {
          kind?: string
          payload?: Json
          ref?: string
          updated_at?: string
        }
        Relationships: []
      }
      api_football_import_progress: {
        Row: {
          batch_size: number
          consecutive_failures: number
          error_message: string | null
          lease_token: string | null
          lease_until: string | null
          next_offset: number
          phase: string
          status: string
          total_processed: number
          updated_at: string
        }
        Insert: {
          batch_size?: number
          consecutive_failures?: number
          error_message?: string | null
          lease_token?: string | null
          lease_until?: string | null
          next_offset?: number
          phase: string
          status?: string
          total_processed?: number
          updated_at?: string
        }
        Update: {
          batch_size?: number
          consecutive_failures?: number
          error_message?: string | null
          lease_token?: string | null
          lease_until?: string | null
          next_offset?: number
          phase?: string
          status?: string
          total_processed?: number
          updated_at?: string
        }
        Relationships: []
      }
      api_football_page_progress: {
        Row: {
          completed_at: string | null
          next_page: number
          phase: string
          season: string
          target_id: string
          total_pages: number | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          next_page?: number
          phase: string
          season: string
          target_id: string
          total_pages?: number | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          next_page?: number
          phase?: string
          season?: string
          target_id?: string
          total_pages?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      api_football_quota_usage: {
        Row: {
          request_count: number
          window_start: string
          window_type: string
        }
        Insert: {
          request_count?: number
          window_start: string
          window_type: string
        }
        Update: {
          request_count?: number
          window_start?: string
          window_type?: string
        }
        Relationships: []
      }
      api_football_season_coverage: {
        Row: {
          coverage: Json
          league_source_id: string
          season: string
          updated_at: string
        }
        Insert: {
          coverage?: Json
          league_source_id: string
          season: string
          updated_at?: string
        }
        Update: {
          coverage?: Json
          league_source_id?: string
          season?: string
          updated_at?: string
        }
        Relationships: []
      }
      careers: {
        Row: {
          created_at: string
          id: string
          state: Json
          updated_at: string
          user_id: string
          verified_progress: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          state: Json
          updated_at?: string
          user_id: string
          verified_progress?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          state?: Json
          updated_at?: string
          user_id?: string
          verified_progress?: boolean
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          body: string
          created_at: string
          display_name: string
          hidden: boolean
          id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          display_name: string
          hidden?: boolean
          id?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          display_name?: string
          hidden?: boolean
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_reports: {
        Row: {
          created_at: string
          id: string
          message_id: string
          reason: string
          reporter_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          reason: string
          reporter_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          reason?: string
          reporter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_reports_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      checkout_session_owners: {
        Row: {
          contents_snapshot: Json | null
          created_at: string
          currency: string | null
          environment: string
          price_cents: number | null
          product_key: string | null
          session_id: string
          stripe_price_id: string | null
          user_id: string
        }
        Insert: {
          contents_snapshot?: Json | null
          created_at?: string
          currency?: string | null
          environment: string
          price_cents?: number | null
          product_key?: string | null
          session_id: string
          stripe_price_id?: string | null
          user_id: string
        }
        Update: {
          contents_snapshot?: Json | null
          created_at?: string
          currency?: string | null
          environment?: string
          price_cents?: number | null
          product_key?: string | null
          session_id?: string
          stripe_price_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      club_catalog_links: {
        Row: {
          club_id: string
          match_rule: string
          metadata_before: Json
          reviewed_at: string
          source: string
          source_club_id: string
          source_team_id: string | null
        }
        Insert: {
          club_id: string
          match_rule?: string
          metadata_before: Json
          reviewed_at?: string
          source: string
          source_club_id: string
          source_team_id?: string | null
        }
        Update: {
          club_id?: string
          match_rule?: string
          metadata_before?: Json
          reviewed_at?: string
          source?: string
          source_club_id?: string
          source_team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "club_catalog_links_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_catalog_links_source_club_id_fkey"
            columns: ["source_club_id"]
            isOneToOne: true
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_catalog_links_source_team_id_fkey"
            columns: ["source_team_id"]
            isOneToOne: false
            referencedRelation: "official_teams"
            referencedColumns: ["source_id"]
          },
        ]
      }
      club_external_ids: {
        Row: {
          club_id: string
          confirmed: boolean
          created_at: string
          external_id: string
          id: string
          source: string
          updated_at: string
        }
        Insert: {
          club_id: string
          confirmed?: boolean
          created_at?: string
          external_id: string
          id?: string
          source: string
          updated_at?: string
        }
        Update: {
          club_id?: string
          confirmed?: boolean
          created_at?: string
          external_id?: string
          id?: string
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_external_ids_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_honours: {
        Row: {
          club_id: string
          competition: string
          created_at: string
          data_version: number
          external_id: string | null
          id: string
          last_synced_at: string | null
          seasons: string[]
          source: string
          source_id: string | null
          source_updated_at: string | null
          sync_status: string
          title_count: number
          updated_at: string
        }
        Insert: {
          club_id: string
          competition: string
          created_at?: string
          data_version?: number
          external_id?: string | null
          id?: string
          last_synced_at?: string | null
          seasons?: string[]
          source: string
          source_id?: string | null
          source_updated_at?: string | null
          sync_status?: string
          title_count?: number
          updated_at?: string
        }
        Update: {
          club_id?: string
          competition?: string
          created_at?: string
          data_version?: number
          external_id?: string | null
          id?: string
          last_synced_at?: string | null
          seasons?: string[]
          source?: string
          source_id?: string | null
          source_updated_at?: string | null
          sync_status?: string
          title_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_honours_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          city: string | null
          competition_id: string | null
          country: string | null
          created_at: string
          crest_url: string | null
          data_source: string | null
          data_updated_at: string | null
          data_version: number
          description: string | null
          founded: number | null
          full_name: string | null
          id: string
          last_synced_at: string | null
          name: string
          primary_color: string
          secondary_color: string
          short_name: string
          source_id: string | null
          source_updated_at: string | null
          stadium_id: string | null
          strength: number
          sync_status: string
          updated_at: string
          website: string | null
        }
        Insert: {
          city?: string | null
          competition_id?: string | null
          country?: string | null
          created_at?: string
          crest_url?: string | null
          data_source?: string | null
          data_updated_at?: string | null
          data_version?: number
          description?: string | null
          founded?: number | null
          full_name?: string | null
          id: string
          last_synced_at?: string | null
          name: string
          primary_color?: string
          secondary_color?: string
          short_name: string
          source_id?: string | null
          source_updated_at?: string | null
          stadium_id?: string | null
          strength?: number
          sync_status?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          city?: string | null
          competition_id?: string | null
          country?: string | null
          created_at?: string
          crest_url?: string | null
          data_source?: string | null
          data_updated_at?: string | null
          data_version?: number
          description?: string | null
          founded?: number | null
          full_name?: string | null
          id?: string
          last_synced_at?: string | null
          name?: string
          primary_color?: string
          secondary_color?: string
          short_name?: string
          source_id?: string | null
          source_updated_at?: string | null
          stadium_id?: string | null
          strength?: number
          sync_status?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clubs_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clubs_stadium_id_fkey"
            columns: ["stadium_id"]
            isOneToOne: false
            referencedRelation: "stadiums"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_seasons: {
        Row: {
          champion_club_id: string | null
          competition_id: string
          created_at: string
          data_version: number
          ends_on: string | null
          id: string
          last_synced_at: string | null
          runner_up_club_id: string | null
          season: string
          source_id: string | null
          source_updated_at: string | null
          starts_on: string | null
          status: string
          sync_status: string
          updated_at: string
        }
        Insert: {
          champion_club_id?: string | null
          competition_id: string
          created_at?: string
          data_version?: number
          ends_on?: string | null
          id?: string
          last_synced_at?: string | null
          runner_up_club_id?: string | null
          season: string
          source_id?: string | null
          source_updated_at?: string | null
          starts_on?: string | null
          status?: string
          sync_status?: string
          updated_at?: string
        }
        Update: {
          champion_club_id?: string | null
          competition_id?: string
          created_at?: string
          data_version?: number
          ends_on?: string | null
          id?: string
          last_synced_at?: string | null
          runner_up_club_id?: string | null
          season?: string
          source_id?: string | null
          source_updated_at?: string | null
          starts_on?: string | null
          status?: string
          sync_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "competition_seasons_champion_club_id_fkey"
            columns: ["champion_club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_seasons_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_seasons_runner_up_club_id_fkey"
            columns: ["runner_up_club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      competitions: {
        Row: {
          club_count: number
          confederation: string | null
          country: string
          created_at: string
          data_version: number
          external_id: string | null
          external_source: string | null
          flag: string | null
          format: string | null
          id: string
          kind: string
          last_synced_at: string | null
          logo_url: string | null
          name: string
          source_id: string | null
          source_updated_at: string | null
          sync_status: string
          tier: number
          updated_at: string
        }
        Insert: {
          club_count?: number
          confederation?: string | null
          country: string
          created_at?: string
          data_version?: number
          external_id?: string | null
          external_source?: string | null
          flag?: string | null
          format?: string | null
          id: string
          kind?: string
          last_synced_at?: string | null
          logo_url?: string | null
          name: string
          source_id?: string | null
          source_updated_at?: string | null
          sync_status?: string
          tier?: number
          updated_at?: string
        }
        Update: {
          club_count?: number
          confederation?: string | null
          country?: string
          created_at?: string
          data_version?: number
          external_id?: string | null
          external_source?: string | null
          flag?: string | null
          format?: string | null
          id?: string
          kind?: string
          last_synced_at?: string | null
          logo_url?: string | null
          name?: string
          source_id?: string | null
          source_updated_at?: string | null
          sync_status?: string
          tier?: number
          updated_at?: string
        }
        Relationships: []
      }
      coupon_eligible_users: {
        Row: {
          code: string
          created_at: string
          expires_at: string | null
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string | null
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_eligible_users_code_fkey"
            columns: ["code"]
            isOneToOne: false
            referencedRelation: "game_coupons"
            referencedColumns: ["code"]
          },
        ]
      }
      coupon_redemptions: {
        Row: {
          code: string
          id: string
          redeemed_at: string
          user_id: string
        }
        Insert: {
          code: string
          id?: string
          redeemed_at?: string
          user_id: string
        }
        Update: {
          code?: string
          id?: string
          redeemed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_code_fkey"
            columns: ["code"]
            isOneToOne: false
            referencedRelation: "game_coupons"
            referencedColumns: ["code"]
          },
        ]
      }
      entitlement_ledger: {
        Row: {
          action: string
          cosmetic_family: string | null
          cosmetic_key: string | null
          created_at: string
          details: Json
          id: string
          idempotency_key: string
          occurred_at: string
          tier: string | null
          user_id: string
        }
        Insert: {
          action: string
          cosmetic_family?: string | null
          cosmetic_key?: string | null
          created_at?: string
          details?: Json
          id?: string
          idempotency_key: string
          occurred_at: string
          tier?: string | null
          user_id: string
        }
        Update: {
          action?: string
          cosmetic_family?: string | null
          cosmetic_key?: string | null
          created_at?: string
          details?: Json
          id?: string
          idempotency_key?: string
          occurred_at?: string
          tier?: string | null
          user_id?: string
        }
        Relationships: []
      }
      game_coupons: {
        Row: {
          active: boolean
          code: string
          coins: number
          created_at: string
          description: string
          ends_at: string | null
          max_redemptions: number | null
          redemption_count: number
          scout_reports: number
          starts_at: string | null
          training_boosts: number
        }
        Insert: {
          active?: boolean
          code: string
          coins?: number
          created_at?: string
          description: string
          ends_at?: string | null
          max_redemptions?: number | null
          redemption_count?: number
          scout_reports?: number
          starts_at?: string | null
          training_boosts?: number
        }
        Update: {
          active?: boolean
          code?: string
          coins?: number
          created_at?: string
          description?: string
          ends_at?: string | null
          max_redemptions?: number | null
          redemption_count?: number
          scout_reports?: number
          starts_at?: string | null
          training_boosts?: number
        }
        Relationships: []
      }
      guest_checkout_intents: {
        Row: {
          amount_cents: number
          claimed_at: string | null
          claimed_by_user_id: string | null
          consent_version: string
          contents_snapshot: Json
          created_at: string
          currency: string
          email_hash: string
          environment: string
          error: string | null
          expires_at: string
          id: string
          open_key: string | null
          product_key: string
          state: string
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_session_id: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          claimed_at?: string | null
          claimed_by_user_id?: string | null
          consent_version: string
          contents_snapshot: Json
          created_at?: string
          currency: string
          email_hash: string
          environment: string
          error?: string | null
          expires_at: string
          id?: string
          open_key?: string | null
          product_key: string
          state?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_session_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          claimed_at?: string | null
          claimed_by_user_id?: string | null
          consent_version?: string
          contents_snapshot?: Json
          created_at?: string
          currency?: string
          email_hash?: string
          environment?: string
          error?: string | null
          expires_at?: string
          id?: string
          open_key?: string | null
          product_key?: string
          state?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_session_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_checkout_intents_product_key_fkey"
            columns: ["product_key"]
            isOneToOne: false
            referencedRelation: "store_products"
            referencedColumns: ["key"]
          },
        ]
      }
      guest_checkout_rate_limits: {
        Row: {
          attempts: number
          email_hash: string
          updated_at: string
          window_started_at: string
        }
        Insert: {
          attempts?: number
          email_hash: string
          updated_at?: string
          window_started_at?: string
        }
        Update: {
          attempts?: number
          email_hash?: string
          updated_at?: string
          window_started_at?: string
        }
        Relationships: []
      }
      import_runs: {
        Row: {
          created_at: string
          error: string | null
          finished_at: string | null
          id: string
          items_imported: number
          scope: string | null
          source: string
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          items_imported?: number
          scope?: string | null
          source: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          items_imported?: number
          scope?: string | null
          source?: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      kits: {
        Row: {
          base_color: string
          club_id: string
          created_at: string
          data_version: number
          detail_color: string
          id: string
          image_url: string | null
          kind: string
          last_synced_at: string | null
          pattern: string
          season: string
          shorts_color: string
          socks_color: string
          source_id: string | null
          source_updated_at: string | null
          sync_status: string
          updated_at: string
        }
        Insert: {
          base_color?: string
          club_id: string
          created_at?: string
          data_version?: number
          detail_color?: string
          id?: string
          image_url?: string | null
          kind?: string
          last_synced_at?: string | null
          pattern?: string
          season?: string
          shorts_color?: string
          socks_color?: string
          source_id?: string | null
          source_updated_at?: string | null
          sync_status?: string
          updated_at?: string
        }
        Update: {
          base_color?: string
          club_id?: string
          created_at?: string
          data_version?: number
          detail_color?: string
          id?: string
          image_url?: string | null
          kind?: string
          last_synced_at?: string | null
          pattern?: string
          season?: string
          shorts_color?: string
          socks_color?: string
          source_id?: string | null
          source_updated_at?: string | null
          sync_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kits_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      match_room_secrets: {
        Row: {
          room_id: string
          seed: string
        }
        Insert: {
          room_id: string
          seed: string
        }
        Update: {
          room_id?: string
          seed?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_room_secrets_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: true
            referencedRelation: "match_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      match_rooms: {
        Row: {
          code: string
          created_at: string
          guest_club: string | null
          guest_id: string | null
          host_club: string
          host_id: string
          id: string
          minute: number
          seed: string
          server_seeded: boolean
          state: Json
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          guest_club?: string | null
          guest_id?: string | null
          host_club: string
          host_id: string
          id?: string
          minute?: number
          seed: string
          server_seeded?: boolean
          state?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          guest_club?: string | null
          guest_id?: string | null
          host_club?: string
          host_id?: string
          id?: string
          minute?: number
          seed?: string
          server_seeded?: boolean
          state?: Json
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      official_equipment: {
        Row: {
          image_url: string | null
          kind: string | null
          season: string | null
          source_id: string
          source_updated_at: string | null
          team_source_id: string | null
          updated_at: string
        }
        Insert: {
          image_url?: string | null
          kind?: string | null
          season?: string | null
          source_id: string
          source_updated_at?: string | null
          team_source_id?: string | null
          updated_at?: string
        }
        Update: {
          image_url?: string | null
          kind?: string | null
          season?: string | null
          source_id?: string
          source_updated_at?: string | null
          team_source_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      official_event_aliases: {
        Row: {
          canonical_source_id: string
          reason: string
          reviewed_at: string
          source_id: string
        }
        Insert: {
          canonical_source_id: string
          reason?: string
          reviewed_at?: string
          source_id: string
        }
        Update: {
          canonical_source_id?: string
          reason?: string
          reviewed_at?: string
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "official_event_aliases_canonical_source_id_fkey"
            columns: ["canonical_source_id"]
            isOneToOne: false
            referencedRelation: "official_events"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "official_event_aliases_canonical_source_id_fkey"
            columns: ["canonical_source_id"]
            isOneToOne: false
            referencedRelation: "official_events_catalog"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "official_event_aliases_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: true
            referencedRelation: "official_events"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "official_event_aliases_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: true
            referencedRelation: "official_events_catalog"
            referencedColumns: ["source_id"]
          },
        ]
      }
      official_event_details: {
        Row: {
          detail_type: string
          event_source_id: string
          label: string | null
          minute: number | null
          payload: Json
          player_source_id: string | null
          source_id: string
          source_updated_at: string | null
          team_source_id: string | null
          updated_at: string
        }
        Insert: {
          detail_type: string
          event_source_id: string
          label?: string | null
          minute?: number | null
          payload?: Json
          player_source_id?: string | null
          source_id: string
          source_updated_at?: string | null
          team_source_id?: string | null
          updated_at?: string
        }
        Update: {
          detail_type?: string
          event_source_id?: string
          label?: string | null
          minute?: number | null
          payload?: Json
          player_source_id?: string | null
          source_id?: string
          source_updated_at?: string | null
          team_source_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "official_event_details_event_source_id_fkey"
            columns: ["event_source_id"]
            isOneToOne: false
            referencedRelation: "official_events"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "official_event_details_event_source_id_fkey"
            columns: ["event_source_id"]
            isOneToOne: false
            referencedRelation: "official_events_catalog"
            referencedColumns: ["source_id"]
          },
        ]
      }
      official_events: {
        Row: {
          away_score: number | null
          away_team_name: string | null
          away_team_source_id: string | null
          home_score: number | null
          home_team_name: string | null
          home_team_source_id: string | null
          league_source_id: string
          season: string
          source_id: string
          source_updated_at: string | null
          starts_at: string | null
          status: string | null
          updated_at: string
          venue_name: string | null
          venue_source_id: string | null
        }
        Insert: {
          away_score?: number | null
          away_team_name?: string | null
          away_team_source_id?: string | null
          home_score?: number | null
          home_team_name?: string | null
          home_team_source_id?: string | null
          league_source_id: string
          season: string
          source_id: string
          source_updated_at?: string | null
          starts_at?: string | null
          status?: string | null
          updated_at?: string
          venue_name?: string | null
          venue_source_id?: string | null
        }
        Update: {
          away_score?: number | null
          away_team_name?: string | null
          away_team_source_id?: string | null
          home_score?: number | null
          home_team_name?: string | null
          home_team_source_id?: string | null
          league_source_id?: string
          season?: string
          source_id?: string
          source_updated_at?: string | null
          starts_at?: string | null
          status?: string | null
          updated_at?: string
          venue_name?: string | null
          venue_source_id?: string | null
        }
        Relationships: []
      }
      official_leagues: {
        Row: {
          country: string | null
          current_season: string | null
          local_competition_id: string | null
          name: string
          source_id: string
          source_updated_at: string | null
          sport: string
          updated_at: string
        }
        Insert: {
          country?: string | null
          current_season?: string | null
          local_competition_id?: string | null
          name: string
          source_id: string
          source_updated_at?: string | null
          sport: string
          updated_at?: string
        }
        Update: {
          country?: string | null
          current_season?: string | null
          local_competition_id?: string | null
          name?: string
          source_id?: string
          source_updated_at?: string | null
          sport?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "official_leagues_local_competition_id_fkey"
            columns: ["local_competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
        ]
      }
      official_media: {
        Row: {
          entity_type: string
          kind: string
          parent_source_id: string
          source: string
          source_id: string
          source_updated_at: string | null
          updated_at: string
          url: string
        }
        Insert: {
          entity_type: string
          kind: string
          parent_source_id?: string
          source?: string
          source_id: string
          source_updated_at?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          entity_type?: string
          kind?: string
          parent_source_id?: string
          source?: string
          source_id?: string
          source_updated_at?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      official_players: {
        Row: {
          birth_date: string | null
          name: string
          nationality: string | null
          photo_url: string | null
          position: string | null
          source_id: string
          source_updated_at: string | null
          sport: string
          team_source_id: string | null
          team_source_is_explicit: boolean
          team_source_priority: number
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          name: string
          nationality?: string | null
          photo_url?: string | null
          position?: string | null
          source_id: string
          source_updated_at?: string | null
          sport?: string
          team_source_id?: string | null
          team_source_is_explicit?: boolean
          team_source_priority?: number
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          name?: string
          nationality?: string | null
          photo_url?: string | null
          position?: string | null
          source_id?: string
          source_updated_at?: string | null
          sport?: string
          team_source_id?: string | null
          team_source_is_explicit?: boolean
          team_source_priority?: number
          updated_at?: string
        }
        Relationships: []
      }
      official_seasons: {
        Row: {
          league_source_id: string
          season: string
          source_updated_at: string | null
          updated_at: string
        }
        Insert: {
          league_source_id: string
          season: string
          source_updated_at?: string | null
          updated_at?: string
        }
        Update: {
          league_source_id?: string
          season?: string
          source_updated_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      official_teams: {
        Row: {
          league_source_id: string | null
          local_club_id: string | null
          name: string
          source_id: string
          source_updated_at: string | null
          sport: string
          updated_at: string
          venue_source_id: string | null
        }
        Insert: {
          league_source_id?: string | null
          local_club_id?: string | null
          name: string
          source_id: string
          source_updated_at?: string | null
          sport?: string
          updated_at?: string
          venue_source_id?: string | null
        }
        Update: {
          league_source_id?: string | null
          local_club_id?: string | null
          name?: string
          source_id?: string
          source_updated_at?: string | null
          sport?: string
          updated_at?: string
          venue_source_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "official_teams_local_club_id_fkey"
            columns: ["local_club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      official_venues: {
        Row: {
          capacity: number | null
          city: string | null
          country: string | null
          name: string
          photo_url: string | null
          source_id: string
          source_updated_at: string | null
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          city?: string | null
          country?: string | null
          name: string
          photo_url?: string | null
          source_id: string
          source_updated_at?: string | null
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          city?: string | null
          country?: string | null
          name?: string
          photo_url?: string | null
          source_id?: string
          source_updated_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payment_webhook_events: {
        Row: {
          attempts: number
          created_at: string
          event_id: string
          event_type: string
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          event_id: string
          event_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          event_id?: string
          event_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      player_career_clubs: {
        Row: {
          appearances: number | null
          badge_url: string | null
          departed: string | null
          goals: number | null
          id: string
          joined: string | null
          last_synced_at: string
          move_type: string | null
          player_id: string
          source: string
          source_id: string
          team_name: string
        }
        Insert: {
          appearances?: number | null
          badge_url?: string | null
          departed?: string | null
          goals?: number | null
          id?: string
          joined?: string | null
          last_synced_at?: string
          move_type?: string | null
          player_id: string
          source?: string
          source_id: string
          team_name: string
        }
        Update: {
          appearances?: number | null
          badge_url?: string | null
          departed?: string | null
          goals?: number | null
          id?: string
          joined?: string | null
          last_synced_at?: string
          move_type?: string | null
          player_id?: string
          source?: string
          source_id?: string
          team_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_career_clubs_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_career_clubs_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      player_career_revisions: {
        Row: {
          created_at: string
          operation: string
          revision: number
          slot: number
          state: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          operation: string
          revision: number
          slot: number
          state: Json
          user_id: string
        }
        Update: {
          created_at?: string
          operation?: string
          revision?: number
          slot?: number
          state?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_career_revisions_user_id_slot_fkey"
            columns: ["user_id", "slot"]
            isOneToOne: false
            referencedRelation: "player_careers"
            referencedColumns: ["user_id", "slot"]
          },
        ]
      }
      player_careers: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          slot: number
          state: Json
          sync_revision: number
          updated_at: string
          user_id: string
          verified_progress: boolean
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          slot: number
          state: Json
          sync_revision?: number
          updated_at?: string
          user_id: string
          verified_progress?: boolean
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          slot?: number
          state?: Json
          sync_revision?: number
          updated_at?: string
          user_id?: string
          verified_progress?: boolean
        }
        Relationships: []
      }
      player_honours: {
        Row: {
          honour: string
          id: string
          last_synced_at: string
          player_id: string
          season: string | null
          source: string
          source_id: string
          team_name: string | null
          trophy_url: string | null
        }
        Insert: {
          honour: string
          id?: string
          last_synced_at?: string
          player_id: string
          season?: string | null
          source?: string
          source_id: string
          team_name?: string | null
          trophy_url?: string | null
        }
        Update: {
          honour?: string
          id?: string
          last_synced_at?: string
          player_id?: string
          season?: string | null
          source?: string
          source_id?: string
          team_name?: string | null
          trophy_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "player_honours_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_honours_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      player_identity_aliases: {
        Row: {
          canonical_player_id: string
          match_rule: string
          player_id: string
          reviewed_at: string
          source: string | null
          source_id: string | null
        }
        Insert: {
          canonical_player_id: string
          match_rule?: string
          player_id: string
          reviewed_at?: string
          source?: string | null
          source_id?: string | null
        }
        Update: {
          canonical_player_id?: string
          match_rule?: string
          player_id?: string
          reviewed_at?: string
          source?: string | null
          source_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "player_identity_aliases_canonical_player_id_fkey"
            columns: ["canonical_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_identity_aliases_canonical_player_id_fkey"
            columns: ["canonical_player_id"]
            isOneToOne: false
            referencedRelation: "players_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_identity_aliases_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_identity_aliases_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "players_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      player_profiles: {
        Row: {
          birth_year: number | null
          created_at: string
          guardian_approved_at: string | null
          guardian_email: string | null
          nickname: string | null
          supervised: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          birth_year?: number | null
          created_at?: string
          guardian_approved_at?: string | null
          guardian_email?: string | null
          nickname?: string | null
          supervised?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          birth_year?: number | null
          created_at?: string
          guardian_approved_at?: string | null
          guardian_email?: string | null
          nickname?: string | null
          supervised?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      player_season_stats: {
        Row: {
          appearances: number
          assists: number
          clean_sheets: number
          club_id: string | null
          competition_id: string | null
          created_at: string
          data_version: number
          goals: number
          id: string
          last_synced_at: string | null
          minutes: number
          player_id: string
          rating: number | null
          red_cards: number
          season: string
          source: string | null
          source_id: string | null
          source_updated_at: string | null
          starts: number
          sync_status: string
          updated_at: string
          yellow_cards: number
        }
        Insert: {
          appearances?: number
          assists?: number
          clean_sheets?: number
          club_id?: string | null
          competition_id?: string | null
          created_at?: string
          data_version?: number
          goals?: number
          id?: string
          last_synced_at?: string | null
          minutes?: number
          player_id: string
          rating?: number | null
          red_cards?: number
          season: string
          source?: string | null
          source_id?: string | null
          source_updated_at?: string | null
          starts?: number
          sync_status?: string
          updated_at?: string
          yellow_cards?: number
        }
        Update: {
          appearances?: number
          assists?: number
          clean_sheets?: number
          club_id?: string | null
          competition_id?: string | null
          created_at?: string
          data_version?: number
          goals?: number
          id?: string
          last_synced_at?: string | null
          minutes?: number
          player_id?: string
          rating?: number | null
          red_cards?: number
          season?: string
          source?: string | null
          source_id?: string | null
          source_updated_at?: string | null
          starts?: number
          sync_status?: string
          updated_at?: string
          yellow_cards?: number
        }
        Relationships: [
          {
            foreignKeyName: "player_season_stats_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_season_stats_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_season_stats_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_season_stats_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          age: number
          birth_date: string | null
          canonical_player_id: string | null
          club_id: string
          created_at: string
          data_version: number
          height_cm: number | null
          id: string
          last_synced_at: string | null
          name: string
          nationality: string | null
          overall: number
          overall_breakdown: Json
          photo_url: string | null
          position: string
          potential: number | null
          preferred_foot: string | null
          shirt_number: number | null
          source: string | null
          source_id: string | null
          source_kind: string
          source_updated_at: string | null
          sync_status: string
          updated_at: string
        }
        Insert: {
          age?: number
          birth_date?: string | null
          canonical_player_id?: string | null
          club_id: string
          created_at?: string
          data_version?: number
          height_cm?: number | null
          id?: string
          last_synced_at?: string | null
          name: string
          nationality?: string | null
          overall?: number
          overall_breakdown?: Json
          photo_url?: string | null
          position: string
          potential?: number | null
          preferred_foot?: string | null
          shirt_number?: number | null
          source?: string | null
          source_id?: string | null
          source_kind?: string
          source_updated_at?: string | null
          sync_status?: string
          updated_at?: string
        }
        Update: {
          age?: number
          birth_date?: string | null
          canonical_player_id?: string | null
          club_id?: string
          created_at?: string
          data_version?: number
          height_cm?: number | null
          id?: string
          last_synced_at?: string | null
          name?: string
          nationality?: string | null
          overall?: number
          overall_breakdown?: Json
          photo_url?: string | null
          position?: string
          potential?: number | null
          preferred_foot?: string | null
          shirt_number?: number | null
          source?: string | null
          source_id?: string | null
          source_kind?: string
          source_updated_at?: string | null
          sync_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "players_canonical_player_id_fkey"
            columns: ["canonical_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_canonical_player_id_fkey"
            columns: ["canonical_player_id"]
            isOneToOne: false
            referencedRelation: "players_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          preferences: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          preferences?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          preferences?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      purchase_payment_reviews: {
        Row: {
          event_created: number
          event_id: string
          reference: string
          refunded_amount_cents: number
          review_status: string
          updated_at: string
        }
        Insert: {
          event_created: number
          event_id: string
          reference: string
          refunded_amount_cents?: number
          review_status: string
          updated_at?: string
        }
        Update: {
          event_created?: number
          event_id?: string
          reference?: string
          refunded_amount_cents?: number
          review_status?: string
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          created_at: string
          id: string
          token: string
          topics: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          token: string
          topics?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          token?: string
          topics?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sportsdb_archives: {
        Row: {
          archive_key: string
          attempts: number
          hydrated_at: string | null
          last_error: string | null
          retry_at: string
          source_updated_at: string
          status: string
        }
        Insert: {
          archive_key: string
          attempts?: number
          hydrated_at?: string | null
          last_error?: string | null
          retry_at?: string
          source_updated_at: string
          status?: string
        }
        Update: {
          archive_key?: string
          attempts?: number
          hydrated_at?: string | null
          last_error?: string | null
          retry_at?: string
          source_updated_at?: string
          status?: string
        }
        Relationships: []
      }
      sportsdb_bridge_control: {
        Row: {
          enabled: boolean
          last_error: string | null
          lease_owner: string | null
          lease_until: string | null
          max_database_bytes: number
          singleton: boolean
          source_complete: boolean
          source_status: Json
          status: string
          token_sha256: string
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          last_error?: string | null
          lease_owner?: string | null
          lease_until?: string | null
          max_database_bytes?: number
          singleton?: boolean
          source_complete?: boolean
          source_status?: Json
          status?: string
          token_sha256: string
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          last_error?: string | null
          lease_owner?: string | null
          lease_until?: string | null
          max_database_bytes?: number
          singleton?: boolean
          source_complete?: boolean
          source_status?: Json
          status?: string
          token_sha256?: string
          updated_at?: string
        }
        Relationships: []
      }
      sportsdb_club_identity_aliases: {
        Row: {
          alias_id: string
          canonical_id: string
          created_at: string
          reason: string
        }
        Insert: {
          alias_id: string
          canonical_id: string
          created_at?: string
          reason: string
        }
        Update: {
          alias_id?: string
          canonical_id?: string
          created_at?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "sportsdb_club_identity_aliases_alias_id_fkey"
            columns: ["alias_id"]
            isOneToOne: true
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sportsdb_club_identity_aliases_canonical_id_fkey"
            columns: ["canonical_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      sportsdb_competition_identity_aliases: {
        Row: {
          alias_id: string
          canonical_id: string
          created_at: string
          reason: string
        }
        Insert: {
          alias_id: string
          canonical_id: string
          created_at?: string
          reason: string
        }
        Update: {
          alias_id?: string
          canonical_id?: string
          created_at?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "sportsdb_competition_identity_aliases_alias_id_fkey"
            columns: ["alias_id"]
            isOneToOne: true
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sportsdb_competition_identity_aliases_canonical_id_fkey"
            columns: ["canonical_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
        ]
      }
      sportsdb_data_corrections: {
        Row: {
          before_row: Json
          correction_key: string
          created_at: string
          id: number
          reason: string
          source_id: string
          table_name: string
        }
        Insert: {
          before_row: Json
          correction_key: string
          created_at?: string
          id?: never
          reason: string
          source_id: string
          table_name: string
        }
        Update: {
          before_row?: Json
          correction_key?: string
          created_at?: string
          id?: never
          reason?: string
          source_id?: string
          table_name?: string
        }
        Relationships: []
      }
      sportsdb_import_cursors: {
        Row: {
          entity_type: string
          fingerprint: string
          last_serviced_at: string | null
          next_offset: number
          priority: number
          source_total: number
          status: string
          updated_at: string
        }
        Insert: {
          entity_type: string
          fingerprint: string
          last_serviced_at?: string | null
          next_offset?: number
          priority: number
          source_total?: number
          status?: string
          updated_at?: string
        }
        Update: {
          entity_type?: string
          fingerprint?: string
          last_serviced_at?: string | null
          next_offset?: number
          priority?: number
          source_total?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      sportsdb_player_aliases: {
        Row: {
          alias_source_id: string
          canonical_source_id: string
          created_at: string
          original_record: Json
          reason: string
        }
        Insert: {
          alias_source_id: string
          canonical_source_id: string
          created_at?: string
          original_record: Json
          reason?: string
        }
        Update: {
          alias_source_id?: string
          canonical_source_id?: string
          created_at?: string
          original_record?: Json
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "sportsdb_player_aliases_canonical_source_id_fkey"
            columns: ["canonical_source_id"]
            isOneToOne: false
            referencedRelation: "official_players"
            referencedColumns: ["source_id"]
          },
        ]
      }
      sportsdb_player_overrides: {
        Row: {
          birth_date_locked: boolean
          birth_date_override: string | null
          reason: string
          source_id: string
          team_source_id_locked: boolean
          team_source_id_override: string | null
          updated_at: string
        }
        Insert: {
          birth_date_locked?: boolean
          birth_date_override?: string | null
          reason: string
          source_id: string
          team_source_id_locked?: boolean
          team_source_id_override?: string | null
          updated_at?: string
        }
        Update: {
          birth_date_locked?: boolean
          birth_date_override?: string | null
          reason?: string
          source_id?: string
          team_source_id_locked?: boolean
          team_source_id_override?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      stadiums: {
        Row: {
          capacity: number | null
          city: string | null
          country: string | null
          created_at: string
          data_version: number
          id: string
          last_synced_at: string | null
          name: string
          photo_url: string | null
          source_id: string | null
          source_updated_at: string | null
          sync_status: string
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          city?: string | null
          country?: string | null
          created_at?: string
          data_version?: number
          id?: string
          last_synced_at?: string | null
          name: string
          photo_url?: string | null
          source_id?: string | null
          source_updated_at?: string | null
          sync_status?: string
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          city?: string | null
          country?: string | null
          created_at?: string
          data_version?: number
          id?: string
          last_synced_at?: string | null
          name?: string
          photo_url?: string | null
          source_id?: string | null
          source_updated_at?: string | null
          sync_status?: string
          updated_at?: string
        }
        Relationships: []
      }
      store_products: {
        Row: {
          active: boolean
          coins: number
          contents: Json | null
          created_at: string
          currency: string
          description: string
          id: string
          key: string
          kind: string
          name: string
          price_cents: number
          sale_ends_at: string | null
          sale_percent_off: number | null
          sale_starts_at: string | null
          stripe_lookup_key: string
        }
        Insert: {
          active?: boolean
          coins?: number
          contents?: Json | null
          created_at?: string
          currency?: string
          description?: string
          id?: string
          key: string
          kind?: string
          name: string
          price_cents?: number
          sale_ends_at?: string | null
          sale_percent_off?: number | null
          sale_starts_at?: string | null
          stripe_lookup_key: string
        }
        Update: {
          active?: boolean
          coins?: number
          contents?: Json | null
          created_at?: string
          currency?: string
          description?: string
          id?: string
          key?: string
          kind?: string
          name?: string
          price_cents?: number
          sale_ends_at?: string | null
          sale_percent_off?: number | null
          sale_starts_at?: string | null
          stripe_lookup_key?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          price_id: string
          product_id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id: string
          product_id: string
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id?: string
          product_id?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tech_telemetry: {
        Row: {
          app_version: string | null
          browser: string | null
          created_at: string
          error_code: string | null
          fps_avg: number | null
          frame_time_p95_ms: number | null
          gpu_tier: number | null
          graphics_preset: string | null
          id: string
          load_time_ms: number | null
          measurement_origin: string
          user_id: string | null
        }
        Insert: {
          app_version?: string | null
          browser?: string | null
          created_at?: string
          error_code?: string | null
          fps_avg?: number | null
          frame_time_p95_ms?: number | null
          gpu_tier?: number | null
          graphics_preset?: string | null
          id?: string
          load_time_ms?: number | null
          measurement_origin?: string
          user_id?: string | null
        }
        Update: {
          app_version?: string | null
          browser?: string | null
          created_at?: string
          error_code?: string | null
          fps_avg?: number | null
          frame_time_p95_ms?: number | null
          gpu_tier?: number | null
          graphics_preset?: string | null
          id?: string
          load_time_ms?: number | null
          measurement_origin?: string
          user_id?: string | null
        }
        Relationships: []
      }
      tech_telemetry_rate_limits: {
        Row: {
          accepted: number
          bucket: string
          updated_at: string
          window_started_at: string
        }
        Insert: {
          accepted?: number
          bucket: string
          updated_at?: string
          window_started_at: string
        }
        Update: {
          accepted?: number
          bucket?: string
          updated_at?: string
          window_started_at?: string
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          achievement_key: string
          id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_key: string
          id?: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_key?: string
          id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_blocks: {
        Row: {
          blocked_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          blocked_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          blocked_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_boosts: {
        Row: {
          training_until: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          training_until?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          training_until?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_cosmetic_grants: {
        Row: {
          cosmetic_family: string
          cosmetic_key: string
          created_at: string
          id: string
          permanent: boolean
          source_reference: string
          updated_at: string
          user_id: string
          valid_until: string | null
        }
        Insert: {
          cosmetic_family: string
          cosmetic_key: string
          created_at?: string
          id?: string
          permanent?: boolean
          source_reference: string
          updated_at?: string
          user_id: string
          valid_until?: string | null
        }
        Update: {
          cosmetic_family?: string
          cosmetic_key?: string
          created_at?: string
          id?: string
          permanent?: boolean
          source_reference?: string
          updated_at?: string
          user_id?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      user_entitlements: {
        Row: {
          tier: string
          updated_at: string
          user_id: string
          valid_until: string | null
        }
        Insert: {
          tier?: string
          updated_at?: string
          user_id: string
          valid_until?: string | null
        }
        Update: {
          tier?: string
          updated_at?: string
          user_id?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      user_equipped_cosmetics: {
        Row: {
          cosmetic_family: string
          cosmetic_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cosmetic_family: string
          cosmetic_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cosmetic_family?: string
          cosmetic_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_equipped_cosmetics_user_id_cosmetic_key_cosmetic_fami_fkey"
            columns: ["user_id", "cosmetic_key", "cosmetic_family"]
            isOneToOne: false
            referencedRelation: "user_cosmetic_grants"
            referencedColumns: ["user_id", "cosmetic_key", "cosmetic_family"]
          },
        ]
      }
      user_purchases: {
        Row: {
          amount_cents: number
          created_at: string
          error: string | null
          id: string
          product_key: string
          reference: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents?: number
          created_at?: string
          error?: string | null
          id?: string
          product_key: string
          reference?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          error?: string | null
          id?: string
          product_key?: string
          reference?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_wallet: {
        Row: {
          coins: number
          scout_reports: number
          season_pass: boolean
          season_pass_until: string | null
          training_boosts: number
          unlocked_themes: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          coins?: number
          scout_reports?: number
          season_pass?: boolean
          season_pass_until?: string | null
          training_boosts?: number
          unlocked_themes?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          coins?: number
          scout_reports?: number
          season_pass?: boolean
          season_pass_until?: string | null
          training_boosts?: number
          unlocked_themes?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wallet_item_log: {
        Row: {
          created_at: string
          detail: string | null
          id: string
          item: string
          user_id: string
        }
        Insert: {
          created_at?: string
          detail?: string | null
          id?: string
          item: string
          user_id: string
        }
        Update: {
          created_at?: string
          detail?: string | null
          id?: string
          item?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      official_events_catalog: {
        Row: {
          away_score: number | null
          away_team_name: string | null
          away_team_source_id: string | null
          home_score: number | null
          home_team_name: string | null
          home_team_source_id: string | null
          league_source_id: string | null
          season: string | null
          source_id: string | null
          source_updated_at: string | null
          starts_at: string | null
          status: string | null
          updated_at: string | null
          venue_name: string | null
          venue_source_id: string | null
        }
        Insert: {
          away_score?: number | null
          away_team_name?: string | null
          away_team_source_id?: string | null
          home_score?: number | null
          home_team_name?: string | null
          home_team_source_id?: string | null
          league_source_id?: string | null
          season?: string | null
          source_id?: string | null
          source_updated_at?: string | null
          starts_at?: string | null
          status?: string | null
          updated_at?: string | null
          venue_name?: string | null
          venue_source_id?: string | null
        }
        Update: {
          away_score?: number | null
          away_team_name?: string | null
          away_team_source_id?: string | null
          home_score?: number | null
          home_team_name?: string | null
          home_team_source_id?: string | null
          league_source_id?: string | null
          season?: string | null
          source_id?: string | null
          source_updated_at?: string | null
          starts_at?: string | null
          status?: string | null
          updated_at?: string | null
          venue_name?: string | null
          venue_source_id?: string | null
        }
        Relationships: []
      }
      players_catalog: {
        Row: {
          age: number | null
          birth_date: string | null
          canonical_player_id: string | null
          club_id: string | null
          created_at: string | null
          data_version: number | null
          height_cm: number | null
          id: string | null
          last_synced_at: string | null
          name: string | null
          nationality: string | null
          overall: number | null
          overall_breakdown: Json | null
          photo_url: string | null
          position: string | null
          potential: number | null
          preferred_foot: string | null
          shirt_number: number | null
          source: string | null
          source_id: string | null
          source_kind: string | null
          source_updated_at: string | null
          sync_status: string | null
          updated_at: string | null
        }
        Insert: {
          age?: number | null
          birth_date?: string | null
          canonical_player_id?: string | null
          club_id?: string | null
          created_at?: string | null
          data_version?: number | null
          height_cm?: number | null
          id?: string | null
          last_synced_at?: string | null
          name?: string | null
          nationality?: string | null
          overall?: number | null
          overall_breakdown?: Json | null
          photo_url?: string | null
          position?: string | null
          potential?: number | null
          preferred_foot?: string | null
          shirt_number?: number | null
          source?: string | null
          source_id?: string | null
          source_kind?: string | null
          source_updated_at?: string | null
          sync_status?: string | null
          updated_at?: string | null
        }
        Update: {
          age?: number | null
          birth_date?: string | null
          canonical_player_id?: string | null
          club_id?: string | null
          created_at?: string | null
          data_version?: number | null
          height_cm?: number | null
          id?: string | null
          last_synced_at?: string | null
          name?: string | null
          nationality?: string | null
          overall?: number | null
          overall_breakdown?: Json | null
          photo_url?: string | null
          position?: string | null
          potential?: number | null
          preferred_foot?: string | null
          shirt_number?: number | null
          source?: string | null
          source_id?: string | null
          source_kind?: string | null
          source_updated_at?: string | null
          sync_status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "players_canonical_player_id_fkey"
            columns: ["canonical_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_canonical_player_id_fkey"
            columns: ["canonical_player_id"]
            isOneToOne: false
            referencedRelation: "players_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      activate_training_boost: {
        Args: { _user_id: string }
        Returns: {
          training_boosts: number
          training_until: string
        }[]
      }
      backfill_existing_football_venues: {
        Args: { p_after?: string; p_limit?: number }
        Returns: {
          last_id: string
          materialized: number
          processed: number
        }[]
      }
      backfill_football_birth_dates: {
        Args: { p_after?: string; p_limit?: number }
        Returns: {
          last_id: string
          processed: number
          updated: number
        }[]
      }
      begin_payment_webhook_event: {
        Args: { _event_id: string; _event_type: string }
        Returns: boolean
      }
      claim_api_football_import_phase: {
        Args: never
        Returns: {
          out_limit: number
          out_offset: number
          out_phase: string
          out_token: string
        }[]
      }
      complete_api_football_import_phase: {
        Args: {
          p_error?: string | null
          p_next_offset: number | null
          p_phase: string
          p_processed: number
          p_token: string
        }
        Returns: boolean
      }
      consume_wallet_item: {
        Args: { _detail?: string; _item: string; _user_id: string }
        Returns: {
          scout_reports: number
          training_boosts: number
        }[]
      }
      enrich_existing_football_profiles: {
        Args: { p_profiles: Json }
        Returns: number
      }
      enrich_football_venues: { Args: { p_venues: Json }; Returns: number }
      finish_payment_webhook_event: {
        Args: { _event_id: string; _succeeded: boolean }
        Returns: undefined
      }
      football_queue_activate: {
        Args: { p_enabled: boolean }
        Returns: boolean
      }
      football_queue_cache: {
        Args: { p_hash: string; p_path: string; p_text: string }
        Returns: boolean
      }
      football_queue_cache_page: {
        Args: { p_body: Json; p_lease: string; p_path: string }
        Returns: undefined
      }
      football_queue_claim: { Args: never; Returns: Json }
      football_queue_configure: {
        Args: {
          p_daily: number
          p_key: string
          p_minute: number
          p_url: string
        }
        Returns: Json
      }
      football_queue_defer: {
        Args: {
          p_budget?: boolean
          p_code: string
          p_lease: string
          p_path: string
          p_wait: number
        }
        Returns: undefined
      }
      football_queue_finish: {
        Args: {
          p_children: Json
          p_lease: string
          p_path: string
          p_received: number
          p_remaining?: number
          p_requests: number
          p_writes: Json
        }
        Returns: Json
      }
      football_queue_reserve: { Args: never; Returns: undefined }
      football_queue_reserve_job: {
        Args: { p_lease: string; p_path: string }
        Returns: undefined
      }
      football_queue_seed: { Args: { p_jobs: Json }; Returns: Json }
      football_queue_settings: {
        Args: { p_admin?: boolean; p_hash: string }
        Returns: Json
      }
      football_queue_status: { Args: never; Returns: Json }
      football_queue_window: { Args: { p_summary: Json }; Returns: undefined }
      fulfill_store_purchase: {
        Args: {
          _amount_cents: number
          _coins: number
          _product_key: string
          _reference: string
          _scout_reports: number
          _themes: string[]
          _training_boosts: number
          _user_id: string
        }
        Returns: boolean
      }
      get_own_activity_ranking: {
        Args: never
        Returns: {
          active_seconds: number
          active_streak: number
          club_id: string
          matches_completed: number
          opted_in: boolean
          public_name: string
          weekly_active_seconds: number
          wins: number
        }[]
      }
      get_public_activity_rankings: {
        Args: { p_limit?: number }
        Returns: {
          active_streak: number
          club_id: string
          matches_completed: number
          public_name: string
          rank: number
          weekly_active_seconds: number
          wins: number
        }[]
      }
      get_public_league_digest_source: {
        Args: { p_league_ids: number[] }
        Returns: {
          injury_count: number
          league_id: number
          payload: Json
        }[]
      }
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
      ingest_api_football: {
        Args: {
          p_action: string
          p_payload: Json
          p_run: string
          p_token_hash: string
        }
        Returns: Json
      }
      jm_consume_sms_hook_budget: {
        Args: { p_channel: string; p_global_hmac: string; p_phone_hmac: string }
        Returns: {
          allowed: boolean
          reason: string
          retry_after_seconds: number
        }[]
      }
      jm_resend_webhook_signing_key: { Args: never; Returns: string }
      jm_store_resend_delivery_event: {
        Args: { p_email_id?: string; p_event_id: string; p_event_type: string }
        Returns: boolean
      }
      list_api_football_league_targets: {
        Args: { p_limit: number; p_offset: number }
        Returns: {
          country: string
          coverage: Json
          current_season: string
          local_competition_id: string
          source_id: string
        }[]
      }
      list_api_football_team_targets: {
        Args: { p_limit: number; p_offset: number; p_squads_only?: boolean }
        Returns: {
          league_source_id: string
          local_club_id: string
          source_id: string
        }[]
      }
      mutate_player_career: {
        Args: {
          p_expected_revision: number
          p_operation: string
          p_slot: number
          p_state?: Json
        }
        Returns: {
          new_revision: number
          status: string
        }[]
      }
      reconcile_football_player_aliases: {
        Args: { p_limit?: number; p_source_ids?: string[] }
        Returns: number
      }
      reconcile_football_profile_names: {
        Args: { p_limit?: number; p_source_ids?: string[] }
        Returns: number
      }
      reconcile_purchase_payment_review: {
        Args: {
          _event_created: number
          _event_id: string
          _event_type: string
          _reference: string
          _refunded_amount_cents?: number
        }
        Returns: undefined
      }
      reconcile_subscription_wallet: {
        Args: { _environment: string; _user_id: string }
        Returns: boolean
      }
      record_active_time: {
        Args: {
          p_club_id: string
          p_matches_completed?: number
          p_matches_started?: number
          p_public_name: string
          p_seasons?: number
          p_wins?: number
        }
        Returns: undefined
      }
      redeem_game_coupon: { Args: { _code: string }; Returns: Json }
      reserve_ai_budget: {
        Args: { _cents: number; _kind: string }
        Returns: boolean
      }
      reserve_api_football_quota: { Args: never; Returns: boolean }
      reserve_guest_checkout_attempt: {
        Args: { _email_hash: string }
        Returns: boolean
      }
      reserve_guest_checkout_claim: {
        Args: { _intent_id: string; _user_id: string }
        Returns: boolean
      }
      reserve_tech_telemetry_slot: {
        Args: { _bucket: string }
        Returns: boolean
      }
      reserve_voice_request: { Args: { p_user_id: string }; Returns: boolean }
      restore_lovable_batch: {
        Args: {
          p_batch: number
          p_columns: string[]
          p_hash: string
          p_rows: Json
          p_run: string
          p_target: string
          p_token_hash: string
        }
        Returns: Json
      }
      send_chat_message_for: {
        Args: { _user_id: string; message_body: string }
        Returns: string
      }
      set_activity_ranking_preferences: {
        Args: { p_club_id: string; p_opted_in: boolean; p_public_name: string }
        Returns: undefined
      }
      spend_coins_for: {
        Args: { _user_id: string; amount: number }
        Returns: {
          coins: number
          season_pass: boolean
        }[]
      }
      sportsdb_bridge_acquire: { Args: never; Returns: string }
      sportsdb_bridge_archive: {
        Args: {
          p_key: string
          p_owner: string
          p_payload: Json
          p_rows: Json
          p_updated_at: string
        }
        Returns: number
      }
      sportsdb_bridge_archive_catalog: {
        Args: {
          p_archives: Json
          p_consumed: number
          p_offset: number
          p_owner: string
          p_total: number
        }
        Returns: undefined
      }
      sportsdb_bridge_archive_error: {
        Args: { p_error: string; p_key: string; p_owner: string }
        Returns: undefined
      }
      sportsdb_bridge_authorize: { Args: { p_token: string }; Returns: boolean }
      sportsdb_bridge_manifest: {
        Args: {
          p_manifest: Json
          p_owner: string
          p_source_complete: boolean
          p_source_status: Json
        }
        Returns: undefined
      }
      sportsdb_bridge_page: {
        Args: {
          p_consumed: number
          p_entity: string
          p_offset: number
          p_owner: string
          p_rows: Json
          p_total: number
        }
        Returns: number
      }
      sportsdb_bridge_release: {
        Args: { p_error: string; p_owner: string }
        Returns: undefined
      }
      sportsdb_bridge_timestamp: { Args: { p_value: string }; Returns: string }
      sportsdb_bridge_work: { Args: { p_owner: string }; Returns: Json }
      sportsdb_clean_text: { Args: { p_value: string }; Returns: string }
      sportsdb_resolve_local_club: {
        Args: { p_competition_id: string; p_name: string }
        Returns: string
      }
      sportsdb_resolve_local_competition: {
        Args: { p_country: string; p_name: string; p_source_id: string }
        Returns: string
      }
      sportsdb_safe_birth_date: {
        Args: { p_sport: string; p_value: string }
        Returns: string
      }
      sportsdb_save_records: { Args: { p_rows: Json }; Returns: number }
      store_product_contents_valid: {
        Args: { _contents: Json }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
