import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  resolveOutboundCredential,
  usesLegacyCredential,
  type OutboundCredentialSources,
} from "./resolver";
import { decryptCredential, encryptCredential } from "./encryption";

// ============================================================================
// Tests de la résolution du credential sortant.
//
// Ces tests prouvent l'ORDRE DE PRIORITÉ, cœur de la migration progressive :
// le credential du provider gagne toujours, le legacy n'est qu'un filet.
// ============================================================================

const TEST_KEY = "c".repeat(64);
const originalKey = process.env.TROUVETOU_CREDENTIAL_ENCRYPTION_KEY;

const PROVIDER_SECRET = "secret-officiel-de-test";
const LEGACY_SECRET = "secret-legacy-de-test";

beforeEach(() => {
  process.env.TROUVETOU_CREDENTIAL_ENCRYPTION_KEY = TEST_KEY;
});

afterEach(() => {
  if (originalKey === undefined) delete process.env.TROUVETOU_CREDENTIAL_ENCRYPTION_KEY;
  else process.env.TROUVETOU_CREDENTIAL_ENCRYPTION_KEY = originalKey;
});

function sources(overrides: Partial<OutboundCredentialSources> = {}): OutboundCredentialSources {
  return { encrypted: null, listingAttributes: null, ...overrides };
}

describe("resolveOutboundCredential — source officielle", () => {
  it("utilise le credential chiffré du provider", () => {
    expect(
      resolveOutboundCredential(sources({ encrypted: encryptCredential(PROVIDER_SECRET) }))
    ).toBe(PROVIDER_SECRET);
  });

  it("donne la PRIORITÉ au provider même si le legacy diffère", () => {
    // Invariant central : le résultat ne doit pas dépendre de l'annonce
    // consultée, sinon deux annonces d'un même provider partageraient des
    // credentials différents.
    expect(
      resolveOutboundCredential(
        sources({
          encrypted: encryptCredential(PROVIDER_SECRET),
          listingAttributes: { sejoura_api_key: LEGACY_SECRET },
        })
      )
    ).toBe(PROVIDER_SECRET);
  });

  it("ne signale pas de repli quand le credential officiel est utilisé", () => {
    const s = sources({
      encrypted: encryptCredential(PROVIDER_SECRET),
      listingAttributes: { sejoura_api_key: LEGACY_SECRET },
    });
    expect(usesLegacyCredential(s)).toBe(false);
  });
});

describe("resolveOutboundCredential — repli legacy", () => {
  it("utilise le credential legacy si le provider n'en a pas", () => {
    const s = sources({ listingAttributes: { sejoura_api_key: LEGACY_SECRET } });
    expect(resolveOutboundCredential(s)).toBe(LEGACY_SECRET);
    expect(usesLegacyCredential(s)).toBe(true);
  });

  it("ignore un attribut legacy vide ou non textuel", () => {
    expect(
      resolveOutboundCredential(sources({ listingAttributes: { sejoura_api_key: "" } }))
    ).toBeNull();
    expect(
      resolveOutboundCredential(sources({ listingAttributes: { sejoura_api_key: 42 } }))
    ).toBeNull();
  });

  it("ignore un credential provider vide", () => {
    // Une chaîne vide n'est pas un credential : elle ne doit pas masquer un
    // repli valide.
    const s = sources({ encrypted: "", listingAttributes: { sejoura_api_key: LEGACY_SECRET } });
    expect(resolveOutboundCredential(s)).toBe(LEGACY_SECRET);
  });
});

describe("resolveOutboundCredential — absence et panne", () => {
  it("retourne null si aucune source n'est disponible", () => {
    // L'appelant transforme ce null en 409 BOOKING_NOT_AVAILABLE, le
    // comportement public historique.
    expect(resolveOutboundCredential(sources())).toBeNull();
    expect(resolveOutboundCredential(sources({ listingAttributes: {} }))).toBeNull();
  });

  it("lève au lieu de retomber silencieusement sur le legacy", () => {
    // Replier sur un secret périmé masquerait une panne de configuration et
    // enverrait une clé peut-être révoquée au provider.
    expect(() =>
      resolveOutboundCredential(
        sources({
          encrypted: "v1:0000000000000000000000:00000000000000000000000000000000:00",
          listingAttributes: { sejoura_api_key: LEGACY_SECRET },
        })
      )
    ).toThrow();
  });

  it("ne divulgue ni le ciphertext ni le legacy dans l'erreur", () => {
    const broken = "v1:0000000000000000000000:00000000000000000000000000000000:00";
    try {
      resolveOutboundCredential(
        sources({ encrypted: broken, listingAttributes: { sejoura_api_key: LEGACY_SECRET } })
      );
      expect.unreachable("le déchiffrement doit échouer");
    } catch (error: unknown) {
      expect(String(error)).not.toContain(broken);
      expect(String(error)).not.toContain(LEGACY_SECRET);
    }
  });
});

describe("Déterminisme et intégrité", () => {
  it("renvoie le MÊME credential pour deux annonces du même provider", () => {
    // Deux listings peuvent porter des valeurs legacy différentes ; une fois
    // le credential officiel en place, les deux doivent converger.
    const encrypted = encryptCredential(PROVIDER_SECRET);
    const first = resolveOutboundCredential(
      sources({ encrypted, listingAttributes: { sejoura_api_key: "legacy-a" } })
    );
    const second = resolveOutboundCredential(
      sources({ encrypted, listingAttributes: { sejoura_api_key: "legacy-b" } })
    );

    expect(first).toBe(second);
    expect(first).toBe(PROVIDER_SECRET);
  });

  it("fait l'aller-retour complet : chiffre, stocke, relit, résout", () => {
    const stored = encryptCredential(PROVIDER_SECRET);
    // Ce que la base relit n'est PAS le secret : le resolver le retrouve.
    expect(stored).not.toContain(PROVIDER_SECRET);
    expect(resolveOutboundCredential(sources({ encrypted: stored }))).toBe(PROVIDER_SECRET);
    expect(decryptCredential(stored)).toBe(PROVIDER_SECRET);
  });
});
