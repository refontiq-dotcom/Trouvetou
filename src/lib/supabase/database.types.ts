// ============================================================================
// TROUVETOU — Types TypeScript de la base Supabase autonome Trouvetou
// Base DÉDIÉE (distincte de Séjoura). Tables : categories, providers,
// listings (polymorphe), sync_logs.
// ============================================================================

// ---------------------------------------------------------------------------
// Table `categories` — Secteurs isolés par slug ('hotel', 'clinic', 'school', ...)
// ---------------------------------------------------------------------------
export type Category = {
  id: string;
  slug: string;
  name: string;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Table `providers` — Sources d'alimentation (logiciels métiers partenaires)
// ---------------------------------------------------------------------------
export type Provider = {
  id: string;
  name: string;
  category_id: string;
  api_key_hash: string;
  webhook_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// Table `listings` — Annonces polymorphes (tous secteurs confondus)
// ---------------------------------------------------------------------------
export type Listing = {
  id: string;
  provider_id: string;
  category_id: string;
  /** ID stable côté fournisseur — clé d'UPSERT avec provider_id. */
  external_id: string;
  title: string;
  description: string | null;
  city: string | null;
  /** Prix de base en FCFA (nuit / consultation / scolarité / ...). */
  base_price: number | null;
  /** Tableau de liens d'images (CDN/Storage). */
  images: string[];
  /**
   * Spécificités du secteur :
   *   hôtel    : { "beds": 3, "wifi": true }
   *   clinique : { "specialties": ["Cardiologie"] }
   *   école    : { "levels": ["Primaire"] }
   */
  attributes: Record<string, unknown>;
  is_available: boolean;
  created_at: string;
  updated_at: string;
};

export type ListingInsert = {
  provider_id: string;
  category_id: string;
  external_id: string;
  title: string;
  description?: string | null;
  city?: string | null;
  base_price?: number | null;
  images?: string[];
  attributes?: Record<string, unknown>;
  is_available?: boolean;
};

// ---------------------------------------------------------------------------
// Table `sync_logs` — Journal des synchronisations entrantes
// ---------------------------------------------------------------------------
export type SyncLog = {
  id: string;
  provider_id: string | null;
  status: "success" | "partial" | "error";
  items_count: number;
  inserted: number;
  updated: number;
  message: string | null;
  ip_address: string | null;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Table `alerts` — Abonnements email aux nouvelles annonces
// (migration 20261018_create_alerts.sql)
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Table `favorites` — Annonces mises de côté par un utilisateur
// (RLS `auth.uid() = user_id`, voir supabase/schema.sql)
// ---------------------------------------------------------------------------
export type Favorite = {
  user_id: string;
  listing_id: string;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Table `bookings` — Historique des réservations du client
// (migration 20261018_create_bookings.sql)
// ---------------------------------------------------------------------------
export type Booking = {
  id: string;
  user_id: string;
  listing_id: string | null;
  booking_code: string | null;
  listing_name: string;
  check_in_date: string;
  check_out_date: string;
  number_of_guests: number;
  total_amount: number | null;
  created_at: string;
};

export type Alert = {
  id: string;
  email: string;
  /** NULL = toutes les catégories. */
  category_slug: string | null;
  /** NULL = toutes les villes. */
  city: string | null;
  is_active: boolean;
  last_notified_at: string | null;
  created_at: string;
};

// ============================================================================
// TYPES HÉRITÉS (compatibilité) — lecture du schéma Séjoura partagé legacy.
// Ces types ne font plus partie du schéma dédié Trouvetou ; ils sont conservés
// pour ne pas casser la section Hôtels existante tant qu'elle lit la base
// Séjoura. À migrer vers `listings` via `src/lib/supabase/listings.ts`.
// ============================================================================

export type SubscriptionStatus =
  | "trial"
  | "active"
  | "overdue"
  | "suspended"
  | "cancelled";

export type SubscriptionPlan = "standard" | "pro" | "entreprise" | string;

export type EstablishmentType =
  | "hotel"
  | "residence"
  | "appartements"
  | "villa"
  | "guesthouse"
  | "other";

/** Table `establishments` — alimentée par le logiciel Séjoura. */
export type Establishment = {
  id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  subscription_status: SubscriptionStatus;
  /** Plan d'abonnement : 'entreprise' = annonces systématiquement boostées. */
  subscription_plan?: SubscriptionPlan | null;
  type?: EstablishmentType | null;
  city?: string | null;
  country?: string | null;
  cover_image?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  whatsapp?: string | null;
  website?: string | null;
};

/** Table `rooms` — alimentée par le logiciel Séjoura. */
export type Room = {
  id: string;
  establishment_id: string;
  name: string;
  /** Prix de la chambre (FCFA par nuit). */
  price: number;
  amenities: string[];
  /** Tableau de liens d'images (Cloudinary/CDN/Storage). */
  images: string[];
  /** Interrupteur d'affichage sur Trouvetou activé par le gérant. */
  is_listed_on_trouvetou: boolean;
  /** Option "Boost" : la chambre est sponsorisée individuellement. */
  is_boosted?: boolean;
  description?: string | null;
  capacity?: number;
};

/**
 * Chambre affichée sur le catalogue public, avec son établissement joint.
 * `establishment` est mappé depuis la ressource embarquée `establishments`
 * retournée par PostgREST.
 */
export type ListedRoom = Room & {
  establishment: Establishment;
  is_boosted: boolean;
};

export type Database = {
  public: {
    Tables: {
      categories: {
        Row: Category;
        Insert: {
          id?: string;
          slug: string;
          name: string;
          created_at?: string;
        };
        Update: {
          slug?: string;
          name?: string;
        };
        Relationships: [];
      };
      providers: {
        Row: Provider;
        Insert: {
          id?: string;
          name: string;
          category_id: string;
          api_key_hash: string;
          webhook_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          category_id?: string;
          api_key_hash?: string;
          webhook_url?: string | null;
          is_active?: boolean;
        };
        Relationships: [];
      };
      listings: {
        Row: Listing;
        Insert: ListingInsert & { id?: string; created_at?: string };
        Update: {
          category_id?: string;
          title?: string;
          description?: string | null;
          city?: string | null;
          base_price?: number | null;
          images?: string[];
          attributes?: Record<string, unknown>;
          is_available?: boolean;
        };
        Relationships: [];
      };
      sync_logs: {
        Row: SyncLog;
        Insert: {
          provider_id?: string | null;
          status?: string;
          items_count?: number;
          inserted?: number;
          updated?: number;
          message?: string | null;
          ip_address?: string | null;
          created_at?: string;
        };
        Update: {
          message?: string | null;
        };
        Relationships: [];
      };
      favorites: {
        Row: Favorite;
        Insert: {
          user_id: string;
          listing_id: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          listing_id?: string;
        };
        Relationships: [];
      };
      bookings: {
        Row: Booking;
        Insert: {
          id?: string;
          user_id: string;
          listing_id?: string | null;
          booking_code?: string | null;
          listing_name: string;
          check_in_date: string;
          check_out_date: string;
          number_of_guests?: number;
          total_amount?: number | null;
          created_at?: string;
        };
        Update: {
          booking_code?: string | null;
        };
        Relationships: [];
      };
      alerts: {
        Row: Alert;
        Insert: {
          id?: string;
          email: string;
          category_slug?: string | null;
          city?: string | null;
          is_active?: boolean;
          last_notified_at?: string | null;
          created_at?: string;
        };
        Update: {
          category_slug?: string | null;
          city?: string | null;
          is_active?: boolean;
          last_notified_at?: string | null;
        };
        Relationships: [];
      };
      provider_api_key_aliases: {
        Row: {
          id: string;
          legacy_provider_id: string;
          canonical_provider_id: string;
          api_key_hash: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          legacy_provider_id: string;
          canonical_provider_id: string;
          api_key_hash: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          canonical_provider_id?: string;
          api_key_hash?: string;
          is_active?: boolean;
        };
        Relationships: [];
      };
      // --- Tables héritées Séjoura (compatibilité section Hôtels) ---
      rooms: {
        Row: Room;
        Insert: Omit<Room, "id">;
        Update: Partial<Omit<Room, "id">>;
        Relationships: [];
      };
      establishments: {
        Row: Establishment;
        Insert: Omit<Establishment, "id">;
        Update: Partial<Omit<Establishment, "id">>;
        Relationships: [];
      };
      room_types: {
        Row: {
          id: string;
          name: string | null;
          description: string | null;
          base_price: number | null;
          capacity: number | null;
          amenities: string[] | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      accommodations: {
        Row: {
          id: string;
          name: string | null;
          description: string | null;
          address: string | null;
          city: string | null;
          country: string | null;
          latitude: number | null;
          longitude: number | null;
          contact_phone: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      tenants: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      subscriptions: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      trouvetou_listings: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      ingest_listings: {
        Args: {
          p_provider_id: string;
          p_category_id: string;
          p_items: Array<Record<string, unknown>>;
        };
        Returns: Array<{ inserted: number; updated: number }>;
      };
      increment_trouvetou_traffic: {
        Args: {
          p_day: string;
          p_unique_visitors: number;
        };
        Returns: Array<{
          day: string;
          visits: number;
          unique_visitors: number;
        }>;
      };
    };
  };
};
