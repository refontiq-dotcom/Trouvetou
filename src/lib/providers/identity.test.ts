import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { findAdapter, registerAdapter, resetRegistry } from "@/lib/providers/registry";
import type { ProviderAdapter } from "@/lib/providers/contract";
import type { ProviderType } from "@/lib/supabase/provider-type";

// ============================================================================
// Invariants du modèle d'identité des providers.
//
// Ces tests verrouillent une distinction architecturale : un provider est une
// INSTANCE, `type` désigne le LOGICIEL. La confondre produit des bugs
// difficiles à voir (attribuer les annonces d'un établissement à un autre).
//
// Voir docs/provider-identity.md.
//
// VOLONTAIREMENT ABSENT : aucun test n'impose « un provider ne peut avoir
// qu'un seul credential sortant ». Cette question métier n'est pas tranchée,
// et bloquer le sync sur cette hypothèse casserait de la production
// aujourd'hui. Voir le §"Piège connu" du document.
// ============================================================================

const PROVIDER_A = { id: "provider-a-uuid", type: "sejoura" as ProviderType, name: "Séjourra" };
const PROVIDER_B = { id: "provider-b-uuid", type: "sejoura" as ProviderType, name: "Séjourra" };

/** Adapter neutre : ces tests portent sur la résolution, pas sur un logiciel. */
function stubAdapter(id: string): ProviderAdapter {
  const noAvailability = {
    available: true,
    availabilityCount: 0,
    totalAmount: null,
    currency: "XOF",
    amountSource: "provider" as const,
    resourceRef: null,
  };
  return {
    id,
    capabilities: { booking: true, cancellation: true, arrivalTracking: false },
    quote: async () => noAvailability,
    create: async () => ({ bookingId: "B-1", status: "confirmed" }),
    cancel: async () => ({ status: "cancelled" }),
  };
}

