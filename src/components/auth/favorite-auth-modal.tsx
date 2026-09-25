"use client";

import { useState, type FormEvent } from "react";
import { ArrowLeft, CheckCircle2, Heart, Loader2, X } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";

interface Props { open: boolean; listingId: string | null; onClose: () => void; onAuthenticated: (listingId: string) => Promise<void>; }

function normalizePhone(value: string) {
  const raw = value.trim().replace(/[\s().-]/g, "");
  if (raw.startsWith("+225")) return raw;
  if (/^0\d{9}$/.test(raw)) return `+225${raw.slice(1)}`;
  if (/^\d{10}$/.test(raw)) return `+225${raw}`;
  return raw;
}

export function FavoriteAuthModal({ open, listingId, onClose, onAuthenticated }: Props) {
  const { sendPhoneOtp, verifyPhoneOtp } = useAuth();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (!open || !listingId) return null;

  async function send(event: FormEvent) {
    event.preventDefault();
    const normalized = normalizePhone(phone);
    if (!/^\+225\d{10}$/.test(normalized)) { setError("Entrez un numéro ivoirien valide."); return; }
    setBusy(true); setError("");
    const result = await sendPhoneOtp(normalized);
    setBusy(false);
    if (result.error) { setError("Impossible d’envoyer le code. Vérifiez le numéro ou réessayez."); return; }
    setPhone(normalized); setStep("otp");
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    if (!/^\d{6}$/.test(otp)) { setError("Le code doit contenir 6 chiffres."); return; }
    setBusy(true); setError("");
    const result = await verifyPhoneOtp(phone, otp);
    if (result.error) { setBusy(false); setError("Code incorrect ou expiré."); return; }
    await onAuthenticated(listingId);
    setBusy(false); onClose();
  }

  return <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-3 backdrop-blur-sm sm:items-center">
    <div role="dialog" aria-modal="true" aria-labelledby="favorite-auth-title" className="w-full max-w-md rounded-3xl bg-background p-5 shadow-2xl">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-500/10 text-red-500"><Heart className="h-5 w-5 fill-current" /></div>
          <div><h2 id="favorite-auth-title" className="font-bold">Gardez cette annonce dans vos favoris</h2><p className="text-xs text-muted-foreground">Créez votre espace en quelques secondes.</p></div>
        </div>
        <button type="button" onClick={onClose} aria-label="Fermer" className="rounded-full p-2 text-muted-foreground hover:bg-muted"><X className="h-5 w-5" /></button>
      </div>
      {step === "phone" ? <form onSubmit={send} className="space-y-4">
        <label className="block text-sm font-medium">Votre numéro de téléphone
          <input autoFocus inputMode="tel" autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="07 00 00 00 00" className="mt-2 h-12 w-full rounded-xl border border-border bg-card px-4 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
        </label>
        <p className="text-[11px] text-muted-foreground">Un code de vérification à usage unique vous sera envoyé par SMS.</p>
        {error && <p role="alert" className="text-xs font-medium text-red-600">{error}</p>}
        <button disabled={busy} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-white disabled:opacity-60">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Continuer</button>
      </form> : <form onSubmit={verify} className="space-y-4">
        <button type="button" onClick={() => { setStep("phone"); setError(""); }} className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Modifier le numéro</button>
        <label className="block text-sm font-medium">Code reçu par SMS
          <input autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ""))} placeholder="000000" className="mt-2 h-12 w-full rounded-xl border border-border bg-card px-4 text-center text-lg font-bold tracking-[0.35em] outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
        </label>
        {error && <p role="alert" className="text-xs font-medium text-red-600">{error}</p>}
        <button disabled={busy} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-white disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}Vérifier et enregistrer</button>
      </form>}
    </div>
  </div>;
}
