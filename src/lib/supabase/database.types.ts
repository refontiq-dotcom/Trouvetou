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
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string
          listing_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          listing_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          listing_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_credentials: {
        Row: {
          created_at: string
          credential_hash: string
          expires_at: string | null
          id: string
          is_active: boolean
          provider_id: string
          scope_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          credential_hash: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          provider_id: string
          scope_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          credential_hash?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          provider_id?: string
          scope_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_credentials_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_credentials_scope_id_fkey"
            columns: ["scope_id"]
            isOneToOne: false
            referencedRelation: "integration_scopes"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_scopes: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          provider_id: string
          scope_type: string
          tenant_ref: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          provider_id: string
          scope_type: string
          tenant_ref?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          provider_id?: string
          scope_type?: string
          tenant_ref?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_scopes_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_tenant_scopes: {
        Row: {
          created_at: string
          listing_id: string
          provider_id: string
          tenant_ref: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          listing_id: string
          provider_id: string
          tenant_ref: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          listing_id?: string
          provider_id?: string
          tenant_ref?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_tenant_scopes_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_tenant_scopes_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          attributes: Json
          base_price: number | null
          category_id: string
          city: string | null
          created_at: string
          description: string | null
          external_id: string
          id: string
          images: Json
          is_available: boolean
          provider_id: string
          tenant_ref: string | null
          title: string
          updated_at: string
        }
        Insert: {
          attributes?: Json
          base_price?: number | null
          category_id: string
          city?: string | null
          created_at?: string
          description?: string | null
          external_id: string
          id?: string
          images?: Json
          is_available?: boolean
          provider_id: string
          tenant_ref?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          attributes?: Json
          base_price?: number | null
          category_id?: string
          city?: string | null
          created_at?: string
          description?: string | null
          external_id?: string
          id?: string
          images?: Json
          is_available?: boolean
          provider_id?: string
          tenant_ref?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          first_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          first_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          first_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      provider_api_key_aliases: {
        Row: {
          api_key_hash: string
          canonical_provider_id: string
          created_at: string
          is_active: boolean
          legacy_provider_id: string
          updated_at: string
        }
        Insert: {
          api_key_hash: string
          canonical_provider_id: string
          created_at?: string
          is_active?: boolean
          legacy_provider_id: string
          updated_at?: string
        }
        Update: {
          api_key_hash?: string
          canonical_provider_id?: string
          created_at?: string
          is_active?: boolean
          legacy_provider_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_api_key_aliases_canonical_provider_id_fkey"
            columns: ["canonical_provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      providers: {
        Row: {
          api_key_hash: string
          category_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          outbound_api_key_encrypted: string | null
          type: Database["public"]["Enums"]["provider_type"]
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          api_key_hash: string
          category_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          outbound_api_key_encrypted?: string | null
          type?: Database["public"]["Enums"]["provider_type"]
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          api_key_hash?: string
          category_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          outbound_api_key_encrypted?: string | null
          type?: Database["public"]["Enums"]["provider_type"]
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "providers_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      schooly_grade_levels: {
        Row: {
          capacity: number
          created_at: string
          id: string
          label: string
          last_sync_at: string
          places_disponibles: number
          prix_max: number | null
          prix_min: number | null
          schooly_school_id: string
          updated_at: string
        }
        Insert: {
          capacity?: number
          created_at?: string
          id: string
          label: string
          last_sync_at?: string
          places_disponibles?: number
          prix_max?: number | null
          prix_min?: number | null
          schooly_school_id: string
          updated_at?: string
        }
        Update: {
          capacity?: number
          created_at?: string
          id?: string
          label?: string
          last_sync_at?: string
          places_disponibles?: number
          prix_max?: number | null
          prix_min?: number | null
          schooly_school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schooly_grade_levels_schooly_school_id_fkey"
            columns: ["schooly_school_id"]
            isOneToOne: false
            referencedRelation: "schooly_schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schooly_schools: {
        Row: {
          created_at: string
          description_publique: string | null
          grille_tarifaire_publique: Json | null
          id: string
          itineraire: string | null
          last_sync_at: string
          latitude: number | null
          longitude: number | null
          nom: string
          photos_360: Json | null
          published: boolean
          schooly_instance_url: string
          updated_at: string
          video_url: string | null
          ville: string | null
        }
        Insert: {
          created_at?: string
          description_publique?: string | null
          grille_tarifaire_publique?: Json | null
          id: string
          itineraire?: string | null
          last_sync_at?: string
          latitude?: number | null
          longitude?: number | null
          nom: string
          photos_360?: Json | null
          published?: boolean
          schooly_instance_url: string
          updated_at?: string
          video_url?: string | null
          ville?: string | null
        }
        Update: {
          created_at?: string
          description_publique?: string | null
          grille_tarifaire_publique?: Json | null
          id?: string
          itineraire?: string | null
          last_sync_at?: string
          latitude?: number | null
          longitude?: number | null
          nom?: string
          photos_360?: Json | null
          published?: boolean
          schooly_instance_url?: string
          updated_at?: string
          video_url?: string | null
          ville?: string | null
        }
        Relationships: []
      }
      schooly_sync_log: {
        Row: {
          action: string
          created_at: string
          id: string
          message: string | null
          payload: Json | null
          schooly_school_id: string | null
          status: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          message?: string | null
          payload?: Json | null
          schooly_school_id?: string | null
          status?: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          message?: string | null
          payload?: Json | null
          schooly_school_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "schooly_sync_log_schooly_school_id_fkey"
            columns: ["schooly_school_id"]
            isOneToOne: false
            referencedRelation: "schooly_schools"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_logs: {
        Row: {
          created_at: string
          id: string
          inserted: number
          ip_address: unknown
          items_count: number
          message: string | null
          provider_id: string | null
          status: string
          updated: number
        }
        Insert: {
          created_at?: string
          id?: string
          inserted?: number
          ip_address?: unknown
          items_count?: number
          message?: string | null
          provider_id?: string | null
          status: string
          updated?: number
        }
        Update: {
          created_at?: string
          id?: string
          inserted?: number
          ip_address?: unknown
          items_count?: number
          message?: string | null
          provider_id?: string | null
          status?: string
          updated?: number
        }
        Relationships: [
          {
            foreignKeyName: "sync_logs_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      trouvetou_traffic_daily: {
        Row: {
          created_at: string
          day: string
          unique_visitors: number
          updated_at: string
          visits: number
        }
        Insert: {
          created_at?: string
          day: string
          unique_visitors?: number
          updated_at?: string
          visits?: number
        }
        Update: {
          created_at?: string
          day?: string
          unique_visitors?: number
          updated_at?: string
          visits?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_soft_removal: {
        Args: {
          p_external_ids: string[]
          p_provider_id: string
          p_tenant_ref: string
        }
        Returns: number
      }
      create_provider: {
        Args: {
          p_api_key_hash: string
          p_category: string
          p_name: string
          p_type?: string
          p_webhook_url?: string
        }
        Returns: {
          api_key_hash: string
          category_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          outbound_api_key_encrypted: string | null
          type: Database["public"]["Enums"]["provider_type"]
          updated_at: string
          webhook_url: string | null
        }
        SetofOptions: {
          from: "*"
          to: "providers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      increment_trouvetou_traffic: {
        Args: { p_day: string; p_unique_visitors: number }
        Returns: {
          day: string
          unique_visitors: number
          visits: number
        }[]
      }
      ingest_listings: {
        Args: {
          p_category_id: string
          p_items: Json
          p_provider_id: string
          p_tenant_ref?: string
        }
        Returns: {
          inserted: number
          updated: number
        }[]
      }
      purge_provider_listings: {
        Args: { p_provider_id: string }
        Returns: number
      }
      resolve_integration_scope: {
        Args: { p_credential_hash: string; p_provider_id: string }
        Returns: {
          provider_matches: boolean
          scope_id: string
          scope_is_active: boolean
          scope_type: string
          tenant_ref: string
        }[]
      }
      schooly_sync_school: {
        Args: { p_levels: Json; p_school: Json }
        Returns: Json
      }
    }
    Enums: {
      provider_type: "unknown" | "sejoura"
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
    Enums: {
      provider_type: ["unknown", "sejoura"],
    },
  },
} as const
