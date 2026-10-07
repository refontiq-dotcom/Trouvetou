import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { generateApiKey, hashApiKey } from "@/lib/sync/api-key";
import { asRotationAdmin, resolveRotationTarget } from "@/lib/control-center/resolve-rotation-target";
import type { ProviderType } from "@/lib/supabase/provider-type";

/**
 * Intégrations autorisées à la rotation de clé entrante.
 *
 * Ce registre décrit le CONTRAT de l'intégration (type de provider + secteur),
 * plus l'ID historique de repli. Il ne doit plus porter l'identité courante :
 * celle-ci est transmise par l'appelant via `providerId`, ce qui permet de
 * piloter plusieurs providers d'un même logiciel après la séparation des
 * tenants Séjour@ (un provider = un tenant = une clé).
 *
 * `defaultProviderId` n'est qu'un REPLI : il préserve le comportement d'origine
 * tant que l'appelant ne cible pas explicitement un provider. Il n'est jamais
 * utilisé pour valider — seule la lecture en base fait foi.
 *
 * NOTE `providerType` : l'énumération `provider_type` ne contient aujourd'hui
 * que `unknown` et `sejoura`. Schooly n'a pas encore de type propre, son
 * provider est donc `unknown` : on ne peut pas filtrer sur un type inexistant.
 * Son identité repose alors sur le SECTEUR (`school`), ce qui reste un
 * contrôle en base et non une confiance dans le nom. Dès qu'un type `schooly`
 * existera, il suffira de renseigner ce champ.
 */
const INTEGRATIONS = {
  sejoura: {
    trouvetou: {
      providerType: "sejoura" as ProviderType,
      category: "hotel",
      defaultProviderId: "a5101284-2d97-46e0-a0f2-fa6a008588f2",
    },
  },
  schooly: {
    trouvetou: {
      providerType: null as ProviderType | null,
      category: "school",
      defaultProviderId: "79402646-081e-490e-9096-e1cd3caa7a8c",
    },
  },
} as const;

function safeSecretEqual(expected: string, candidate: string): boolean {
  if (!expected || !candidate) return false;
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(candidate, "utf8");
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; integrationId: string }> },
): Promise<NextResponse> {
  const expectedSecret = process.env.REFONTIQ_CONTROL_CENTER_SECRET;
  const receivedSecret = req.headers.get("x-refontiq-control-center-secret") ?? "";

  if (!expectedSecret || !safeSecretEqual(expectedSecret, receivedSecret)) {
    return NextResponse.json({ error: "Accès interne refusé." }, { status: 401 });
  }

  const { projectId, integrationId } = await params;
  const project = INTEGRATIONS[projectId as keyof typeof INTEGRATIONS];
  const integration = project?.[integrationId as keyof typeof project];

  if (!integration) {
    return NextResponse.json({ error: "Intégration inconnue ou non autorisée." }, { status: 404 });
  }

  let payload: { providerId?: unknown } = {};
  try {
    payload = await req.json();
  } catch {
    // No body is required; the server-side registry is authoritative.
  }

  const requestedProviderId =
    typeof payload.providerId === "string" ? payload.providerId : null;

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Configuration serveur Trouvetou incomplète." }, { status: 500 });
  }

  // Résolution dynamique : le provider visé est celui demandé, à défaut le
  // repli historique. Le type et le secteur sont TOUJOURS vérifiés en base —
  // un provider Schooly ne peut pas être rotaté via l'intégration Séjour@,
  // quelle que soit la valeur transmise.
  const resolution = await resolveRotationTarget({
    admin: asRotationAdmin(admin),
    providerId: requestedProviderId ?? integration.defaultProviderId,
    expectedType: integration.providerType,
    expectedCategorySlug: integration.category,
  });

  if (!resolution.ok) {
    console.error(
      `[control-center key rotation] ${resolution.code} (${projectId}/${integrationId})`
    );
    return NextResponse.json({ error: resolution.error }, { status: resolution.status });
  }

  const provider = resolution.provider;
  const newApiKey = generateApiKey(provider.id);
  const newHash = hashApiKey(newApiKey);

  // La mise à jour cible UNIQUEMENT le provider résolu : la rotation de A
  // ne peut pas toucher B, même si les deux sont de type `sejoura`.
  const { error: updateError } = await admin
    .from("providers")
    .update({ api_key_hash: newHash })
    .eq("id", provider.id);

  if (updateError) {
    console.error("[control-center key rotation] provider update failed", updateError);
    return NextResponse.json({ error: "Impossible de mettre à jour la clé d'intégration." }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    projectId,
    integrationId,
    provider: { id: provider.id, name: provider.name },
    apiKey: newApiKey,
    warning: "Cette clé est affichée une seule fois. Configurez-la immédiatement dans l'environnement Production du projet.",
  });
}
