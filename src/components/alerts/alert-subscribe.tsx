"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Check, Loader2 } from "lucide-react";

const CATEGORIES = [
  { slug: "clinic", label: "Cliniques" },
  { slug: "school", label: "Écoles" },
  { slug: "hotel", label: "Hôtels" },
  { slug: "residence", label: "Résidences" },
  { slug: "restaurant", label: "Restaurants" },
];

interface AlertSubscribeProps {
  /** Position d'affichage : inline (dans le flow) ou floating (bouton fixe). */
  variant?: "inline" | "floating";
}

export function AlertSubscribe({ variant = "inline" }: AlertSubscribeProps) {
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState("all");
  const [city, setCity] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");

    // Pour l'instant, on sauvegarde en localStorage comme démo.
    // En prod, on enverrait un email via Resend/SendGrid + une table Supabase.
    try {
      const alerts = JSON.parse(localStorage.getItem("trouvetou_alerts") ?? "[]");
      alerts.push({
        email: email.trim(),
        category: category === "all" ? null : category,
        city: city.trim() || null,
        created_at: new Date().toISOString(),
      });
      localStorage.setItem("trouvetou_alerts", JSON.stringify(alerts));
      setStatus("success");
      setEmail("");
      setCity("");
    } catch {
      setStatus("error");
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
    <section
      id="alert-subscribe-form"
      aria-labelledby="alert-subscribe-title"
      className="rounded-tt-card bg-tt-card p-4 shadow-tt-card ring-1 ring-tt-line sm:p-6"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-tt-lime-soft text-tt-ink"
        >
          <Bell className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2
            id="alert-subscribe-title"
            className="font-display text-lg font-bold text-tt-ink"
          >
            Soyez les premiers informés
          </h2>
          <p className="mt-1 text-sm text-tt-ink-60">
            Recevez une alerte quand de nouvelles annonces correspondent à vos
            critères.
          </p>

          <AnimatePresence mode="wait">
            {status === "success" ? (
              <motion.div
                key="success"
                role="status"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-800"
              >
                <Check className="h-5 w-5 shrink-0" aria-hidden="true" />
                Alerte enregistrée ! Vous serez notifié de nouvelles annonces.
              </motion.div>
            ) : (
              <motion.form
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onSubmit={handleSubmit}
                className="mt-4 space-y-3"
              >
                {/* Labels visibles : le placeholder ne fait plus office de libellé. */}
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="min-w-0 flex-1">
                    <label
                      htmlFor="alert-email"
                      className="block text-xs font-medium text-tt-ink"
                    >
                      Adresse email
                    </label>
                    <input
                      id="alert-email"
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="vous@exemple.com"
                      className="tt-field mt-1"
                    />
                  </div>

                  <div className="min-w-0 sm:w-48">
                    <label
                      htmlFor="alert-category"
                      className="block text-xs font-medium text-tt-ink"
                    >
                      Catégorie
                    </label>
                    {/* `w-full` : sans lui, le select déborde du conteneur
                        en flex sur les small screens. */}
                    <select
                      id="alert-category"
                      name="category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="tt-field mt-1 w-full"
                    >
                      <option value="all">Toutes</option>
                      {CATEGORIES.map((c) => (
                        <option key={c.slug} value={c.slug}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="min-w-0 flex-1">
                    <label
                      htmlFor="alert-city"
                      className="block text-xs font-medium text-tt-ink"
                    >
                      Ville{" "}
                      <span className="font-normal text-tt-ink-60">
                        (optionnel)
                      </span>
                    </label>
                    <input
                      id="alert-city"
                      name="city"
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Abidjan"
                      className="tt-field mt-1"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={status === "loading"}
                    className="tt-tap inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-tt-ink px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-tt-ink-80 disabled:opacity-60"
                  >
                    {status === "loading" ? (
                      <Loader2
                        className="h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <Bell className="h-4 w-4" aria-hidden="true" />
                    )}
                    M&apos;abonner
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
