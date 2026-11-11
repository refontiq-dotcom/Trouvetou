import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * Échange le code de confirmation / récupération contre une session en cookies,
 * puis renvoie l'utilisateur vers une destination interne validée.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNext(searchParams.get("next"));
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  const supabase = await getServerSupabase();
  if (!supabase) return NextResponse.redirect(new URL("/auth?error=not_configured", origin));

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  } else if (tokenHash && type && ["signup", "email", "recovery", "magiclink"].includes(type)) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    });
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }

  return NextResponse.redirect(new URL("/auth?error=link_invalid", origin));
}
