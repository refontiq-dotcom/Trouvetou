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
              {status === "success" ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-4 text-sm font-medium text-emerald-700"
                >
                  <Check className="h-5 w-5" />
                  Alerte enregistrée ! Vous serez notifié de nouvelles annonces.
                </motion.div>
              ) : (
                <motion.form
                  key="form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onSubmit={handleSubmit}
                  className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
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
                      {CATEGORIES.map((c) => (
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
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
