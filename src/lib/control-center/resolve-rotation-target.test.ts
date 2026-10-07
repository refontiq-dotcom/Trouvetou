import { describe, it, expect } from "vitest";
import { resolveRotationTarget } from "./resolve-rotation-target";

// Provider fictif servant de_fixture. AUCUN provider réel n'est créé : ces
// tests ne touchent pas la base, ils vérifient la logique de sélection.

const PROVIDER_A = "11111111-1111-4111-8111-111111111111";
const PROVIDER_B = "22222222-2222-4222-8222-222222222222";
const PROVIDER_INACTIVE = "33333333-3333-4333-8333-333333333333";
const PROVIDER_SCHOOLY = "44444444-4444-4444-8444-444444444444";
const CATEGORY_HOTEL = "aaaaaaaa-0000-4000-8000-000000000001";
const CATEGORY_SCHOOL = "bbbbbbbb-0000-4000-8000-000000000002";

interface FakeProvider {
  id: string;
  name: string;
  type: string;
  category_id: string | null;
  is_active: boolean;
}

/**
 * Faux client Supabase : ne renvoie que ce qui est demandé et enregistre les
 * lectures, ce qui permet d'affirmer « la rotation de A n'a pas touché B ».
 */
function createFakeAdmin(providers: FakeProvider[], categories: Array<{ id: string; slug: string }>) {
  const reads: Array<{ table: string; filters: Record<string, string> }> = [];
  const state: { providers: FakeProvider[] } = { providers };

  const admin = {
    from(table: "providers" | "categories") {
      const filters: Record<string, string> = {};
      const query = {
        select: () => query,
        eq: (column: string, value: string) => {
          filters[column] = value;
          return query;
        },
        maybeSingle: async () => {
          reads.push({ table, filters: { ...filters } });
          const source =
            table === "providers"
              ? state.providers
              : (categories as unknown as Array<Record<string, string>>);
          const match = (source as Array<Record<string, string>>).find((row) =>
            Object.entries(filters).every(([column, value]) => row[column] === value)
          );
          return { data: match ?? null, error: null };
        },
        limit: async () => {
          reads.push({ table, filters: { ...filters } });
          const source = table === "providers" ? state.providers : categories;
          const matches = (source as Array<Record<string, string>>).filter((row) =>
            Object.entries(filters).every(([column, value]) => row[column] === value)
          );
          return { data: matches, error: null };
        },
      };
      return query;
    },
  };

  return { admin, reads, state };
}

const sejoura = (id: string, isActive = true, type = "sejoura"): FakeProvider => ({
  id,
  name: `Tenant ${id.slice(0, 4)}`,
  type,
  category_id: CATEGORY_HOTEL,
  is_active: isActive,
});

const CATEGORIES = [
  { id: CATEGORY_HOTEL, slug: "hotel" },
  { id: CATEGORY_SCHOOL, slug: "school" },
];

const resolveSey = async (providers: FakeProvider[], providerId?: string) => {
  const { admin, reads, state } = createFakeAdmin(providers, CATEGORIES);
  const result = await resolveRotationTarget({
    admin,
    providerId: providerId ?? null,
    expectedType: "sejoura",
    expectedCategorySlug: "hotel",
  });
  return { reads, state, result };
};