function readRepoFile(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("Règle 1 — provider.id est l'instance, pas le logiciel", () => {
  it("distingue l'identité de chaque instance", () => {
    expect(PROVIDER_A.id).not.toBe(PROVIDER_B.id);
  });

  it("permet à deux instances de porter le même name", () => {
    // Le name est un libellé : il ne peut pas servir de clé.
    expect(PROVIDER_A.name).toBe(PROVIDER_B.name);
    expect(PROVIDER_A.id).not.toBe(PROVIDER_B.id);
  });
});

describe("Règle 2 — plusieurs providers partagent le même type", () => {
  it("accepte deux providers sejoura d'id distincts", () => {
    expect(PROVIDER_A.type).toBe(PROVIDER_B.type);
    expect(PROVIDER_A.type).toBe("sejoura");
    expect(PROVIDER_A.id).not.toBe(PROVIDER_B.id);
  });

  it("n'impose aucune contrainte d'unicité sur le type", () => {
    // Invariant de schéma : si un UNIQUE(type) réapparaissait, deux
    // établissements d'un même PMS ne pourraient plus se connecter.
    const schema = readRepoFile("supabase/schema.sql");
    const providersBlock = schema.slice(
      schema.indexOf("CREATE TABLE providers"),
      schema.indexOf("COMMENT ON TABLE providers")
    );

    expect(providersBlock).not.toMatch(/UNIQUE\s*\(\s*type\s*\)/i);
  });
});

describe("Règle 3 — le type se déduit de providers.type, jamais du name", () => {
  it("résout l'adapter via le type", () => {
    resetRegistry();
    registerAdapter(stubAdapter("sejoura"));

    expect(findAdapter("sejoura")).not.toBeNull();
    resetRegistry();
  });

  it("ne résout jamais à partir d'un nom de provider", () => {
    const registry = readRepoFile("src/lib/providers/registry.ts");

    // Aucune résolution par `name` : le name est un texte libre.
    expect(registry).not.toMatch(/\.name\s*===/);
  });

  it("utilise bien une Map indexée par type", () => {
    const registry = readRepoFile("src/lib/providers/registry.ts");

    expect(registry).toMatch(/new Map<string,\s*ProviderAdapter>\(\)/);
  });

  it("laisse un provider unknown sans adapter", () => {
    resetRegistry();
    registerAdapter(stubAdapter("sejoura"));

    // Aucun repli : `unknown` ne doit JAMAIS hériter de l'adapter d'un autre.
    expect(findAdapter("unknown")).toBeNull();
    resetRegistry();
  });
});

describe("Règle 4 — le sync reconnaît un provider, il ne le crée pas", () => {
  it("déduit le provider_id du préfixe de la clé API", () => {
    const syncRoute = readRepoFile("src/app/api/v1/sync/route.ts");

    // Seule source autorisée de provider_id.
    expect(syncRoute).toContain("parseProviderIdFromKey(apiKey)");
  });

  it("ne crée jamais de provider pendant une synchronisation", () => {
    const syncRoute = readRepoFile("src/app/api/v1/sync/route.ts");

    expect(syncRoute).not.toMatch(/\.from\("providers"\)\s*\.\s*insert/);
    expect(syncRoute).not.toMatch(/\.from\("providers"\)\s*\.\s*upsert/);
  });

  it("ne déduit jamais le provider d'un titre ou d'un nom de listing", () => {
    const syncRoute = readRepoFile("src/app/api/v1/sync/route.ts");

    // Un titre n'est pas une identité : l'utiliser créerait des providers
    // parasites, ou fusionnerait deux établissements homonymes.
    expect(syncRoute).not.toMatch(/provider_id\s*[:=][^=]*item\.title/);
    expect(syncRoute).not.toMatch(/provider_id\s*[:=][^=]*item\.name/);
  });
});

describe("Règle 5 — identité d'une annonce", () => {
  it("s'appuie sur le TRIPLET (provider_id, tenant_ref, external_id)", () => {
    // Phase 2D.39 : le provider est une CONNEXION SaaS, pas un tenant. Deux
    // tenants du même provider peuvent légitimement utiliser le même
    // external_id, donc l'identité doit porter le tenant.
    //
    // La garantie finale reste une CONTRAINTE DE BASE, pas une convention
    // applicative : c'est ce qui protège contre le doublon en cas de
    // régression ou d'écriture concurrente.
    const migration = readRepoFile(
      "supabase/migrations/20261005000000_multi_tenant_integration_scopes.sql"
    );
    expect(migration).toMatch(
      /create unique index if not exists uq_listings_tenant_external\s*\n\s*on public\.listings \(provider_id, tenant_ref, external_id\)/,
    );
    // NULLS NOT DISTINCT : sans lui, deux listings legacy (tenant_ref NULL)
    // cesseraient d'être uniques et perdraient l'unicité d'avant la bascule.
    expect(migration).toMatch(/nulls not distinct/);
  });

  it("n'expose pas tenant_ref au catalogue public", () => {
    // La colonne vit dans `listings`, mais le catalogue énumère ses colonnes :
    // `tenant_ref` n'y figure pas, donc il n'est pas retourné.
    const listingsSelect = readRepoFile("src/lib/supabase/listings.ts");
    const block = listingsSelect.slice(
      listingsSelect.indexOf("LISTINGS_SELECT"),
      listingsSelect.indexOf("`;", listingsSelect.indexOf("LISTINGS_SELECT"))
    );
    expect(block).not.toMatch(/tenant_ref/);
  });

  it("considère deux providers de même type comme deux annonces distinctes", () => {
    const identity = (providerId: string, externalId: string) => `${providerId}:${externalId}`;

    expect(identity(PROVIDER_A.id, "rt:42")).not.toBe(identity(PROVIDER_B.id, "rt:42"));
    expect(identity(PROVIDER_A.id, "rt:42")).toBe(identity(PROVIDER_A.id, "rt:42"));
  });
});

describe("Documentation — le modèle est explicite et cohérent", () => {
  it("le schéma ne décrit plus un provider comme un logiciel métier", () => {
    const schema = readRepoFile("supabase/schema.sql");
    const headerBlock = schema.slice(
      schema.indexOf("-- 3. TABLE: providers"),
      schema.indexOf("CREATE TABLE providers")
    );

    // Formulation historique, source de confusion.
    expect(headerBlock).not.toMatch(/Chaque logiciel métier.*est un provider/);
    // Formulation corrective.
    expect(headerBlock).toMatch(/INSTANCE \/ CLIENT \/ CONNEXION/i);
  });

  it("documente le modèle dans docs/provider-identity.md", () => {
    const doc = readRepoFile("docs/provider-identity.md");

    expect(doc).toMatch(/provider\.id/);
    expect(doc).toMatch(/provider\.type/);
    // Le piège multi-credentials est documenté comme PIEGE, pas comme un bug
    // confirmé : la question métier n'est pas tranchée.
    expect(doc).toMatch(/Piège connu/);
  });

  it("documente le credential sortant dans le schéma", () => {
    // Le credential sortant vit sur providers : le dire évite qu'on ajoute
    // un troisième stockage.
    expect(readRepoFile("supabase/schema.sql")).toMatch(/credential SORTANT/i);
  });
});
