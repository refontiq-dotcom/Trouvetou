"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Check, Loader2, LockKeyhole, Mail } from "lucide-react";
import { Logo } from "@/components/logo";
import { getBrowserSupabase, isAuthConfigured } from "@/lib/supabase/browser";

function sanitizeReturnTo(value: string | null): string {
  if (!value) return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

type Mode = "login" | "signup" | "forgot";
type Status = "idle" | "loading" | "success" | "error";

function AuthForm() {
  const params = useSearchParams();
  const returnTo = sanitizeReturnTo(params.get("returnTo"));
  const configured = isAuthConfigured();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);

  function changeMode(next: Mode) {
    setMode(next);
    setStatus("idle");
    setMessage("");
    setPassword("");
  }

  async function handleGoogleSignIn() {
    const supabase = getBrowserSupabase();
    if (!supabase || googleLoading) return;

    setGoogleLoading(true);
    setStatus("idle");
    setMessage("");

    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(returnTo)}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });

    if (error) {
      setGoogleLoading(false);
      setStatus("error");
      setMessage("La connexion avec Google n'a pas pu démarrer. Réessayez ou utilisez votre adresse e-mail.");
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setStatus("error");
      setMessage("L'authentification n'est pas configurée sur cet environnement.");
      return;
    }

    const address = email.trim().toLowerCase();
    if (!address) return;
    if (mode !== "forgot" && password.length < 8) {
      setStatus("error");
      setMessage("Votre mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    setStatus("loading");
    setMessage("");

    const emailRedirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(returnTo)}`;

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({
        email: address,
        password,
      });
      if (error) {
        setStatus("error");
        setMessage("Adresse e-mail ou mot de passe incorrect. Vérifiez vos identifiants et réessayez.");
        return;
      }
      window.location.assign(returnTo);
      return;
    }

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email: address,
        password,
        options: { emailRedirectTo },
      });
      if (error) {
        setStatus("error");
        setMessage("Impossible de créer votre compte. Vérifiez les informations saisies ou réessayez.");
        return;
      }
      if (data.session) {
        window.location.assign(returnTo);
        return;
      }
      setStatus("success");
      setMessage("Votre compte est créé. Consultez votre boîte e-mail pour confirmer votre adresse avant de vous connecter.");
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(address, {
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/auth/reset-password")}`,
    });
    if (error) {
      setStatus("error");
      setMessage("Impossible d'envoyer l'e-mail de réinitialisation. Réessayez dans un instant.");
      return;
    }
    setStatus("success");
    setMessage("Si un compte correspond à cette adresse, un e-mail de réinitialisation vient de vous être envoyé.");
  }

  const title = mode === "login" ? "Heureux de vous revoir" : mode === "signup" ? "Créer votre compte" : "Mot de passe oublié ?";
  const description = mode === "login"
    ? "Connectez-vous pour retrouver vos favoris et vos réservations."
    : mode === "signup"
      ? "Créez votre compte pour conserver vos favoris et suivre vos réservations."
      : "Indiquez votre adresse e-mail. Nous vous enverrons un lien pour choisir un nouveau mot de passe.";

  return (
    <div className="min-h-[70dvh] bg-ink px-4 py-10 text-white lg:py-16">
      <div className="mx-auto w-full max-w-md">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-white/60 transition-colors hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Accueil
        </Link>
        <div className="mt-8 flex justify-center"><Logo size="sm" /></div>

        <div className="mt-8 rounded-[28px] bg-white p-6 text-neutral-900 shadow-2xl sm:p-8">
          <h1 className="text-xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-neutral-500">{description}</p>

          {!configured && (
            <p role="alert" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              L&apos;authentification n&apos;est pas encore activée sur cet environnement.
            </p>
          )}

          {params.get("error") && configured && (
            <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
              Le lien est invalide ou a expiré. Recommencez la procédure.
            </p>
          )}

          {status !== "success" && mode !== "forgot" && (
            <div className="mt-6">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={!configured || googleLoading || status === "loading"}
                className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-neutral-200 bg-white px-5 text-sm font-semibold text-neutral-800 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {googleLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <svg aria-hidden="true" viewBox="0 0 48 48" className="h-5 w-5">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" />
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.77 7.18l7.73 6C44.4 37.95 46.98 31.8 46.98 24.55Z" />
                    <path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.52 2.56 10.78l7.97-6.19Z" />
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.8l-7.73-6c-2.14 1.44-4.89 2.3-8.17 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" />
                  </svg>
                )}
                {googleLoading ? "Redirection vers Google…" : "Continuer avec Google"}
              </button>
              <div className="my-5 flex items-center gap-3 text-xs text-neutral-400">
                <span className="h-px flex-1 bg-neutral-200" />
                <span>ou avec votre adresse e-mail</span>
                <span className="h-px flex-1 bg-neutral-200" />
              </div>
            </div>
          )}

          {status === "success" ? (
            <div className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800" role="status">
              <div className="flex items-start gap-2"><Check className="mt-0.5 h-5 w-5 shrink-0" /><span>{message}</span></div>
              <button type="button" onClick={() => changeMode("login")} className="mt-4 font-semibold underline">Revenir à la connexion</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="auth-email" className="mb-1.5 block text-sm font-medium">Adresse e-mail</label>
                <input id="auth-email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="vous@exemple.com" className="h-12 w-full rounded-xl border border-neutral-200 bg-white px-4 text-sm outline-none transition-colors focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10" />
              </div>

              {mode !== "forgot" && (
                <div>
                  <label htmlFor="auth-password" className="mb-1.5 block text-sm font-medium">Mot de passe</label>
                  <input id="auth-password" type="password" required minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="8 caractères minimum" className="h-12 w-full rounded-xl border border-neutral-200 bg-white px-4 text-sm outline-none transition-colors focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10" />
                  {mode === "login" && <div className="mt-2 text-right"><button type="button" onClick={() => changeMode("forgot")} className="text-xs font-semibold text-neutral-600 hover:text-neutral-900">Mot de passe oublié ?</button></div>}
                </div>
              )}

              <button type="submit" disabled={status === "loading" || !configured} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-lime px-5 text-sm font-bold text-ink transition-opacity hover:opacity-90 disabled:opacity-50">
                {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "forgot" ? <Mail className="h-4 w-4" /> : <LockKeyhole className="h-4 w-4" />}
                {mode === "login" ? "Se connecter" : mode === "signup" ? "Créer mon compte" : "Envoyer le lien de réinitialisation"}
              </button>

              {status === "error" && message && <p role="alert" className="text-sm font-medium text-red-600">{message}</p>}
              {mode === "signup" && <p className="text-xs leading-relaxed text-neutral-500">Un e-mail de confirmation sera envoyé avant votre première connexion.</p>}
            </form>
          )}

          {status !== "success" && (
            <div className="mt-6 border-t border-neutral-100 pt-5 text-center text-sm text-neutral-500">
              {mode === "login" ? (
                <>Vous n&apos;avez pas encore de compte ? <button type="button" onClick={() => changeMode("signup")} className="font-semibold text-neutral-900 underline">Créer un compte</button></>
              ) : mode === "signup" ? (
                <>Vous avez déjà un compte ? <button type="button" onClick={() => changeMode("login")} className="font-semibold text-neutral-900 underline">Se connecter</button></>
              ) : (
                <button type="button" onClick={() => changeMode("login")} className="font-semibold text-neutral-900 underline">Retour à la connexion</button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-[70dvh] bg-ink px-4 py-16 text-white"><div className="mx-auto max-w-md text-sm text-white/60">Chargement…</div></div>}>
      <AuthForm />
    </Suspense>
  );
}
