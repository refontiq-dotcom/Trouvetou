/**
 * PHASE 2D.22 — Simulation LOCALE de la correspondance clé → provider.
 *
 * AUCUNE écriture, AUCUNE production, AUCUNE activation. Ce test ne fait
 * qu'appeler les fonctions de production (`generateApiKey`, `parseProviderIdFromKey`,
 * `hashApiKey`, `secureCompare`) et vérifier, par l'observation, qu'une clé
 * dédiée ne peut authentifier QUE son propre provider.
 *
 * Les UUID sont synthétiques et n'existent dans aucune base.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  generateApiKey,
  parseProviderIdFromKey,
  hashApiKey,
  secureCompare,
} from "./api-key";

const A510 = "a5101284-2d97-46e0-a0f2-fa6a008588f2";
const LEGACY_7A358 = "7a358385-6a88-4c8e-8e93-ef743a5ff218";
const GAGE = "11111111-1111-4111-8111-111111111111";
const DADY = "22222222-2222-4222-8222-222222222222";
const LE_MONDE = "33333333-3333-4333-8333-333333333333";
const PLAZZA = "44444444-4444-4444-8444-444444444444";

const DEDIES = { GAGE, DADY, LE_MONDE, PLAZZA } as const;

beforeEach(() => {
  process.env.TROUVETOU_API_KEY_PEPPER = "peppier-de-test-local";
});
afterEach(() => {
  delete process.env.TROUVETOU_API_KEY_PEPPER;
});

describe("2D.22 — une clé → exactement un provider", () => {
  const cles = Object.fromEntries(
    Object.entries(DEDIES).map(([nom, id]) => [nom, generateApiKey(id)])
  ) as Record<keyof typeof DEDIES, string>;

  it("§9 — chaque clé extrait LE provider visé, et lui seul", () => {
    for (const [nom, id] of Object.entries(DEDIES)) {
      expect(parseProviderIdFromKey(cles[nom as keyof typeof DEDIES])).toBe(id);
    }
  });

  it("§9 — aucune clé ne résout vers a510 ni vers le legacy 7a358", () => {
    for (const nom of Object.keys(cles) as Array<keyof typeof DEDIES>) {
      const resolu = parseProviderIdFromKey(cles[nom]);
      expect(resolu).not.toBe(A510);
      expect(resolu).not.toBe(LEGACY_7A358);
    }
  });

  it("§9 — les clés sont distinctes et leurs empreintes distinctes", () => {
    const empreintes = Object.values(cles).map(hashApiKey);
    expect(new Set(empreintes).size).toBe(4);
    expect(new Set(Object.values(cles)).size).toBe(4);
  });

  it("§8 — une empreinte n'authentifie que SON provider", () => {
    // Base simulée : chaque provider ne connaît que l'empreinte de sa clé.
    const table = new Map(
      Object.entries(DEDIES).map(([nom, id]) => [id, hashApiKey(cles[nom as keyof typeof DEDIES])])
    );

    for (const [nom, id] of Object.entries(DEDIES)) {
      const candidat = hashApiKey(cles[nom as keyof typeof DEDIES]);
      // 1. Authentifie chez le bon provider.
      expect(secureCompare(table.get(id)!, candidat)).toBe(true);
      // 2. N'authentifie chez AUCUN autre.
      for (const [autreNom, autreId] of Object.entries(DEDIES)) {
        if (autreId === id) continue;
        expect(secureCompare(table.get(autreId)!, candidat)).toBe(false);
        void autreNom;
      }
    }
  });

  it("§8 — la valeur `pending:` d'un provider inactif n'authentifie personne", () => {
    // C'est l'état dans lequel la 2D.19 laisse les 4 providers.
    const hashPending = "pending:gage";
    for (const nom of Object.keys(cles) as Array<keyof typeof DEDIES>) {
      expect(secureCompare(hashPending, hashApiKey(cles[nom]))).toBe(false);
    }
  });

  it("§6 — le providerId est inséré en clair dans la clé, et relu à l'identique", () => {
    for (const [nom, id] of Object.entries(DEDIES)) {
      const cle = generateApiKey(id);
      expect(cle.startsWith(`tv_live_${id}.`)).toBe(true);
      expect(parseProviderIdFromKey(cle)?.toLowerCase()).toBe(id.toLowerCase());
      void nom;
    }
  });

  it("§6 — une clé dont le providerId est falsifié ne résout pas vers l'original", () => {
    // Garantit qu'un secret valide associé à un AUTRE providerId ne peut pas
    // être présenté comme la clé d'un provider existant.
    const cleGage = generateApiKey(GAGE);
    const faux = cleGage.replace(GAGE, DADY);
    expect(parseProviderIdFromKey(faux)).toBe(DADY);
    // ...et son empreinte ne correspond pas à celle que DADY connaît.
    expect(secureCompare(hashApiKey(faux), hashApiKey(generateApiKey(DADY)))).toBe(false);
  });

  it("§6 — une clé malformée est refusée au lieu de résoudre à un provider", () => {
    for (const mauvaise of [
      "tv_live_.secret",
      "pas-une-cle",
      `tv_live_${GAGE}`, // providerId sans séparateur
      `tv_live_${GAGE}x.secret`,
    ]) {
      expect(parseProviderIdFromKey(mauvaise)).toBeNull();
    }
  });
});