describe("résolution du provider de rotation", () => {
  it("Test 1 — provider Séjour@ valide : rotation ciblée sur A", async () => {
    const { result } = await resolveSey([sejoura(PROVIDER_A), sejoura(PROVIDER_B)], PROVIDER_A);
    expect(result).toEqual({
      ok: true,
      provider: { id: PROVIDER_A, name: "Tenant 1111", type: "sejoura" },
    });
  });

  it("Test 2 — la rotation de A ne touche jamais B", async () => {
    const { result, reads, state } = await resolveSey(
      [sejoura(PROVIDER_A), sejoura(PROVIDER_B)],
      PROVIDER_A
    );
    expect(result.ok).toBe(true);
    // Toute lecture de `providers` porteuse d'un filtre `id` doit viser A.
    // (La lecture de `categories` filtre elle aussi sur un `id`, mais sur une
    // autre table : c'est pourquoi le filtre porte sur la table.)
    const idFilters = reads
      .filter((r) => r.table === "providers")
      .map((r) => r.filters.id)
      .filter(Boolean);
    expect(idFilters.length).toBeGreaterThan(0);
    expect(idFilters.every((id) => id === PROVIDER_A)).toBe(true);
    expect(idFilters).not.toContain(PROVIDER_B);
    // B reste intact et inchangé.
    expect(state.providers.find((p) => p.id === PROVIDER_B)).toEqual(sejoura(PROVIDER_B));
  });

  it("Test 3 — provider inexistant : erreur explicite", async () => {
    const { result } = await resolveSey([sejoura(PROVIDER_A)], "99999999-9999-4999-8999-999999999999");
    expect(result).toMatchObject({ ok: false, status: 404, code: "PROVIDER_NOT_FOUND" });
  });

  it("Test 4 — provider inactif : erreur explicite", async () => {
    const { result } = await resolveSey([sejoura(PROVIDER_INACTIVE, false)], PROVIDER_INACTIVE);
    expect(result).toMatchObject({ ok: false, status: 409, code: "PROVIDER_INACTIVE" });
  });

  it("Test 5 — provider d'un autre type (schooly) : refusée", async () => {
    // Un provider Schooly ne doit JAMAIS être rotatable via l'intégration
    // Séjour@, même explicitement ciblé.
    const { result } = await resolveSey(
      [{ ...sejoura(PROVIDER_SCHOOLY, true, "schooly"), category_id: CATEGORY_SCHOOL }],
      PROVIDER_SCHOOLY
    );
    expect(result).toMatchObject({ ok: false, status: 409, code: "PROVIDER_TYPE_MISMATCH" });
  });

  it("refuse un providerId mal formé", async () => {
    const { result } = await resolveSey([sejoura(PROVIDER_A)], "pas-un-uuid");
    expect(result).toMatchObject({ ok: false, status: 400, code: "INVALID_PROVIDER_ID" });
  });

  it("refuse un secteur inattendu", async () => {
    const { admin } = createFakeAdmin(
      [{ ...sejoura(PROVIDER_A), category_id: CATEGORY_SCHOOL }],
      CATEGORIES
    );
    const result = await resolveRotationTarget({
      admin,
      providerId: PROVIDER_A,
      expectedType: "sejoura",
      expectedCategorySlug: "hotel",
    });
    expect(result).toMatchObject({ ok: false, status: 409, code: "CATEGORY_MISMATCH" });
  });
});

describe("repli historique (sans providerId)", () => {
  it("un seul provider Séjour@ : comportement d'origine préservé", async () => {
    const { admin } = createFakeAdmin([sejoura(PROVIDER_A)], CATEGORIES);
    const result = await resolveRotationTarget({
      admin,
      providerId: null,
      expectedType: "sejoura",
      expectedCategorySlug: "hotel",
      fallback: { name: "Tenant 1111", webhookUrl: "https://sejoura.app/sync-callback" },
    });
    expect(result).toMatchObject({ ok: true, provider: { id: PROVIDER_A } });
  });

  it("plusieurs providers Séjour@ : conflit EXPLICITE, plus d'échec en 500", async () => {
    // C'est la panne latente que cette phase corrige : `.maybeSingle()`
    // renvoyait une erreur 500 dès le 2ᵉ provider Séjour@ actif.
    // Les deux portent le MÊME nom : c'est la recherche historique par nom
    // qui les réunit ensemble, exactement comme le fera la production.
    const twins = [sejoura(PROVIDER_A), { ...sejoura(PROVIDER_B), name: "Tenant 1111" }];
    const { admin } = createFakeAdmin(twins, CATEGORIES);
    const result = await resolveRotationTarget({
      admin,
      providerId: null,
      expectedType: "sejoura",
      fallback: { name: "Tenant 1111", webhookUrl: "https://sejoura.app/sync-callback" },
    });
    expect(result).toMatchObject({ ok: false, status: 409, code: "AMBIGUOUS_PROVIDER" });
  });

  it("aucun provider trouvé : 404 explicite", async () => {
    const { admin } = createFakeAdmin([], CATEGORIES);
    const result = await resolveRotationTarget({
      admin,
      providerId: null,
      expectedType: "sejoura",
      fallback: { name: "Inconnu", webhookUrl: "https://sejoura.app/sync-callback" },
    });
    expect(result).toMatchObject({ ok: false, status: 404, code: "PROVIDER_NOT_FOUND" });
  });

  it("ni providerId ni repli : erreur, aucun choix implicite", async () => {
    const { admin } = createFakeAdmin([sejoura(PROVIDER_A)], CATEGORIES);
    const result = await resolveRotationTarget({ admin, providerId: null, expectedType: "sejoura" });
    expect(result).toMatchObject({ ok: false, status: 400, code: "PROVIDER_ID_REQUIRED" });
  });
});

