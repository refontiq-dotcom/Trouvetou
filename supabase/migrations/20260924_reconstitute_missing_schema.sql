-- ============================================================================
-- TROUVETOU — Reconstitution des objets absents du dépôt (drift production)
--
-- Daté 2026-09-24 volontairement : il DOIT s'exécuter AVANT les migrations
-- 20260925_*, qui référencent ces objets et échouaient donc sur une base
-- vierge (l'ordre lexicographique est l'ordre d'application).
--
-- Contexte
-- --------
-- Une partie du schéma de production n'avait aucune définition versionnée :
-- les migrations 20260925_merge_sejoura_duplicate_provider.sql et
-- 20260925_production_audit_hardening.sql échouent sur une base vierge car
-- elles référencent des objets créés « à la main » dans le SQL Editor.
--
-- Objets reconstitués ici :
--   - tables    : schooly_schools, schooly_grade_levels, schooly_sync_log,
--                 favorites, profiles
--   - fonctions : schooly_sync_school(jsonb, jsonb), rls_auto_enable()
--   - policies  : lecture publique des écoles publiées, sync_log verrouillé,
--                 favoris/profil limités à leur propriétaire
--
-- Sources utilisées (aucune invention de schéma) :
--   - schooly_* / schooly_sync_school : schooly/trouvetou-migrations/
--     20260913000000_schooly_connector.sql (le SQL du connecteur, appliqué sur
--     la base Trouvetou de production).
--   - favorites / profiles : usage applicatif (src/contexts/favorites-context.tsx
--     et src/lib/supabase/database.types.ts de la branche
--     feat/favorites-auth-profile-nav) + requêtes de
--     20260925_merge_sejoura_duplicate_provider.sql.
--   - rls_auto_enable : helper géré par Supabase (déclencheur d'événement).
--
-- Idempotence / sûreté sur la base de production
-- ----------------------------------------------
-- Chaque objet est créé avec `if not exists`, `create or replace` (avec le
-- search_path épinglé, pour ne PAS annuler 20260925_production_audit_hardening),
-- ou un garde `to_regprocedure(...) is null`. Sur une base où les objets
-- existent déjà, cette migration est un no-op (hormis la réaffirmation des
-- policies/grants ci-dessous).
--
-- Reste à capturer (non reconstituable depuis le dépôt) : l'historique exact
-- des migrations distantes. Utiliser `supabase db pull` une fois le projet
-- lié pour comparer et compléter.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Fonction utilitaire updated_at
--    Redéfinie AVEC `set search_path = public` : sans cela, un
--    `create or replace` effacerait l'épinglage posé par
--    production_audit_hardening (proconfig = NULL).
-- ---------------------------------------------------------------------------
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Tables du connecteur Schooly
-- ---------------------------------------------------------------------------
create table if not exists public.schooly_schools (
  id uuid primary key,                              -- ID original Schooly (immutable)
  schooly_instance_url text not null,                -- URL de l'instance Schooly (appels API)
  nom text not null,
  ville text,
  latitude double precision,
  longitude double precision,
  description_publique text,
  itineraire text,
  photos_360 jsonb default '[]'::jsonb,
  video_url text,
  grille_tarifaire_publique jsonb default '[]'::jsonb,
  published boolean not null default true,
  last_sync_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (schooly_instance_url, id)
);

create index if not exists idx_schooly_schools_published on public.schooly_schools (published)
  where published = true;

create index if not exists idx_schooly_schools_location on public.schooly_schools (latitude, longitude)
  where published = true and latitude is not null;

create table if not exists public.schooly_grade_levels (
  id uuid primary key,                              -- ID original Schooly
  schooly_school_id uuid not null references public.schooly_schools(id) on delete cascade,
  label text not null,
  capacity integer not null default 0,
  prix_min bigint,
  prix_max bigint,
  places_disponibles integer not null default 0,
  last_sync_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (schooly_school_id, id)
);

create index if not exists idx_schooly_grade_school on public.schooly_grade_levels (schooly_school_id);

create table if not exists public.schooly_sync_log (
  id uuid primary key default gen_random_uuid(),
  schooly_school_id uuid references public.schooly_schools(id) on delete set null,
  action text not null check (action in ('sync', 'unsync', 'availability_update', 'reservation_created', 'reservation_confirmed')),
  payload jsonb,
  status text not null default 'ok' check (status in ('ok', 'error', 'warning')),
  message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_schooly_sync_log_school on public.schooly_sync_log (schooly_school_id);
create index if not exists idx_schooly_sync_log_created on public.schooly_sync_log (created_at desc);

-- ---------------------------------------------------------------------------
-- 3. Triggers updated_at des tables Schooly
-- ---------------------------------------------------------------------------
drop trigger if exists trg_schooly_schools_updated on public.schooly_schools;
create trigger trg_schooly_schools_updated before update on public.schooly_schools
  for each row execute function public.update_updated_at_column();


-- ---------------------------------------------------------------------------
-- 4. RPC de synchronisation Schooly -> Trouvetou
--    Copie fidèle du connecteur. `set search_path = public` est ajouté car
--    production_audit_hardening l'épingle explicitement : l'omettre ici
--    réinitialiserait cette protection (proconfig = NULL).
-- ---------------------------------------------------------------------------
create or replace function public.schooly_sync_school(
  p_school jsonb,
  p_levels jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_id uuid;
  v_level jsonb;
begin
  -- Upsert ecole
  insert into public.schooly_schools (id, schooly_instance_url, nom, ville, latitude, longitude, description_publique, itineraire, photos_360, video_url, grille_tarifaire_publique, published, last_sync_at)
  values (
    (p_school->>'id')::uuid,
    p_school->>'schooly_instance_url',
    p_school->>'nom',
    p_school->>'ville',
    (p_school->>'latitude')::double precision,
    (p_school->>'longitude')::double precision,
    p_school->>'description_publique',
    p_school->>'itineraire',
    coalesce(p_school->'photos_360', '[]'::jsonb),
    p_school->>'video_url',
    coalesce(p_school->'grille_tarifaire_publique', '[]'::jsonb),
    (p_school->>'published')::boolean,
    now()
  )
  on conflict (schooly_instance_url, id) do update set
    nom = excluded.nom,
    ville = excluded.ville,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    description_publique = excluded.description_publique,
    itineraire = excluded.itineraire,
    photos_360 = excluded.photos_360,
    video_url = excluded.video_url,
    grille_tarifaire_publique = excluded.grille_tarifaire_publique,
    published = excluded.published,
    last_sync_at = now()
  returning id into v_school_id;

  -- Supprimer les niveaux existants et re-inserer
  delete from public.schooly_grade_levels where schooly_school_id = v_school_id;

  for v_level in select * from jsonb_array_elements(p_levels)
  loop
    insert into public.schooly_grade_levels (id, schooly_school_id, label, capacity, prix_min, prix_max, places_disponibles, last_sync_at)
    values (
      (v_level->>'id')::uuid,
      v_school_id,
      v_level->>'label',
      (v_level->>'capacity')::integer,
      (v_level->>'prix_min')::bigint,
      (v_level->>'prix_max')::bigint,
      (v_level->>'places_disponibles')::integer,
      now()
    );
  end loop;

  -- Log
  insert into public.schooly_sync_log (schooly_school_id, action, payload, status)
  values (v_school_id, 'sync', jsonb_build_object('school', p_school, 'levels_count', jsonb_array_length(p_levels)), 'ok');

  return jsonb_build_object('success', true, 'school_id', v_school_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. RLS Schooly : lecture publique des écoles publiées, sync_log interne
-- ---------------------------------------------------------------------------
alter table public.schooly_schools enable row level security;
alter table public.schooly_grade_levels enable row level security;
alter table public.schooly_sync_log enable row level security;

drop policy if exists "schooly_schools_public_read" on public.schooly_schools;
create policy "schooly_schools_public_read" on public.schooly_schools for select
  using (published = true);

drop policy if exists "schooly_grade_levels_public_read" on public.schooly_grade_levels;
create policy "schooly_grade_levels_public_read" on public.schooly_grade_levels for select
  using (exists (select 1 from public.schooly_schools s where s.id = schooly_school_id and s.published = true));

-- Le rôle service_role bypasse RLS : aucune policy d'écriture n'est nécessaire.
-- Ne JAMAIS ajouter de policy write « using (true) » : cela exposerait les
-- tables en écriture publique (anon/authenticated).
revoke all on public.schooly_sync_log from anon, authenticated;

drop policy if exists schooly_sync_log_no_public_access on public.schooly_sync_log;
create policy schooly_sync_log_no_public_access
  on public.schooly_sync_log
  for all
  to anon, authenticated
  using (false)
  with check (false);

-- Lecture publique assumée par les policies ci-dessus : les privilèges de
-- colonne doivent suivre, sinon un projet vierge n'accorde rien de lui-même.
grant select on public.schooly_schools to anon, authenticated;
grant select on public.schooly_grade_levels to anon, authenticated;
revoke all on function public.schooly_sync_school(jsonb, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Table `favorites` — favoris persistés par utilisateur authentifié
--    Schéma déduit de l'usage applicatif :
--      upsert({ user_id, listing_id }, { onConflict: "user_id,listing_id" })
--      select("listing_id").eq("user_id", user.id)
--      delete().eq("user_id", …).eq("listing_id", …)
--
--    NB production : la table existe déjà (le `create table` est un no-op).
--    Les policies ci-dessous portent les noms de la reconstruction ; si la
--    production en a d'autres, elles s'ajoutent (RLS = OR logique). À confirmer
--    avec `supabase db pull` une fois le projet lié.
-- ---------------------------------------------------------------------------
create table if not exists public.favorites (
  user_id uuid not null,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create index if not exists idx_favorites_listing on public.favorites (listing_id);

alter table public.favorites enable row level security;

-- Un favori appartient à son propriétaire : rien pour anon, et pour un
-- utilisateur authentifié uniquement ses propres lignes.
revoke all on public.favorites from anon, authenticated;
grant select, insert, delete on public.favorites to authenticated;

drop policy if exists favorites_select_own on public.favorites;
create policy favorites_select_own
  on public.favorites
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists favorites_insert_own on public.favorites;
create policy favorites_insert_own
  on public.favorites
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists favorites_delete_own on public.favorites;
create policy favorites_delete_own
  on public.favorites
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 7. Table `profiles` — profil minimal (téléphone / prénom) par utilisateur
--    Forme alignée sur les types de la branche feat/favorites-auth-profile-nav.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trigger_profiles_updated on public.profiles;
create trigger trigger_profiles_updated before update on public.profiles
  for each row execute function public.update_updated_at_column();

alter table public.profiles enable row level security;

revoke all on public.profiles from anon, authenticated;
grant select, insert, update on public.profiles to authenticated;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- 8. Helper Supabase `rls_auto_enable()`
--    Fonction gérée par la plateforme (déclencheur d'événement) et référencée
--    par production_audit_hardening. Créée UNIQUEMENT si absente afin de ne
--    jamais remplacer l'implémentation managée en production.
-- ---------------------------------------------------------------------------
do $drift$
begin
  if to_regprocedure('public.rls_auto_enable()') is null then
    create function public.rls_auto_enable()
    returns event_trigger
    language plpgsql
    security definer
    set search_path = pg_catalog
    as $fn$
    declare
      cmd record;
    begin
      for cmd in
        select * from pg_event_trigger_ddl_commands()
        where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
          and object_type in ('table', 'partitioned table')
      loop
        if cmd.schema_name = 'public' then
          begin
            execute format('alter table %s enable row level security', cmd.object_identity);
          exception when others then
            raise warning 'rls_auto_enable: échec sur %', cmd.object_identity;
          end;
        end if;
      end loop;
    end;
    $fn$;
  end if;
end;
$drift$;

revoke all on function public.rls_auto_enable() from public, anon, authenticated;

commit;


drop trigger if exists trg_schooly_grade_levels_updated on public.schooly_grade_levels;
create trigger trg_schooly_grade_levels_updated before update on public.schooly_grade_levels
  for each row execute function public.update_updated_at_column();
