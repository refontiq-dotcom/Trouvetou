"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/client";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  authOpen: boolean;
  openAuth: () => void;
  closeAuth: () => void;
  requestAuth: (afterSignIn?: () => void) => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);
  const [afterSignIn, setAfterSignIn] = useState<(() => void) | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }

    void supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (event === "SIGNED_IN") setAuthOpen(false);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  const requestAuth = useCallback((action?: () => void) => {
    if (user) {
      action?.();
      return;
    }
    setAfterSignIn(() => action ?? null);
    setAuthOpen(true);
  }, [user]);

  const closeAuth = useCallback(() => {
    setAuthOpen(false);
    setAfterSignIn(null);
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    if (supabase) await supabase.auth.signOut();
    setUser(null);
  }, []);

  const value = useMemo(() => ({
    user, loading, authOpen,
    openAuth: () => setAuthOpen(true),
    closeAuth, requestAuth, signOut,
  }), [user, loading, authOpen, closeAuth, requestAuth, signOut]);

  return (
    <AuthContext.Provider value={value}>
      {children}
      <PhoneAuthModal
        open={authOpen}
        onClose={closeAuth}
        onAuthenticated={() => {
          const action = afterSignIn;
          setAfterSignIn(null);
          action?.();
        }}
      />
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    return {
      user: null, loading: true, authOpen: false,
      openAuth: () => {}, closeAuth: () => {},
      requestAuth: () => {}, signOut: async () => {},
    };
  }
  return context;
}

function PhoneAuthModal({
  open, onClose, onAuthenticated,
}: {
  open: boolean;
  onClose: () => void;
  onAuthenticated: () => void;
}) {
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep("phone"); setPhone(""); setCode("");
      setError(""); setBusy(false);
    }
  }, [open]);

  if (!open) return null;

  function normalizePhone(value: string) {
    const compact = value.replace(/[\s().-]/g, "");
    if (compact.startsWith("+")) return compact;
    if (compact.startsWith("00")) return "+" + compact.slice(2);
    if (compact.startsWith("0")) return "+225" + compact.slice(1);
    return "+" + compact;
  }

  async function sendCode() {
    const normalized = normalizePhone(phone);
    if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
      setError("Entrez un numéro de téléphone valide.");
      return;
    }
    const supabase = getSupabase();
    if (!supabase) {
      setError("La connexion est temporairement indisponible.");
      return;
    }
    setBusy(true); setError("");
    const { error: sendError } = await supabase.auth.signInWithOtp({
      phone: normalized,
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (sendError) {
      setError(sendError.message || "Impossible d'envoyer le code.");
      return;
    }
    setPhone(normalized);
    setStep("code");
  }

  async function verifyCode() {
    const normalized = normalizePhone(phone);
    if (!/^\d{6}$/.test(code.trim())) {
      setError("Le code doit contenir 6 chiffres.");
      return;
    }
    const supabase = getSupabase();
    if (!supabase) {
      setError("La connexion est temporairement indisponible.");
      return;
    }
    setBusy(true); setError("");
    const { error: verifyError } = await supabase.auth.verifyOtp({
      phone: normalized,
      token: code.trim(),
      type: "sms",
    });
    setBusy(false);
    if (verifyError) {
      setError(verifyError.message || "Code incorrect ou expiré.");
      return;
    }
    onAuthenticated();
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Connexion Trouvetou">
      <div className="w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">{step === "phone" ? "Connectez-vous à Trouvetou" : "Vérifiez votre numéro"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {step === "phone" ? "Une connexion rapide par SMS est nécessaire pour sauvegarder vos favoris." : "Nous avons envoyé un code à " + phone + "."}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-2xl leading-none text-muted-foreground" aria-label="Fermer">×</button>
        </div>

        {step === "phone" ? (
          <form onSubmit={(e) => { e.preventDefault(); void sendCode(); }} className="space-y-4">
            <label className="block text-sm font-medium text-foreground">
              Numéro de téléphone
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="+225 07 00 00 00 00" className="mt-2 h-12 w-full rounded-xl border border-border px-4 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" />
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button disabled={busy} className="h-12 w-full rounded-xl bg-primary font-semibold text-white disabled:opacity-60">{busy ? "Envoi du code…" : "Recevoir le code SMS"}</button>
          </form>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); void verifyCode(); }} className="space-y-4">
            <label className="block text-sm font-medium text-foreground">
              Code à 6 chiffres
              <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" className="mt-2 h-12 w-full rounded-xl border border-border px-4 text-center text-lg tracking-[0.35em] outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" />
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button disabled={busy} className="h-12 w-full rounded-xl bg-primary font-semibold text-white disabled:opacity-60">{busy ? "Vérification…" : "Valider et continuer"}</button>
            <button type="button" onClick={() => { setStep("phone"); setError(""); }} className="w-full text-sm font-medium text-muted-foreground">Modifier le numéro</button>
          </form>
        )}
      </div>
    </div>
  );
}
