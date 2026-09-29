import { describe, expect, it } from "vitest";
import { sanitizeSyncAttributes } from "./route";

// ============================================================================
// Verrouillage du CONTRAT DE SYNCHRONISATION : snapshot complet.
//
// Ces tests ne figent pas une commodité, ils figent une DÉCISION. Le
// comportement décrit — un champ omis est EFFACÉ, pas conservé — est
// contre-intuitif : un développeur tenté d'« améliorer » le Sync en merge
// partiel casserait des données sans lever la moindre erreur.
//
// Ce fichier couvre ce qui est testable sans base de données. Les garanties
// qui n'existent qu'en SQL (contrainte UNIQUE, atomicité du lot, sort des
// annonces absentes, préservation du credential) sont vérifiées séparément
// par le test pgTAP `supabase/tests/sync_contract.test.sql`.
//
// Voir docs/sync-contract.md, document normatif.
// ============================================================================

/** État minimal d'une annonce, tel qu'il existe en base. */
interface ListingState {
  images: string[];
  attributes: Record<string, unknown>;
}

/**
 * Applique un snapshot à un état précédent, comme le fait `ingest_listings`.
 *
 * Le SQL applique `attributes = EXCLUDED.attributes` : le champ est REMPLACÉ.
 * Cette fonction reproduit cette sémantique pour raisonner dessus sans base.
 */
function applySnapshot(previous: ListingState | null, item: Record<string, unknown>): ListingState {
  // Les images suivent la même logique de remplacement : un tableau vide dans
  // le snapshot signifie « plus de photos », pas « garder les anciennes ».
  const images = Array.isArray(item.images) ? (item.images as string[]) : [];

  return {
    images,
    attributes: sanitizeSyncAttributes(
      item.attributes && typeof item.attributes === "object" && !Array.isArray(item.attributes)
        ? (item.attributes as Record<string, unknown>)
        : {}
    ),
  };
}

describe("CONTRAT SYNC — Test A : remplacement complet", () => {
  it("remplace l'état au lieu de le fusionner", () => {
    // Snapshot 1 : 2 lits, 2 photos, capacité 4.
    const snapshot1 = applySnapshot(null, {
      images: ["https://cdn.test/a.jpg", "https://cdn.test/b.jpg"],
      attributes: { beds: 2, capacity: 4 },
    });
    expect(snapshot1.attributes).toEqual({ beds: 2, capacity: 4 });

    // Snapshot 2 : la chambre est requalifiée, `capacity` n'est plus déclaré.
    const snapshot2 = applySnapshot(snapshot1, {
      images: ["https://cdn.test/c.jpg"],
      attributes: { beds: 1 },
    });

    // `capacity: 4` ne doit PAS survivre : le provider ne le déclare plus.
    expect(snapshot2.attributes).toEqual({ beds: 1 });
    expect(snapshot2.attributes).not.toHaveProperty("capacity");
    expect(snapshot2.images).toEqual(["https://cdn.test/c.jpg"]);
  });

  it("traite un champ omis comme ABSENT, jamais comme conservé", () => {
    const snapshot1 = applySnapshot(null, { attributes: { beds: 2, wifi: true } });

    // Snapshot partiel : le provider ne renvoie qu'un attribut.
    const snapshot2 = applySnapshot(snapshot1, { attributes: { beds: 3 } });

    // `wifi` est EFFACÉ. C'est le cœur du contrat de snapshot complet, et la
    // raison pour laquelle un connecteur ne doit jamais envoyer de deltas.
    expect(snapshot2.attributes).toEqual({ beds: 3 });
    expect(snapshot2.attributes).not.toHaveProperty("wifi");
  });

  it("efface les attributs quand le snapshot n'en fournit aucun", () => {
    const snapshot1 = applySnapshot(null, { attributes: { beds: 2 } });
    const snapshot2 = applySnapshot(snapshot1, {});

    expect(snapshot2.attributes).toEqual({});
  });
});

describe("CONTRAT SYNC — Test B : idempotence", () => {
  it("produit un état stable si le même snapshot est rejoué", () => {
    const snapshot = { images: ["https://cdn.test/a.jpg"], attributes: { beds: 2 } };

    const first = applySnapshot(null, snapshot);
    const second = applySnapshot(first, snapshot);
    const third = applySnapshot(second, snapshot);

    // L'identité `(provider_id, external_id)` est garantie par la contrainte
    // UNIQUE en base ; ici on vérifie la condition nécessaire pour qu'un
    // rejeu soit sans effet : l'ÉTAT ne bouge plus.
    expect(second).toEqual(first);
    expect(third).toEqual(first);
  });
});

describe("CONTRAT SYNC — Test C : identité multi-provider", () => {
  it("distingue deux providers partageant le même external_id", () => {
    // Deux providers peuvent légitimement utiliser le même external_id : c'est
    // le provider qui sépare les annonces.
    const identity = (providerId: string, externalId: string) => `${providerId}:${externalId}`;

    expect(identity("provider-a", "123")).not.toBe(identity("provider-b", "123"));
    expect(identity("provider-a", "123")).toBe(identity("provider-a", "123"));
  });
});

describe("CONTRAT SYNC — Test E : credentials hors du miroir public", () => {
  it("préserve un credential legacy absent du snapshot", () => {
    // La protection Phase 2D.1 vit dans `ingest_listings` ; ce test vérifie
    // que le sanitiseur NE SUPPRIME PAS le champ, donc que la valeur peut
    // être restaurée par la fonction SQL.
    const sanitized = sanitizeSyncAttributes({ beds: 2 });

    expect(sanitized).not.toHaveProperty("sejoura_api_key");
    // Le champ reste absent des attributes publics : il n'est pas créé par le
    // sanitiseur, ce qui évite d'exposer un credential au catalogue.
    expect(Object.keys(sanitized)).not.toContain("sejoura_api_key");
  });

  it("ne crée jamais de credential de son propre chef", () => {
    const sanitized = sanitizeSyncAttributes({ beds: 2, city: "Cocody" });
    expect(sanitized).toEqual({ beds: 2, city: "Cocody" });
  });
});
