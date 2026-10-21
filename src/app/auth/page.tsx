"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Check, Loader2, Mail } from "lucide-react";
import { Logo } from "@/components/logo";
import { AnimatedLoader } from "@/components/ui/animated-loader";
import { getBrowserSupabase, isAuthConfigured } from "@/lib/supabase/browser";

/** N'accepte qu'un chemin interne : jamais d'URL absolue dans `returnTo`. */
function sanitizeReturnTo(value: string | null): string {
  if (!value) return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

function AuthForm() {
  const params = useSearchParams();
  const returnTo = sanitizeReturnTo(params.get("returnTo"));
  const configured = isAuthConfigured();

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setStatus("error");
      setMessage("L'authentification n'est pas configurée sur cet environnement.");
      return;
    }

    const address = email.trim();
    if (!address) return;

    setStatus("sending");
    setMessage("");

    const { error } = await supabase.auth.signInWithOtp({
      email: address,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(returnTo)}`,
      },
    });

    if (error) {
      setStatus("error");
      setMessage("Impossible d'envoyer le lien de connexion. Réessayez dans un instant.");
      return;
    }

    setStatus("sent");
  }

  return (
    <div className="min-h-[70dvh] bg-ink px-4 py-10 text-white lg:py-16">
      <div className="mx-auto w-full max-w-md">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-white/60 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Accueil
        </Link>

        <div className="mt-8 flex justify-center">
          <Logo size="sm" />
        </div>

        <div className="mt-8 rounded-[28px] bg-white p-6 text-neutral-900 shadow-2xl sm:p-8">
          <h1 className="text-xl font-bold tracking-tight">Se connecter</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Vos favoris et vos réservations restent liés à votre compte, sur tous
            vos appareils.
          </p>

          {!configured && (
            <p
              role="alert"
              className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800"
            >
              L&apos;authentification n&apos;est pas encore activée sur cet
              environnement. Ajoutez <code>NEXT_PUBLIC_SUPABASE_URL</code> et{" "}
              <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
            </p>
          )}

          {params.get("error") && configured && (
            <p
              role="alert"
              className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700"
            >
              Le lien de connexion est invalide ou a expiré. Demandez-en un nouveau.
            </p>
          )}

          {status === "sent" ? (
            <div className="mt-6 flex items-start gap-3 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">
              <Check className="mt-0.5 h-5 w-5 shrink-0" />
              <span>
                Lien envoyé à <strong>{email}</strong>. Ouvrez-le depuis cet
                appareil pour vous connecter.
              </span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-3">
              <label htmlFor="auth-email" className="sr-only">
                Adresse email
              </label>
              <input
                id="auth-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="vous@exemple.com"
                className="h-12 w-full rounded-xl border border-neutral-200 bg-white px-4 text-sm outline-none transition-colors focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
              />

              <button
                type="submit"
                disabled={status === "sending" || !configured}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-lime px-5 text-sm font-bold text-ink transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {status === "sending" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4" />
                )}
                Recevoir un lien de connexion
              </button>

              {status === "error" && message && (
                <p role="alert" className="text-sm font-medium text-red-600">
                  {message}
                </p>
              )}

              <p className="text-xs leading-relaxed text-neutral-500">
                Pas de mot de passe : un lien à usage unique est envoyé par email.
                En continuant, vous acceptez que votre adresse soit conservée pour
                gérer votre compte.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[70dvh] bg-ink px-4 py-16 text-white">
          <div className="mx-auto max-w-md" aria-busy="true">
            <AnimatedLoader
              label="Chargement en cours"
              delayMs={300}
              showProgress
              tone="dark"
            />
          </div>
        </div>
      }
    >
      <AuthForm />
    </Suspense>
  );
}
