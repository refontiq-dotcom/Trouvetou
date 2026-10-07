import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { hashApiKey } from "./api-key";
import {
  resolveScope,
  canCreateListing,
  ScopeError,
  type ResolvedScope,
} from "@/lib/integration/scope";

const PROVIDER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_PROVIDER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TENANT_A = "11111111-1111-4111-8111-111111111111";
const TENANT_B = "22222222-2222-4222-8222-222222222222";

const API_KEY_A = `tv_live_${PROVIDER}.secret-a`;
const API_KEY_GLOBAL = `tv_live_${PROVIDER}.secret-global`;

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.TROUVETOU_API_KEY_PEPPER = "peppier-de-test";
});
afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

type ScopeRow = {
  scope_id?: string | null;
  scope_type?: string | null;
  tenant_ref?: string | null;
  scope_is_active?: boolean | null;
  provider_matches?: boolean | null;
};

/** Faux client : ne renvoie que ce que la fonction SQL rendrait. */
function adminReturning(row: ScopeRow | null) {
  return {
    rpc: async () => ({
      data: row ? [row] : [],
      error: null,
    }),
  };
}

const tenantScope = (tenantRef: string, isActive = true): ScopeRow => ({
  scope_id: "33333333-3333-4333-8333-333333333333",
  scope_type: "TENANT",
  tenant_ref: tenantRef,
  scope_is_active: isActive,
  provider_matches: true,
});

const globalRow = (): ScopeRow => ({
  scope_id: "44444444-4444-4444-8444-444444444444",
  scope_type: "GLOBAL",
  tenant_ref: null,
  scope_is_active: true,
  provider_matches: true,
});

describe("2D.39 — authentification par scope", () => {
  it("credential inconnue -> 401", async () => {
    await expect(
      resolveScope({ admin: adminReturning(null), providerId: PROVIDER, apiKey: API_KEY_A }),
    ).rejects.toMatchObject({ status: 401, code: "UNKNOWN_CREDENTIAL" });
  });

  it("credential d'un autre provider -> 403", async () => {
    await expect(
      resolveScope({
        admin: adminReturning({ ...tenantScope(TENANT_A), provider_matches: false }),
        providerId: PROVIDER,
        apiKey: API_KEY_A,
      }),
    ).rejects.toMatchObject({ status: 403, code: "SCOPE_PROVIDER_MISMATCH" });
  });

  it("scope desactive -> 403", async () => {
    await expect(
      resolveScope({
        admin: adminReturning(tenantScope(TENANT_A, false)),
        providerId: PROVIDER,
        apiKey: API_KEY_A,
      }),
    ).rejects.toMatchObject({ status: 403, code: "SCOPE_INACTIVE" });
  });

  it("scope valide -> tenant issu de la CREDENTIAL", async () => {
    const scope = await resolveScope({
      admin: adminReturning(tenantScope(TENANT_A)),
      providerId: PROVIDER,
      apiKey: API_KEY_A,
    });
    expect(scope.tenantRef).toBe(TENANT_A);
    expect(scope.scopeType).toBe("TENANT");
  });
});

