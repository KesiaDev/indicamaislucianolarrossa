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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      app_branding: {
        Row: {
          company_name: string
          hero_subtitle: string | null
          hero_title: string | null
          id: string
          logo_url: string | null
          primary_color: string | null
          setup_completed_at: string | null
          updated_at: string
        }
        Insert: {
          company_name?: string
          hero_subtitle?: string | null
          hero_title?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          setup_completed_at?: string | null
          updated_at?: string
        }
        Update: {
          company_name?: string
          hero_subtitle?: string | null
          hero_title?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          setup_completed_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      campaign_message_variants: {
        Row: {
          campaign_id: string
          content: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          label: string | null
          updated_at: string
        }
        Insert: {
          campaign_id: string
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          id: string
          landing_page_url: string | null
          name: string
          pre_written_message: string | null
          slug: string
          starts_at: string
          status: Database["public"]["Enums"]["campaign_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          landing_page_url?: string | null
          name: string
          pre_written_message?: string | null
          slug: string
          starts_at: string
          status?: Database["public"]["Enums"]["campaign_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          landing_page_url?: string | null
          name?: string
          pre_written_message?: string | null
          slug?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["campaign_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clint_channel_accounts: {
        Row: {
          avatar: string | null
          created_at: string
          id: string
          identifier: string | null
          is_default: boolean
          is_enabled: boolean
          last_used_at: string | null
          name: string
          status: string | null
          team_name: string | null
          type: string | null
          updated_at: string
        }
        Insert: {
          avatar?: string | null
          created_at?: string
          id: string
          identifier?: string | null
          is_default?: boolean
          is_enabled?: boolean
          last_used_at?: string | null
          name: string
          status?: string | null
          team_name?: string | null
          type?: string | null
          updated_at?: string
        }
        Update: {
          avatar?: string | null
          created_at?: string
          id?: string
          identifier?: string | null
          is_default?: boolean
          is_enabled?: boolean
          last_used_at?: string | null
          name?: string
          status?: string | null
          team_name?: string | null
          type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      conversion_webhooks: {
        Row: {
          created_at: string
          error_message: string | null
          external_order_id: string | null
          id: string
          payload: Json
          processed_at: string | null
          referral_id: string | null
          source_ip: unknown
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          external_order_id?: string | null
          id?: string
          payload: Json
          processed_at?: string | null
          referral_id?: string | null
          source_ip?: unknown
        }
        Update: {
          created_at?: string
          error_message?: string | null
          external_order_id?: string | null
          id?: string
          payload?: Json
          processed_at?: string | null
          referral_id?: string | null
          source_ip?: unknown
        }
        Relationships: [
          {
            foreignKeyName: "conversion_webhooks_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      fraud_blocklist: {
        Row: {
          blocked_by: string | null
          created_at: string
          email: string | null
          id: string
          ip: unknown
          reason: string
        }
        Insert: {
          blocked_by?: string | null
          created_at?: string
          email?: string | null
          id?: string
          ip?: unknown
          reason: string
        }
        Update: {
          blocked_by?: string | null
          created_at?: string
          email?: string | null
          id?: string
          ip?: unknown
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "fraud_blocklist_blocked_by_fkey"
            columns: ["blocked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_tiers: {
        Row: {
          color: string
          created_at: string
          icon: string | null
          id: string
          min_points: number
          name: string
          perks: string[] | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          color: string
          created_at?: string
          icon?: string | null
          id?: string
          min_points: number
          name: string
          perks?: string[] | null
          sort_order: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          icon?: string | null
          id?: string
          min_points?: number
          name?: string
          perks?: string[] | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      monthly_rankings: {
        Row: {
          conversions_count: number
          created_at: string
          id: string
          month: number
          position: number | null
          referrer_id: string
          total_points: number
          updated_at: string
          year: number
        }
        Insert: {
          conversions_count?: number
          created_at?: string
          id?: string
          month: number
          position?: number | null
          referrer_id: string
          total_points?: number
          updated_at?: string
          year: number
        }
        Update: {
          conversions_count?: number
          created_at?: string
          id?: string
          month?: number
          position?: number | null
          referrer_id?: string
          total_points?: number
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "monthly_rankings_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_rules: {
        Row: {
          email_enabled: boolean
          event_key: string
          updated_at: string
          whatsapp_enabled: boolean
        }
        Insert: {
          email_enabled?: boolean
          event_key: string
          updated_at?: string
          whatsapp_enabled?: boolean
        }
        Update: {
          email_enabled?: boolean
          event_key?: string
          updated_at?: string
          whatsapp_enabled?: boolean
        }
        Relationships: []
      }
      notification_templates: {
        Row: {
          body: string
          channel: Database["public"]["Enums"]["notification_channel"]
          event_key: string
          subject: string | null
          updated_at: string
          whatsapp_template: string | null
        }
        Insert: {
          body: string
          channel: Database["public"]["Enums"]["notification_channel"]
          event_key: string
          subject?: string | null
          updated_at?: string
          whatsapp_template?: string | null
        }
        Update: {
          body?: string
          channel?: Database["public"]["Enums"]["notification_channel"]
          event_key?: string
          subject?: string | null
          updated_at?: string
          whatsapp_template?: string | null
        }
        Relationships: []
      }
      notifications_log: {
        Row: {
          body: string
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          error_message: string | null
          id: string
          profile_id: string
          provider_event: string | null
          provider_event_at: string | null
          provider_message_id: string | null
          related_reward_id: string | null
          sent_at: string | null
          subject: string | null
        }
        Insert: {
          body: string
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          error_message?: string | null
          id?: string
          profile_id: string
          provider_event?: string | null
          provider_event_at?: string | null
          provider_message_id?: string | null
          related_reward_id?: string | null
          sent_at?: string | null
          subject?: string | null
        }
        Update: {
          body?: string
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          error_message?: string | null
          id?: string
          profile_id?: string
          provider_event?: string | null
          provider_event_at?: string | null
          provider_message_id?: string | null
          related_reward_id?: string | null
          sent_at?: string | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_log_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_log_related_reward_id_fkey"
            columns: ["related_reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications_suppressions: {
        Row: {
          created_at: string
          email: string
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          reason?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          tier_id: string | null
          total_points: number
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          tier_id?: string | null
          total_points?: number
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          tier_id?: string | null
          total_points?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "loyalty_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_clicks: {
        Row: {
          campaign_id: string
          clicked_at: string
          id: string
          ip_hash: string | null
          link_id: string
          referrer_id: string
          user_agent: string | null
          variant_id: string | null
        }
        Insert: {
          campaign_id: string
          clicked_at?: string
          id?: string
          ip_hash?: string | null
          link_id: string
          referrer_id: string
          user_agent?: string | null
          variant_id?: string | null
        }
        Update: {
          campaign_id?: string
          clicked_at?: string
          id?: string
          ip_hash?: string | null
          link_id?: string
          referrer_id?: string
          user_agent?: string | null
          variant_id?: string | null
        }
        Relationships: []
      }
      referral_links: {
        Row: {
          campaign_id: string
          clicks_count: number
          code: string
          created_at: string
          id: string
          referrer_id: string
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          campaign_id: string
          clicks_count?: number
          code: string
          created_at?: string
          id?: string
          referrer_id: string
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          campaign_id?: string
          clicks_count?: number
          code?: string
          created_at?: string
          id?: string
          referrer_id?: string
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_links_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_links_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          campaign_id: string
          conversion_value: number | null
          converted_at: string | null
          created_at: string
          expires_at: string
          external_order_id: string | null
          id: string
          lead_email: string | null
          lead_ip: unknown
          lead_name: string | null
          lead_phone: string | null
          lead_user_agent: string | null
          notes: string | null
          referral_link_id: string
          referrer_id: string
          status: Database["public"]["Enums"]["referral_status"]
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          campaign_id: string
          conversion_value?: number | null
          converted_at?: string | null
          created_at?: string
          expires_at?: string
          external_order_id?: string | null
          id?: string
          lead_email?: string | null
          lead_ip?: unknown
          lead_name?: string | null
          lead_phone?: string | null
          lead_user_agent?: string | null
          notes?: string | null
          referral_link_id: string
          referrer_id: string
          status?: Database["public"]["Enums"]["referral_status"]
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          campaign_id?: string
          conversion_value?: number | null
          converted_at?: string | null
          created_at?: string
          expires_at?: string
          external_order_id?: string | null
          id?: string
          lead_email?: string | null
          lead_ip?: unknown
          lead_name?: string | null
          lead_phone?: string | null
          lead_user_agent?: string | null
          notes?: string | null
          referral_link_id?: string
          referrer_id?: string
          status?: Database["public"]["Enums"]["referral_status"]
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referrals_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referral_link_id_fkey"
            columns: ["referral_link_id"]
            isOneToOne: false
            referencedRelation: "referral_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referrer_signups: {
        Row: {
          confirmation_token: string
          confirmed_at: string | null
          created_at: string
          created_user_id: string | null
          email: string
          full_name: string
          id: string
          phone: string | null
          status: string
          token_expires_at: string
          updated_at: string
        }
        Insert: {
          confirmation_token?: string
          confirmed_at?: string | null
          created_at?: string
          created_user_id?: string | null
          email: string
          full_name: string
          id?: string
          phone?: string | null
          status?: string
          token_expires_at?: string
          updated_at?: string
        }
        Update: {
          confirmation_token?: string
          confirmed_at?: string | null
          created_at?: string
          created_user_id?: string | null
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          status?: string
          token_expires_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      reward_rules: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          is_recurring: boolean
          name: string
          points_per_conversion: number
          reward_description: string
          reward_type: Database["public"]["Enums"]["reward_type"]
          reward_value: number | null
          trigger_count: number
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          is_recurring?: boolean
          name: string
          points_per_conversion?: number
          reward_description: string
          reward_type: Database["public"]["Enums"]["reward_type"]
          reward_value?: number | null
          trigger_count: number
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          is_recurring?: boolean
          name?: string
          points_per_conversion?: number
          reward_description?: string
          reward_type?: Database["public"]["Enums"]["reward_type"]
          reward_value?: number | null
          trigger_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_rules_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      rewards: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          campaign_id: string
          created_at: string
          id: string
          notes: string | null
          paid_at: string | null
          redemption_code: string | null
          referrer_id: string
          reward_description: string
          reward_rule_id: string
          reward_type: Database["public"]["Enums"]["reward_type"]
          reward_value: number | null
          status: Database["public"]["Enums"]["reward_status"]
          unlocked_at: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          campaign_id: string
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          redemption_code?: string | null
          referrer_id: string
          reward_description: string
          reward_rule_id: string
          reward_type: Database["public"]["Enums"]["reward_type"]
          reward_value?: number | null
          status?: Database["public"]["Enums"]["reward_status"]
          unlocked_at?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          campaign_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          redemption_code?: string | null
          referrer_id?: string
          reward_description?: string
          reward_rule_id?: string
          reward_type?: Database["public"]["Enums"]["reward_type"]
          reward_value?: number | null
          status?: Database["public"]["Enums"]["reward_status"]
          unlocked_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rewards_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rewards_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rewards_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rewards_reward_rule_id_fkey"
            columns: ["reward_rule_id"]
            isOneToOne: false
            referencedRelation: "reward_rules"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bootstrap_admin: { Args: { p_email: string }; Returns: Json }
      confirm_conversion: {
        Args: {
          p_conversion_value: number
          p_external_order_id: string
          p_referral_id: string
        }
        Returns: Json
      }
      create_referral_link: {
        Args: { p_campaign_id: string }
        Returns: {
          campaign_id: string
          clicks_count: number
          code: string
          created_at: string
          id: string
          referrer_id: string
          updated_at: string
          variant_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "referral_links"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_vault_secret: { Args: { p_name: string }; Returns: undefined }
      ensure_referral_link: {
        Args: { _campaign_id: string }
        Returns: {
          campaign_id: string
          clicks_count: number
          code: string
          created_at: string
          id: string
          referrer_id: string
          updated_at: string
          variant_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "referral_links"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      evaluate_rewards: {
        Args: { p_campaign_id: string; p_referrer_id: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          campaign_id: string
          created_at: string
          id: string
          notes: string | null
          paid_at: string | null
          redemption_code: string | null
          referrer_id: string
          reward_description: string
          reward_rule_id: string
          reward_type: Database["public"]["Enums"]["reward_type"]
          reward_value: number | null
          status: Database["public"]["Enums"]["reward_status"]
          unlocked_at: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "rewards"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      expire_old_referrals: { Args: never; Returns: number }
      generate_referral_code: { Args: { p_full_name: string }; Returns: string }
      get_admin_dashboard: { Args: never; Returns: Json }
      get_campaigns_with_metrics: {
        Args: never
        Returns: {
          campaign_id: string
          converted_count: number
          referrers_count: number
          total_count: number
        }[]
      }
      get_referral_landing: { Args: { p_code: string }; Returns: Json }
      get_referrer_dashboard: {
        Args: { p_referrer_id?: string }
        Returns: Json
      }
      get_variant_performance: {
        Args: { p_campaign_id: string }
        Returns: {
          clicks: number
          content: string
          conversions: number
          is_active: boolean
          label: string
          referrals: number
          variant_id: string
        }[]
      }
      get_vault_secret: { Args: { p_name: string }; Returns: string }
      get_webhook_secret: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      list_integration_status: { Args: never; Returns: Json }
      normalize_br_phone: { Args: { p_phone: string }; Returns: string }
      recompute_tier: { Args: { _profile_id: string }; Returns: undefined }
      refresh_monthly_ranking: {
        Args: { p_month: number; p_year: number }
        Returns: number
      }
      register_referral: {
        Args: {
          p_lead_email: string
          p_lead_ip?: unknown
          p_lead_name: string
          p_lead_phone?: string
          p_lead_user_agent?: string
          p_link_code: string
        }
        Returns: Json
      }
      set_vault_secret: {
        Args: { p_name: string; p_value: string }
        Returns: undefined
      }
    }
    Enums: {
      campaign_status: "draft" | "active" | "paused" | "ended"
      notification_channel: "email" | "whatsapp"
      referral_status: "pending" | "converted" | "expired" | "rejected"
      reward_status: "pending" | "approved" | "paid" | "rejected"
      reward_type: "cash" | "discount" | "gift_card" | "product"
      user_role: "admin" | "referrer"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      campaign_status: ["draft", "active", "paused", "ended"],
      notification_channel: ["email", "whatsapp"],
      referral_status: ["pending", "converted", "expired", "rejected"],
      reward_status: ["pending", "approved", "paid", "rejected"],
      reward_type: ["cash", "discount", "gift_card", "product"],
      user_role: ["admin", "referrer"],
    },
  },
} as const
