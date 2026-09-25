import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { generateApiKey, hashApiKey } from "@/lib/sync/api-key";

/**
 * UUID canonique du provider Séjour@ (migration
 * 20260925_merge_sejoura_duplicate_provider.sql). Utilisé en priorité : c'est
 * l'identifiant le plus stable, là où le nom et l'URL du webhook ont changé
 * au fil des déploiements.
 */
const SEJOURA_PROVIDER_ID = "a5101284-2d97-46e0-a0f2-fa6a008588f2";

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

  // Résolution du provider Séjour@, par ordre de robustesse décroissante.
  //
  // L'ancien filtre exigeait un `webhook_url` de callback figé
  // (https://sejoura.app/sync-callback) ET is_active = true. Or cette URL a
  // changé avec les déploiements (l'app vit sur sejoura-lemon.vercel.app) :
  // la rotation échouait alors que le provider existait et était valide. On ne
  // dépend donc plus d'une URL de callback susceptible de changer.
  const providerColumns = "id, name, webhook_url, is_active";

  const { data: byId, error: byIdError } = await admin
    .from("providers")
    .select(providerColumns)
    .eq("id", SEJOURA_PROVIDER_ID)
    .maybeSingle();

  if (byIdError) {
    console.error("[control-center key rotation] lookup by id failed", byIdError);
    return NextResponse.json(
      { error: "Impossible de lire le provider Séjour@." },
      { status: 500 },
    );
  }

  // Un provider désactivé ne doit jamais être réactivé implicitement par une
  // rotation : on le signale pour une intervention humaine.
  if (byId && !byId.is_active) {
    return NextResponse.json(
      { error: "Le provider Séjour@ est désactivé : réactivez-le avant de tourner la clé." },
      { status: 409 },
    );
  }

  let provider = byId;

  if (!provider) {
    // Repli : nom du provider, insensible aux accents, en exigeant un unique
    // candidat pour ne jamais risquer de pivoter la mauvaise source.
    const { data: byName, error: byNameError } = await admin
      .from("providers")
      .select(providerColumns)
      .ilike("name", "%joura%")
      .limit(5);

    if (byNameError) {
      console.error("[control-center key rotation] lookup by name failed", byNameError);
      return NextResponse.json({ error: "Impossible de lire les providers." }, { status: 500 });
    }

    const activeCandidates = (byName ?? []).filter((p) => p.is_active);
    const sejoura = activeCandidates.filter(
      (p) =>
        (p.name ?? "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase() === "sejoura",
    );

    if (sejoura.length > 1) {
      return NextResponse.json(
        { error: "Plusieurs providers Séjour@ actifs : rotation refusée pour sécurité." },
        { status: 409 },
      );
    }

    provider = sejoura[0] ?? null;
  }

  if (!provider) {
    return NextResponse.json(
      { error: "Le fournisseur Séjour@ est introuvable en base." },
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
