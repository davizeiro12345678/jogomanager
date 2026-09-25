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
    PostgrestVersion: "14.5"
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
          state?: Json
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
        ]
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
        ]
      }
      players: {
        Row: {
          age: number
          birth_date: string | null
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
          source_updated_at: string | null
          sync_status: string
          updated_at: string
        }
        Insert: {
          age?: number
          birth_date?: string | null
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
          source_updated_at?: string | null
          sync_status?: string
          updated_at?: string
        }
        Update: {
          age?: number
          birth_date?: string | null
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
          source_updated_at?: string | null
          sync_status?: string
          updated_at?: string
        }
        Relationships: [
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
      [_ in never]: never
    }
    Functions: {
      activate_training_boost: {
        Args: { _user_id: string }
        Returns: {
          training_boosts: number
          training_until: string
        }[]
      }
      consume_wallet_item: {
        Args: { _detail?: string; _item: string; _user_id: string }
        Returns: {
          scout_reports: number
          training_boosts: number
        }[]
      }
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
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
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
      reserve_guest_checkout_attempt: {
        Args: { _email_hash: string }
        Returns: boolean
      }
      reserve_guest_checkout_claim: {
        Args: { _intent_id: string; _user_id: string }
        Returns: boolean
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
