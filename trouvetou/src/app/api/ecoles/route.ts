import { NextResponse, type NextRequest } from "next/server";
import {
  fetchSchoolyCatalog,
  isSchoolyConfigured,
  SchoolyApiError,
  SchoolyConfigError,
} from "@/lib/schooly";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * `GET /api/ecoles` — proxie le catalogue Schooly.
 * Renvoie 503 si l'intégration n'est pas configurée (le front basculera sur
 * le catalogue générique). 502 en cas d'erreur réseau Schooly. 4xx/5xx tels
 * quels pour les erreurs applicatives.
 */
export async function GET(request: NextRequest) {
  if (!isSchoolyConfigured()) {
    return NextResponse.json(
      { error: "Intégration Schooly non configurée", code: "NOT_CONFIGURED" },
      { status: 503 }
    );
  }

  try {
    const catalog = await fetchSchoolyCatalog(request.signal);
    return NextResponse.json(catalog, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    if (err instanceof SchoolyConfigError) {
      return NextResponse.json(
        { error: err.message, code: "NOT_CONFIGURED" },
        { status: 503 }
      );
    }
    if (err instanceof SchoolyApiError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status }
      );
    }
    return NextResponse.json(
      { error: "Erreur interne", code: "INTERNAL" },
      { status: 500 }
    );
  }
}
