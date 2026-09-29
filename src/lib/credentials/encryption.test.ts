import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CredentialEncryptionError,
  decryptCredential,
  encryptCredential,
  isEncryptedCredential,
  secretsEqual,
} from "./encryption";

// ============================================================================
// Tests du chiffrement des credentials sortants.
//
// AUCUN TEST N'AFFICHE DE VALEUR RÉELLE : les secrets sont des constantes de
// test, et les assertions portent sur des PROPRIÉTÉS (round-trip, format,
// refus), jamais sur le contenu. Les messages d'erreur sont eux aussi
// vérifiés : une fuite y serait aussi grave qu'une fuite dans les logs.
// ============================================================================

/** Clé de test uniquement — jamais une valeur de production. */
const TEST_KEY = "a".repeat(64);
const OTHER_TEST_KEY = "b".repeat(64);

/** Secrets factices : aucune ressemblance avec un format de clé réel. */
const SECRET = "valeur-de-test-1";
const OTHER_SECRET = "valeur-de-test-2";

const originalKey = process.env.TROUVETOU_CREDENTIAL_ENCRYPTION_KEY;

beforeEach(() => {
  process.env.TROUVETOU_CREDENTIAL_ENCRYPTION_KEY = TEST_KEY;
});

afterEach(() => {
  if (originalKey === undefined) delete process.env.TROUVETOU_CREDENTIAL_ENCRYPTION_KEY;
  else process.env.TROUVETOU_CREDENTIAL_ENCRYPTION_KEY = originalKey;
});

describe("encryptCredential / decryptCredential — aller-retour", () => {
  it("restitue exactement le secret d'origine", () => {
    expect(decryptCredential(encryptCredential(SECRET))).toBe(SECRET);
  });

  it("produit un ciphertext différent du secret en clair", () => {
    const encrypted = encryptCredential(SECRET);
    expect(encrypted).not.toBe(SECRET);
    expect(encrypted).not.toContain(SECRET);
  });

  it("produit un ciphertext différent à chaque appel (IV aléatoire)", () => {
    // Sans IV aléatoire, une base compromise révélerait quels providers
    // partagent une même clé.
    expect(encryptCredential(SECRET)).not.toBe(encryptCredential(SECRET));
  });

  it("retombe sur le même secret pour une autre valeur", () => {
    expect(decryptCredential(encryptCredential(OTHER_SECRET))).toBe(OTHER_SECRET);
  });
});

describe("encryptCredential — format du ciphertext", () => {
  it("respecte le format versionné v1:iv:tag:ciphertext", () => {
    const [version, iv, tag, data] = encryptCredential(SECRET).split(":");
    expect(version).toBe("v1");
    // IV 12 octets, tag 16 octets, tous deux en hexadécimal.
    expect(iv).toMatch(/^[0-9a-f]{24}$/);
    expect(tag).toMatch(/^[0-9a-f]{32}$/);
    expect(data.length).toBeGreaterThan(0);
  });

  it("reconnaît un ciphertext et refuse un secret en clair", () => {
    expect(isEncryptedCredential(encryptCredential(SECRET))).toBe(true);
    expect(isEncryptedCredential(SECRET)).toBe(false);
    expect(isEncryptedCredential(null)).toBe(false);
  });

  it("chiffre un secret unicode sans perte", () => {
    const unicode = "clé-à-accents-🔐";
    expect(decryptCredential(encryptCredential(unicode))).toBe(unicode);
  });
});

