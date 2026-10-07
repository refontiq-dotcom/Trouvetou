import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Phase 2D.39 — Identité fonctionnelle multi-tenant.
 *
 * Ces tests portent sur la STRUCTURE SQL et la logique applicative. Ils ne
 * créent pas de base : ils vérifient que le modèle TRIPLET
 * (provider_id, tenant_ref, external_id) est réellement porté par le schéma,
 * et que le contrat de routage tient.
 *
 * Aucun secret n'est utilisé : les UUID sont synthétiques.
 */

const MIGRATION = resolve(
  process.cwd(),
  "supabase/migrations/20261005000000_multi_tenant_integration_scopes.sql",
);
const SYNC_ROUTE = resolve(process.cwd(), "src/app/api/v1/sync/route.ts");

const migration = readFileSync(MIGRATION, "utf8");
const syncRoute = readFileSync(SYNC_ROUTE, "utf8");

const PROVIDER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_A = "11111111-1111-4111-8111-111111111111";
const TENANT_B = "22222222-2222-4222-8222-222222222222";
const EXTERNAL_X = "rt:shared-external-id";

describe("2D.39 — identite fonctionnelle : le triplet", () => {
  it("la contrainte historique est REMPLACEE, pas conservee", () => {
    // La contrainte UNIQUE(provider_id, external_id) EMPECHE
    // physiquement P+A+X / P+B+X. Aucun mapping prive ne contourne une
    // contrainte de base : elle doit TOMBER.
    expect(migration).toMatch(
      /drop constraint listings_provider_id_external_id_key/,
    );
    // ...et le remplacement est idempotent : le DROP n'a lieu que si la
    // contrainte existe encore.
    const dropBlock = migration.slice(migration.indexOf("if exists ("));
    expect(dropBlock.slice(0, 600)).toMatch(
      /pg_get_constraintdef\(oid\) = 'UNIQUE \(provider_id, external_id\)'/,
    );
    expect(dropBlock.slice(0, 600)).toMatch(/drop constraint listings_provider_id_external_id_key/);
  });

  it("l'identite UNIQUE est le TRIPLET, porte par listings", () => {
    expect(migration).toMatch(
      /create unique index if not exists uq_listings_tenant_external\s*\n\s*on public\.listings \(provider_id, tenant_ref, external_id\)/,
    );
    // NULLS NOT DISTINCT : sans lui, deux listings legacy (tenant_ref NULL)
    // perdraient l'unicite d'avant la bascule.
    expect(migration).toMatch(
      /on public\.listings \(provider_id, tenant_ref, external_id\) nulls not distinct;/,
    );
  });

  it("l'upsert cible le TRIPLET, plus le couple", () => {
    // `nulls not distinct` est ILLEGAL dans ON CONFLICT : la clause n'existe
    // que dans CREATE UNIQUE INDEX et UNIQUE. L'inférence retrouve l'index
    // NND par ses colonnes, sans que la clause soit répétée ici.
    expect(migration).toMatch(/on conflict \(provider_id, tenant_ref, external_id\)\s*\n\s*do update set/);
    expect(migration).not.toMatch(
      /on conflict \([^)]*\)\s*nulls not distinct/i,
    );
    // L'ancien ON CONFLICT ne doit plus subsister.
    expect(migration).not.toMatch(/on conflict \(provider_id, external_id\)/);
  });

  it("tenant_ref est une colonne NULLABLE de listings (legacy tolere)", () => {
    expect(migration).toMatch(
      /alter table public\.listings\s*\n\s*add column if not exists tenant_ref text;/,
    );
  });

  it("external_id n'est PAS denormalise : l'identite vit sur listings", () => {
    // Option A retenue : la contrainte porte sur `listings`. Le routage privé
    // ne duplique donc PAS external_id — il ne porte que le soft-removal.
    expect(migration).not.toMatch(/add column if not exists external_id/i);
    expect(migration).toMatch(
      /insert into public\.listing_tenant_scopes\s*\n\s*\(listing_id, provider_id, tenant_ref\)/i,
    );
  });

  it("l'unicite est sur le TRIPLET : deux tenants peuvent partager X", () => {
    // Ni listings ni le routage ne doivent porter un index unique sur le
    // couple (provider, external_id) : cela bloquerait P+A+X / P+B+X.
    expect(migration).not.toMatch(
      /create unique index[^\n]*listings\s*\(\s*provider_id,\s*external_id\s*\)/i,
    );
    expect(migration).not.toMatch(
      /create unique index[^\n]*listing_tenant_scopes\s*\(\s*provider_id,\s*tenant_ref,\s*external_id\s*\)/i,
    );
  });
});

