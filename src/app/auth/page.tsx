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

  function changeMode(next: Mode) {
    setMode(next);
    setStatus("idle");
    setMessage("");
    setPassword("");
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
              L'authentification n'est pas encore activée sur cet environnement.
            </p>
          )}

          {params.get("error") && configured && (
            <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
              Le lien est invalide ou a expiré. Recommencez la procédure.
            </p>
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
                <>Vous n'avez pas encore de compte ? <button type="button" onClick={() => changeMode("signup")} className="font-semibold text-neutral-900 underline">Créer un compte</button></>
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
