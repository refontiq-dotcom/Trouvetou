import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { generateApiKey, hashApiKey } from "@/lib/sync/api-key";

const INTEGRATIONS = {
  sejoura: {
    trouvetou: {
      providerId: "7a358385-6a88-4c8e-8e93-ef743a5ff218",
      providerName: "Séjoura",
      category: "hotel",
    },
  },
  schooly: {
    trouvetou: {
      providerId: "79402646-081e-490e-9096-e1cd3caa7a8c",
      providerName: "Schooly",
      category: "school",
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

  if (payload.providerId !== undefined && payload.providerId !== integration.providerId) {
    return NextResponse.json({ error: "Le fournisseur demandé ne correspond pas à cette intégration." }, { status: 409 });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Configuration serveur Trouvetou incomplète." }, { status: 500 });
  }

  const { data: provider, error: providerError } = await admin
    .from("providers")
    .select("id, name, is_active")
    .eq("id", integration.providerId)
    .eq("name", integration.providerName)
    .eq("is_active", true)
    .maybeSingle();

  if (providerError) {
    console.error("[control-center key rotation] provider lookup failed", providerError);
    return NextResponse.json({ error: "Impossible de vérifier le fournisseur Trouvetou." }, { status: 500 });
  }

  if (!provider) {
    return NextResponse.json(
      { error: "Le fournisseur " + integration.providerName + " de production est introuvable ou inactif." },
      { status: 404 },
    );
  }

  const { data: category, error: categoryError } = await admin
    .from("providers")
    .select("category_id, categories!inner(slug)")
    .eq("id", provider.id)
    .maybeSingle();

  if (categoryError || !category) {
    console.error("[control-center key rotation] category lookup failed", categoryError);
    return NextResponse.json({ error: "Impossible de vérifier le secteur du fournisseur." }, { status: 500 });
  }

  const categorySlug = Array.isArray(category.categories) ? category.categories[0]?.slug : category.categories?.slug;
  if (categorySlug !== integration.category) {
    return NextResponse.json({ error: "Le fournisseur ne correspond pas au secteur attendu pour cette intégration." }, { status: 409 });
  }

  const newApiKey = generateApiKey(provider.id);
  const newHash = hashApiKey(newApiKey);

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
