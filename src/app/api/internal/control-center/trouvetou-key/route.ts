import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { generateApiKey, hashApiKey } from "@/lib/sync/api-key";
import { asRotationAdmin, resolveRotationTarget } from "@/lib/control-center/resolve-rotation-target";

const PRODUCTION_SEJOURA_WEBHOOK = "https://sejoura.app/sync-callback";

function safeSecretEqual(expected: string, candidate: string): boolean {
  if (!expected || !candidate) return false;
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(candidate, "utf8");
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

/**
 * Internal Control Center endpoint.
 *
 * This route is deliberately NOT part of the public Trouvetou surface.
 * It only rotates the API credential of the current production Séjoura
 * provider. The provider UUID is preserved; only api_key_hash changes.
 *
 * Required server secret:
 *   REFONTIQ_CONTROL_CENTER_SECRET
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const expectedSecret = process.env.REFONTIQ_CONTROL_CENTER_SECRET;
  const receivedSecret = req.headers.get("x-refontiq-control-center-secret") ?? "";

  if (!expectedSecret || !safeSecretEqual(expectedSecret, receivedSecret)) {
    return NextResponse.json({ error: "Accès interne refusé." }, { status: 401 });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Configuration serveur Trouvetou incomplète." },
      { status: 500 },
    );
  }

  // Ciblage explicite : `providerId` dans le corps JSON. Absent, on retombe sur
  // la recherche historique (nom + webhook) — mais celle-ci renvoie désormais
  // un conflit EXPLICITE si plusieurs providers Séjour@ correspondent, au lieu
  // d'échouer en 500 via `.maybeSingle()` dès la création des 4 providers.
  let payload: { providerId?: unknown } = {};
  try {
    payload = await req.json();
  } catch {
    // Corps optionnel : la route reste appelable sans body.
  }
  const requestedProviderId = typeof payload.providerId === "string" ? payload.providerId : null;

  const resolution = await resolveRotationTarget({
    admin: asRotationAdmin(admin),
    providerId: requestedProviderId,
    expectedType: "sejoura",
    fallback: { name: "Séjoura", webhookUrl: PRODUCTION_SEJOURA_WEBHOOK },
  });

  if (!resolution.ok) {
    console.error("[control-center key rotation]", resolution.code);
    return NextResponse.json({ error: resolution.error }, { status: resolution.status });
  }

  const provider = resolution.provider;
  const newApiKey = generateApiKey(provider.id);
  const newHash = hashApiKey(newApiKey);

  const { error: updateError } = await admin
    .from("providers")
    .update({ api_key_hash: newHash })
    .eq("id", provider.id);

  if (updateError) {
    console.error("[control-center key rotation] provider update failed", updateError);
    return NextResponse.json(
      { error: "Impossible de mettre à jour la clé Séjoura." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    provider: {
      id: provider.id,
      name: provider.name,
    },
    apiKey: newApiKey,
    warning: "Cette clé est affichée une seule fois. Configurez-la immédiatement dans Séjoura Production.",
  });
}