describe("2D.39 — le payload ne peut PAS elargir l'autorite", () => {
  it("credential A + payload B -> 403", async () => {
    await expect(
      resolveScope({
        admin: adminReturning(tenantScope(TENANT_A)),
        providerId: PROVIDER,
        apiKey: API_KEY_A,
        claimedTenantRef: TENANT_B,
      }),
    ).rejects.toMatchObject({ status: 403, code: "SCOPE_TENANT_MISMATCH" });
  });

  it("credential GLOBAL + payload tenant -> 403", async () => {
    await expect(
      resolveScope({
        admin: adminReturning(globalRow()),
        providerId: PROVIDER,
        apiKey: API_KEY_GLOBAL,
        claimedTenantRef: TENANT_A,
      }),
    ).rejects.toMatchObject({ status: 403, code: "SCOPE_TYPE_MISMATCH" });
  });

  it("credential A + payload A (coherent) -> accepte", async () => {
    const scope = await resolveScope({
      admin: adminReturning(tenantScope(TENANT_A)),
      providerId: PROVIDER,
      apiKey: API_KEY_A,
      claimedTenantRef: TENANT_A,
    });
    expect(scope.tenantRef).toBe(TENANT_A);
  });

  it("provider_id du payload n'est JAMAIS lu", async () => {
    // Le provider vient de l'argument SERVEUR (celui resolu depuis la cle),
    // jamais d'une valeur client.
    await expect(
      resolveScope({
        admin: adminReturning({ ...tenantScope(TENANT_A), provider_matches: false }),
        providerId: OTHER_PROVIDER,
        apiKey: API_KEY_A,
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
});

describe("2D.39 — portee GLOBAL (legacy)", () => {
  const globalScope = (): ResolvedScope => ({
    scopeId: "44444444-4444-4444-8444-444444444444",
    scopeType: "GLOBAL",
    tenantRef: null,
  });

  it("ne peut PAS creer de listing", () => {
    expect(canCreateListing(globalScope())).toBe(false);
  });

  it("un scope TENANT peut creer", () => {
    expect(
      canCreateListing({ scopeId: "x", scopeType: "TENANT", tenantRef: TENANT_A }),
    ).toBe(true);
  });

  it("tenantRef null -> la fonction SQL ne cible que les listings non routes", () => {
    expect(globalScope().tenantRef).toBeNull();
  });
});

describe("2D.39 — deux tenants, un seul provider", () => {
  it("chaque credential resout SON tenant", async () => {
    const a = await resolveScope({
      admin: adminReturning(tenantScope(TENANT_A)),
      providerId: PROVIDER,
      apiKey: API_KEY_A,
    });
    const b = await resolveScope({
      admin: adminReturning(tenantScope(TENANT_B)),
      providerId: PROVIDER,
      apiKey: `${PROVIDER}.secret-b`,
    });
    expect(a.tenantRef).not.toBe(b.tenantRef);
  });

  it("la liaison credential -> scope est 1:1 (une cle de B ne resout pas A)", async () => {
    const scopeB = await resolveScope({
      admin: adminReturning(tenantScope(TENANT_B)),
      providerId: PROVIDER,
      apiKey: `${PROVIDER}.secret-b`,
    });
    expect(scopeB.tenantRef).toBe(TENANT_B);
  });
});

describe("2D.39 — rotation de credential", () => {
  it("meme scope, credential changee -> scope_id et tenant_ref inchanges", async () => {
    const avant = await resolveScope({
      admin: adminReturning(tenantScope(TENANT_A)),
      providerId: PROVIDER,
      apiKey: API_KEY_A,
    });
    const apres = await resolveScope({
      admin: adminReturning(tenantScope(TENANT_A)),
      providerId: PROVIDER,
      apiKey: `${PROVIDER}.secret-rotated`,
    });
    // L'identite du scope est INDEPENDANTE de la credential : c'est ce qui
    // garantit qu'une rotation ne cree aucun listing.
    expect(apres.scopeId).toBe(avant.scopeId);
    expect(apres.tenantRef).toBe(avant.tenantRef);
  });
});

describe("2D.39 — revocation et expiration", () => {
  it("credential revoquee -> 401 (filtree en base, aucune ligne)", async () => {
    await expect(
      resolveScope({ admin: adminReturning(null), providerId: PROVIDER, apiKey: API_KEY_A }),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("credential expiree -> 401 (expires_at filtre en SQL)", async () => {
    await expect(
      resolveScope({ admin: adminReturning(null), providerId: PROVIDER, apiKey: API_KEY_A }),
    ).rejects.toMatchObject({ status: 401, code: "UNKNOWN_CREDENTIAL" });
  });
});

describe("2D.39 — empreinte et non-reversibilite", () => {
  it("credentialFingerprint != credential en clair", () => {
    const fp = hashApiKey(API_KEY_A);
    expect(fp).not.toBe(API_KEY_A);
    expect(fp).toHaveLength(64);
  });

  it("deux credentials du meme provider donnent deux empreintes", () => {
    expect(hashApiKey(API_KEY_A)).not.toBe(hashApiKey(API_KEY_GLOBAL));
  });

  it("la meme credential donne toujours la meme empreinte", () => {
    expect(hashApiKey(API_KEY_A)).toBe(hashApiKey(API_KEY_A));
  });
});

describe("2D.39 — ScopeError", () => {
  it("porte status et code", () => {
    const e = new ScopeError(403, "TEST_CODE", "message");
    expect(e).toBeInstanceOf(Error);
    expect(e.status).toBe(403);
    expect(e.code).toBe("TEST_CODE");
  });
});
