import type { ProviderType } from "@/lib/supabase/provider-type";

/**
 * Résolution du provider cible d'une rotation de clé entrante.
 *
 * PROBLÈME RÉSOLU
 *   Le Control Center identifiait le provider Séjour@ de deux façons fragiles :
 *     • par UUID codé en dur (`a5101284…`) — cassé dès la création des 4
 *       providers de la séparation des tenants ;
 *     • par `name = 'Séjoura'` + webhook, avec `.maybeSingle()` — cassé dès que
 *       DEUX providers Séjour@ actifs partagent ce nom, PostgREST renvoyant
 *       alors une erreur au lieu d'une ligne.
 *
 *   La seule identité stable est `providers.id`. Ce module l'exige, et
 *   n'accepte jamais `name` comme preuve d'identité : le nom ne sert qu'à
 *   l'affichage.
 *
 * SÉCURITÉ
 *   Le secret d'authorisation (Control Center) est vérifié par la route AVANT
 *   d'appeler ce module. Celui-ci ne fait que valider la cible, et ne renvoie
 *   jamais `api_key_hash` ni aucun credential.
 */

export interface RotationProvider {
  id: string;
  name: string;
  type: string;
  category_id: string | null;
  is_active: boolean;
}

/** Client Supabase réduit à ce dont la résolution a besoin — testable par un fake. */
export interface RotationAdminLike {
  from(table: "providers" | "categories"): RotationQuery;
}

interface RotationQuery {
  select(columns: string): RotationQuery;
  eq(column: string, value: string): RotationQuery;
  maybeSingle(): Promise<{ data: unknown; error: { message: string } | null }>;
  limit(count: number): Promise<{ data: unknown; error: { message: string } | null }>;
}

export type RotationResolution =
  | { ok: true; provider: { id: string; name: string; type: string } }
  | { ok: false; status: number; code: string; error: string };

export interface ResolveRotationTargetParams {
  admin: RotationAdminLike;
  /** Provider demandé explicitement. Prioritaire sur `fallback`. */
  providerId?: string | null;
  /** Type exigé — un provider Schooly ne doit jamais être rotatable ici. */
  expectedType?: ProviderType | null;
  /** Secteur exigé, par slug de catégorie. `null` = pas de contrainte. */
  expectedCategorySlug?: string | null;
  /**
   * Recherche historique lorsque aucun `providerId` n'est fourni.
   * Rend le comportement d'origine INTACT, mais distingue désormais
   * « aucun provider » de « plusieurs providers » au lieu d'échouer en 500.
   */
  fallback?: { name: string; webhookUrl: string } | null;
}

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * Adapte le client Supabase réel à l'interface minimale ci-dessus.
 *
 * Le client réel est très générique et ne satisfait pas structurellement
 * `RotationQuery` (les constructeurs PostgREST sont plus larges que les seuls
 * appels utilisés ici). L'adaptation est explicite et centralisée plutôt que
 * d'affaiblir l'interface — qui, elle, reste la garantie que ce module n'utilise
 * que `select`/`eq`/`maybeSingle`/`limit`, et qu'un faux suffit aux tests.
 */
export function asRotationAdmin(admin: unknown): RotationAdminLike {
  return admin as RotationAdminLike;
}

function failure(status: number, code: string, error: string): RotationResolution {
  return { ok: false, status, code, error };
}

/** Vérifie le secteur d'un provider, si le contrat en impose un. */
async function checkCategory(
  admin: RotationAdminLike,
  categoryId: string | null,
  expectedSlug: string
): Promise<RotationResolution | null> {
  const { data, error } = await admin
    .from("categories")
    .select("slug")
    .eq("id", categoryId as string)
    .maybeSingle();

  if (error) {
    return failure(500, "CATEGORY_LOOKUP", "Impossible de vérifier le secteur du fournisseur.");
  }
  const slug = (data as { slug?: string } | null)?.slug;
  if (slug !== expectedSlug) {
    return failure(
      409,
      "CATEGORY_MISMATCH",
      "Le fournisseur ne correspond pas au secteur attendu pour cette intégration."
    );
  }
  return null;
}

/** Valide type, activité et secteur d'un provider déjà chargé. */
async function validate(
  admin: RotationAdminLike,
  provider: RotationProvider,
  expectedType: ProviderType | null | undefined,
  expectedCategorySlug: string | null | undefined
): Promise<RotationResolution> {
  if (!provider.is_active) {
    return failure(409, "PROVIDER_INACTIVE", "Ce fournisseur est désactivé : rotation refusée.");
  }
  if (expectedType && provider.type !== expectedType) {
    return failure(
      409,
      "PROVIDER_TYPE_MISMATCH",
      "Le fournisseur sélectionné n'est pas du type attendu pour cette intégration."
    );
  }
  if (expectedCategorySlug) {
    const categoryError = await checkCategory(admin, provider.category_id, expectedCategorySlug);
    if (categoryError) return categoryError;
  }
  return { ok: true, provider: { id: provider.id, name: provider.name, type: provider.type } };
}

export async function resolveRotationTarget(
  params: ResolveRotationTargetParams
): Promise<RotationResolution> {
  const { admin, providerId, expectedType, expectedCategorySlug, fallback } = params;

  // ── Cas 1 : provider demandé explicitement ──────────────────────────────
  if (providerId) {
    if (!UUID_RE.test(providerId)) {
      return failure(400, "INVALID_PROVIDER_ID", "L'identifiant de fournisseur est invalide.");
    }
    const { data, error } = await admin
      .from("providers")
      .select("id, name, type, category_id, is_active")
      .eq("id", providerId)
      .maybeSingle();

    if (error) {
      return failure(500, "PROVIDER_LOOKUP", "Impossible de vérifier le fournisseur demandé.");
    }
    if (!data) {
      return failure(404, "PROVIDER_NOT_FOUND", "Le fournisseur demandé est introuvable.");
    }
    return validate(admin, data as RotationProvider, expectedType, expectedCategorySlug);
  }

  // ── Cas 2 : recherche historique (comportement d'origine) ────────────────
  if (!fallback) {
    return failure(
      400,
      "PROVIDER_ID_REQUIRED",
      "Aucun fournisseur ciblé : transmettez providerId pour cette intégration."
    );
  }

  const { data, error } = await admin
    .from("providers")
    .select("id, name, type, category_id, is_active")
    .eq("name", fallback.name)
    .limit(2);

  if (error) {
    return failure(500, "PROVIDER_LOOKUP", "Impossible de trouver le fournisseur attendu.");
  }

  const matches = (data ?? []) as RotationProvider[];

  if (matches.length === 0) {
    return failure(404, "PROVIDER_NOT_FOUND", "Le fournisseur attendu est introuvable.");
  }
  // C'est ici que `.maybeSingle()` échouait en 500 dès le deuxième provider
  // Séjour@ actif. On renvoie un conflit explicite et actionnable.
  if (matches.length > 1) {
    const ids = matches.map((m) => m.id).join(", ");
    return failure(
      409,
      "AMBIGUOUS_PROVIDER",
      `Plusieurs fournisseurs correspondent (${ids}). Ciblez-en un explicitement via providerId.`
    );
  }

  return validate(admin, matches[0], expectedType, expectedCategorySlug);
}