describe("decryptCredential — refus explicites", () => {
  it("refuse un ciphertext dont le tag d'authentification est altéré", () => {
    // C'est la protection centrale de GCM : toute modification est détectée.
    const [version, iv, tag, data] = encryptCredential(SECRET).split(":");
    const alteredTag = (tag[0] === "0" ? "1" : "0") + tag.slice(1);
    expect(() => decryptCredential([version, iv, alteredTag, data].join(":"))).toThrow(
      CredentialEncryptionError
    );
  });

  it("refuse un ciphertext dont les données sont altérées", () => {
    const [version, iv, tag, data] = encryptCredential(SECRET).split(":");
    const alteredData = (data[0] === "0" ? "1" : "0") + data.slice(1);
    expect(() => decryptCredential([version, iv, tag, alteredData].join(":"))).toThrow(
      CredentialEncryptionError
    );
  });

  it("refuse une version de format inconnue", () => {
    const [, iv, tag, data] = encryptCredential(SECRET).split(":");
    expect(() => decryptCredential(["v2", iv, tag, data].join(":"))).toThrow(
      /non prise en charge/
    );
  });

  it("refuse un format malformé", () => {
    expect(() => decryptCredential("pas-un-ciphertext")).toThrow(/Format/);
    expect(() => decryptCredential("")).toThrow(CredentialEncryptionError);
  });

  it("refuse un ciphertext tronqué", () => {
    const [, iv] = encryptCredential(SECRET).split(":");
    expect(() => decryptCredential(["v1", iv, "ab", "cd"].join(":"))).toThrow(/tronqué|corrompu/);
  });

  it("refuse un ciphertext produit avec une AUTRE clé serveur", () => {
    const encrypted = encryptCredential(SECRET);
    process.env.TROUVETOU_CREDENTIAL_ENCRYPTION_KEY = OTHER_TEST_KEY;

    // Sans cela, un changement de clé en production rendrait illisible tout
    // l'existant au lieu de le signaler clairement.
    expect(() => decryptCredential(encrypted)).toThrow(CredentialEncryptionError);
  });
});

describe("Clé serveur — validation", () => {
  it("échoue explicitement si la clé est absente", () => {
    delete process.env.TROUVETOU_CREDENTIAL_ENCRYPTION_KEY;
    expect(() => encryptCredential(SECRET)).toThrow(/absente/);
  });

  it("échoue explicitement si la clé est vide", () => {
    process.env.TROUVETOU_CREDENTIAL_ENCRYPTION_KEY = "   ";
    expect(() => encryptCredential(SECRET)).toThrow(/absente/);
  });

  it("échoue explicitement si la clé est mal formée", () => {
    process.env.TROUVETOU_CREDENTIAL_ENCRYPTION_KEY = "trop-courte";
    expect(() => encryptCredential(SECRET)).toThrow(/invalide/);
  });

  it("accepte une clé de 64 octets en base64", () => {
    process.env.TROUVETOU_CREDENTIAL_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    expect(decryptCredential(encryptCredential(SECRET))).toBe(SECRET);
  });

  it("ne reproduit jamais la clé dans son message d'erreur", () => {
    process.env.TROUVETOU_CREDENTIAL_ENCRYPTION_KEY = OTHER_TEST_KEY;
    try {
      decryptCredential(encryptCredential(SECRET));
      expect.unreachable("le déchiffrement doit échouer");
    } catch (error: unknown) {
      expect(String(error)).not.toContain(OTHER_TEST_KEY);
    }
  });

  it("ne reproduit jamais le secret dans un message d'erreur", () => {
    const encrypted = encryptCredential(SECRET);
    process.env.TROUVETOU_CREDENTIAL_ENCRYPTION_KEY = OTHER_TEST_KEY;
    try {
      decryptCredential(encrypted);
      expect.unreachable("le déchiffrement doit échouer");
    } catch (error: unknown) {
      expect(String(error)).not.toContain(SECRET);
      expect(String(error)).not.toContain(encrypted);
    }
  });
});

describe("secretsEqual — détection de conflit sans fuite", () => {
  it("considère deux valeurs identiques comme égales", () => {
    expect(secretsEqual(SECRET, SECRET)).toBe(true);
  });

  it("distingue deux valeurs différentes", () => {
    expect(secretsEqual(SECRET, OTHER_SECRET)).toBe(false);
  });

  it("ne confond pas des longueurs différentes", () => {
    expect(secretsEqual(SECRET, `${SECRET}-plus-long`)).toBe(false);
  });
});
