-- Conserve les clés API issues d'anciens providers après fusion.
-- La clé legacy continue d'authentifier la source, mais les annonces sont
-- désormais ingérées sous le provider canonique.

create table if not exists public.provider_api_key_aliases (
  legacy_provider_id uuid primary key,
  canonical_provider_id uuid not null references public.providers(id) on delete cascade,
  api_key_hash text not null check (api_key_hash <> ''),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.provider_api_key_aliases enable row level security;

-- 1) Mémoriser la clé du provider Séjoura récemment créé avant sa suppression.
insert into public.provider_api_key_aliases (
  legacy_provider_id,
  canonical_provider_id,
  api_key_hash
)
select
  legacy.id,
  canonical.id,
  legacy.api_key_hash
from public.providers legacy
join public.providers canonical
  on canonical.id = 'a5101284-2d97-46e0-a0f2-fa6a008588f2'
where legacy.id = '7a358385-6a88-4c8e-8e93-ef743a5ff218'
on conflict (legacy_provider_id) do update
set
  canonical_provider_id = excluded.canonical_provider_id,
  api_key_hash = excluded.api_key_hash,
  is_active = true,
  updated_at = now();

-- 2) Le provider récent est la source de données la plus à jour.
--    On recopie ses données vers les lignes canoniques, sans changer leur ID.
update public.listings canonical
set
  category_id = legacy.category_id,
  title = legacy.title,
  description = legacy.description,
  city = legacy.city,
  base_price = legacy.base_price,
  images = legacy.images,
  attributes = legacy.attributes,
  is_available = legacy.is_available,
  updated_at = greatest(canonical.updated_at, legacy.updated_at)
from public.listings legacy
where legacy.provider_id = '7a358385-6a88-4c8e-8e93-ef743a5ff218'
  and canonical.provider_id = 'a5101284-2d97-46e0-a0f2-fa6a008588f2'
  and canonical.external_id = legacy.external_id;

-- 3) Les favoris qui pointaient vers une copie basculent vers la ligne canonique.
insert into public.favorites (user_id, listing_id, created_at)
select f.user_id, canonical.id, f.created_at
from public.favorites f
join public.listings legacy on legacy.id = f.listing_id
join public.listings canonical
  on canonical.provider_id = 'a5101284-2d97-46e0-a0f2-fa6a008588f2'
 and canonical.external_id = legacy.external_id
where legacy.provider_id = '7a358385-6a88-4c8e-8e93-ef743a5ff218'
on conflict (user_id, listing_id) do nothing;

-- 4) Les logs historiques restent conservés mais rattachés au provider canonique.
update public.sync_logs
set provider_id = 'a5101284-2d97-46e0-a0f2-fa6a008588f2'
where provider_id = '7a358385-6a88-4c8e-8e93-ef743a5ff218';

-- 5) Supprimer les copies puis l'ancien provider.
delete from public.listings
where provider_id = '7a358385-6a88-4c8e-8e93-ef743a5ff218';

delete from public.providers
where id = '7a358385-6a88-4c8e-8e93-ef743a5ff218';
