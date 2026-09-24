import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { generateApiKey, hashApiKey } from "@/lib/sync/api-key";

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

  const { data: provider, error: providerError } = await admin
    .from("providers")
    .select("id, name, webhook_url, is_active")
    .eq("name", "Séjoura")
    .eq("webhook_url", PRODUCTION_SEJOURA_WEBHOOK)
    .eq("is_active", true)
    .maybeSingle();

  if (providerError) {
    console.error("[control-center key rotation] provider lookup failed", providerError);
    return NextResponse.json({ error: "Impossible de trouver Séjoura." }, { status: 500 });
  }

  if (!provider) {
    return NextResponse.json(
      { error: "Le fournisseur Séjoura de production est introuvable." },
      { status: 404 },
    );
  }

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
