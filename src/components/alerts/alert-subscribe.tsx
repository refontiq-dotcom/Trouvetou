"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Check, Loader2 } from "lucide-react";
import { CATEGORIES, NAVIGABLE_CATEGORY_SLUGS } from "@/lib/categories";

/** Catégories proposées à l'abonnement (libellés issus du registre). */
const ALERT_CATEGORIES = NAVIGABLE_CATEGORY_SLUGS.map((slug) => ({
  slug,
  label: CATEGORIES[slug].plural,
}));

interface AlertSubscribeProps {
  /** Position d'affichage : inline (dans le flow) ou floating (bouton fixe). */
  variant?: "inline" | "floating";
}

export function AlertSubscribe({ variant = "inline" }: AlertSubscribeProps) {
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState("all");
  const [city, setCity] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "duplicate" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [confirmationSent, setConfirmationSent] = useState(true);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    setErrorMessage("");

    try {
      const response = await fetch("/api/alerts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          category: category === "all" ? null : category,
          city: city.trim() || null,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        already_subscribed?: boolean;
        email_sent?: boolean;
        error?: string;
      };

      if (!response.ok) {
        setStatus("error");
        setErrorMessage(
          payload.error ?? "L'inscription n'a pas pu être enregistrée."
        );
        return;
      }

      setConfirmationSent(payload.email_sent !== false);
      setStatus(payload.already_subscribed ? "duplicate" : "success");
      setEmail("");
      setCity("");
    } catch {
      setStatus("error");
      setErrorMessage("Connexion impossible. Vérifiez votre réseau et réessayez.");
    }
  }

  if (variant === "floating") {
    return (
      <div className="fixed bottom-6 right-6 z-30">
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.05 }}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg shadow-accent/30 transition-colors hover:shadow-xl"
          aria-label="S'abonner aux alertes"
          onClick={() => {
            const el = document.getElementById("alert-subscribe-form");
            el?.scrollIntoView({ behavior: "smooth" });
          }}
        >
          <Bell className="h-6 w-6" />
        </motion.button>
      </div>
    );
  }

  return (
    <section id="alert-subscribe-form" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
            <Bell className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-foreground">
              Soyez les premiers informés
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Recevez une alerte quand de nouvelles annonces correspondent à vos critères.
            </p>

            <AnimatePresence mode="wait">
              {status === "success" || status === "duplicate" ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-4 flex items-start gap-2 rounded-xl bg-emerald-50 p-4 text-sm font-medium text-emerald-700"
                >
                  <Check className="mt-0.5 h-5 w-5 shrink-0" />
                  <span>
                    {status === "duplicate"
                      ? "Cette alerte existe déjà : vous êtes bien inscrit."
                      : confirmationSent
                        ? "Alerte enregistrée ! Un email de confirmation vient de partir."
                        : "Alerte enregistrée. L'email de confirmation n'a pas pu être envoyé, mais votre abonnement est actif."}
                  </span>
                </motion.div>
              ) : (
                <motion.form
                  key="form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onSubmit={handleSubmit}
                  className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
                >
                  <div className="flex-1 flex flex-col gap-3 sm:flex-row">
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Votre email"
                      className="h-11 flex-1 rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="h-11 rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-primary"
                    >
                      <option value="all">Toutes les catégories</option>
                      {ALERT_CATEGORIES.map((c) => (
                        <option key={c.slug} value={c.slug}>{c.label}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Ville (optionnel)"
                      className="h-11 w-full sm:w-40 rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={status === "loading"}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-50"
                  >
                    {status === "loading" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Bell className="h-4 w-4" />
                    )}
                    M&apos;abonner
                  </button>

                  {status === "error" && errorMessage && (
                    <p
                      role="alert"
                      className="text-sm font-medium text-red-600 sm:basis-full"
                    >
                      {errorMessage}
                    </p>
                  )}

                  <p className="text-xs text-muted-foreground sm:basis-full">
                    Vous ne recevrez que les emails liés à cette alerte.
                    Répondez à l&apos;email reçu pour vous désinscrire.
                  </p>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