describe("2D.39 — deux tenants, un provider, le meme external_id", () => {
  /** Modelise la resolution par triplet, comme le fait `ingest_listings`. */
  type Row = { providerId: string; tenantRef: string; externalId: string; id: string };

  const resolveByTriplet = (
    rows: Row[],
    providerId: string,
    tenantRef: string,
    externalId: string,
  ) => {
    // Modele REEL : uq_listings_tenant_external rend le TRIPLET univoque.
    // Le lookup se fait donc par triplet, et deux tenants du meme provider
    // peuvent partager le meme external_id.
    const match = rows.find(
      (r) =>
        r.providerId === providerId &&
        r.tenantRef === tenantRef &&
        r.externalId === externalId,
    );
    if (match) return { kind: "UPDATE" as const, id: match.id };

    // Le couple (provider, external_id) est-il deja pris par UN AUTRE tenant ?
    const taken = rows.find(
      (r) => r.providerId === providerId && r.externalId === externalId,
    );
    if (taken) return { kind: "CONFLICT" as const, owner: taken.tenantRef };

    return { kind: "CREATE" as const };
  };

  const rows: Row[] = [
    { providerId: PROVIDER, tenantRef: TENANT_A, externalId: EXTERNAL_X, id: "listing-A" },
    { providerId: PROVIDER, tenantRef: TENANT_B, externalId: EXTERNAL_X, id: "listing-B" },
  ];

  it("tenant A + external X -> son propre listing (UPDATE)", () => {
    const r = resolveByTriplet(rows, PROVIDER, TENANT_A, EXTERNAL_X);
    expect(r.kind).toBe("UPDATE");
    expect(r.kind === "UPDATE" && r.id).toBe("listing-A");
  });

  it("tenant B + MEME external X -> SON listing, pas celui de A", () => {
    const r = resolveByTriplet(rows, PROVIDER, TENANT_B, EXTERNAL_X);
    expect(r.kind).toBe("UPDATE");
    expect(r.kind === "UPDATE" && r.id).toBe("listing-B");
  });

  it("les deux listings coexistent : aucune confusion", () => {
    const a = resolveByTriplet(rows, PROVIDER, TENANT_A, EXTERNAL_X);
    const b = resolveByTriplet(rows, PROVIDER, TENANT_B, EXTERNAL_X);
    expect(a.kind === "UPDATE" && a.id).not.toBe(b.kind === "UPDATE" && b.id);
  });

  it("tenant C (absent) + external X -> CONFLIT, pas de vol de donnee", () => {
    const r = resolveByTriplet(rows, PROVIDER, "tenant-C", EXTERNAL_X);
    expect(r.kind).toBe("CONFLICT");
  });

  it("external_id inconnu du provider -> CREATE", () => {
    const r = resolveByTriplet(rows, PROVIDER, TENANT_A, "rt:inconnu");
    expect(r.kind).toBe("CREATE");
  });
});

describe("2D.39 — isolation : A ne touche jamais B", () => {
  it("la garde cross-tenant est DANS ingest_listings, avant l'upsert", () => {
    // Le refus doit survenir dans la fonction transactionnelle, avant toute
    // ecriture : c'est ce qui garantit 0 impact sur B.
    const fn = migration.slice(
      migration.indexOf("create or replace function public.ingest_listings"),
    );
    const guard = fn.search(/CROSS_TENANT_CONFLICT/);
    const upsert = fn.search(/insert into public\.listings/i);
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(upsert);
  });

  it("le soft-removal est borne par tenant_ref", () => {
    const fn = migration.slice(
      migration.indexOf("create or replace function public.apply_soft_removal"),
    );
    expect(fn).toMatch(/s\.tenant_ref\s*=\s*p_tenant_ref/);
    // La branche GLOBAL exclut les listings routes : GLOBAL ne decide pas
    // du sort d'un listing scope.
    expect(fn).toMatch(/not exists \([\s\S]*?listing_tenant_scopes/);
  });

  it("un snapshot vide ne desactive rien", () => {
    const fn = migration.slice(
      migration.indexOf("create or replace function public.apply_soft_removal"),
    );
    expect(fn).toMatch(/cardinality\(p_external_ids\) = 0 then[\s\S]*?return 0/);
  });

  it("la route appelle apply_soft_removal avec le tenant du SCOPE", () => {
    expect(syncRoute).toMatch(/rpc\("apply_soft_removal"/);
    // La valeur transmise est scope.tenantRef, JAMAIS une valeur du payload.
    expect(syncRoute).toMatch(/p_tenant_ref:\s*scope\.tenantRef/);
  });

  it("la garde GLOBAL refuse la creation d'un listing orphelin", () => {
    expect(syncRoute).toMatch(/GLOBAL_CANNOT_CREATE/);
    expect(syncRoute).toMatch(/canCreateListing\(scope\)/);
  });
});

describe("2D.39 — rotation sans effet sur l'identite", () => {
  it("l'index d'identite ne depend d'aucune credential", () => {
    const idx = migration.slice(
      migration.indexOf("uq_listings_tenant_external"),
      migration.indexOf("drop index if exists public.idx_listings_external"),
    );
    expect(idx).not.toMatch(/credential/i);
  });

  it("provider_id du routage est justifie dans le schema", () => {
    // Denormalisation documentee : elle evite une jointure sur le chemin
    // chaud du soft-removal.
    expect(migration).toMatch(/D\u00e9normalisation justifi\u00e9e/);
  });
});
