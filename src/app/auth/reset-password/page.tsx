"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Loader2, LockKeyhole } from "lucide-react";
import { Logo } from "@/components/logo";
import { getBrowserSupabase, isAuthConfigured } from "@/lib/supabase/browser";

function ResetPasswordForm() {
  const router = useRouter();
  const configured = isAuthConfigured();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      setStatus("error");
      setMessage("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (password !== confirmation) {
      setStatus("error");
      setMessage("Les deux mots de passe ne correspondent pas.");
      return;
    }

    const supabase = getBrowserSupabase();
    if (!supabase) {
      setStatus("error");
      setMessage("L'authentification n'est pas configurée sur cet environnement.");
      return;
    }

    setStatus("loading");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setStatus("error");
      setMessage("Le lien de réinitialisation est invalide ou expiré. Demandez-en un nouveau.");
      return;
    }

    setStatus("success");
    setMessage("Votre mot de passe a été modifié. Vous pouvez maintenant accéder à votre compte.");
  }

  return (
    <div className="min-h-[70dvh] bg-ink px-4 py-10 text-white lg:py-16">
      <div className="mx-auto w-full max-w-md">
        <Link href="/auth" className="inline-flex items-center gap-1.5 text-sm text-white/60 transition-colors hover:text-white"><ArrowLeft className="h-4 w-4" /> Retour à la connexion</Link>
        <div className="mt-8 flex justify-center"><Logo size="sm" /></div>
        <div className="mt-8 rounded-[28px] bg-white p-6 text-neutral-900 shadow-2xl sm:p-8">
          <h1 className="text-xl font-bold tracking-tight">Choisir un nouveau mot de passe</h1>
          <p className="mt-1 text-sm text-neutral-500">Choisissez un mot de passe d'au moins 8 caractères.</p>

          {status === "success" ? (
            <div role="status" className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
              <div className="flex items-start gap-2"><Check className="mt-0.5 h-5 w-5 shrink-0" /><span>{message}</span></div>
              <button type="button" onClick={() => router.replace("/profil")} className="mt-4 font-semibold underline">Accéder à mon espace</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium">Nouveau mot de passe</label>
                <input id="new-password" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-12 w-full rounded-xl border border-neutral-200 px-4 text-sm outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10" />
              </div>
              <div>
                <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-medium">Confirmer le mot de passe</label>
                <input id="confirm-password" type="password" required minLength={8} autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="h-12 w-full rounded-xl border border-neutral-200 px-4 text-sm outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10" />
              </div>
              <button type="submit" disabled={!configured || status === "loading"} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-lime px-5 text-sm font-bold text-ink disabled:opacity-50">
                {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
                Enregistrer le nouveau mot de passe
              </button>
              {status === "error" && <p role="alert" className="text-sm font-medium text-red-600">{message}</p>}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return <Suspense fallback={<div className="min-h-[70dvh] bg-ink px-4 py-16 text-white">Chargement…</div>}><ResetPasswordForm /></Suspense>;
}
