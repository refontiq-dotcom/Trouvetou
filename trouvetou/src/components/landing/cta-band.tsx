"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, BadgeCheck, ShieldCheck, TrendingUp } from "lucide-react";

const TRUST_POINTS = [
  {
    icon: ShieldCheck,
    title: "Établissements vérifiés",
    description: "Seuls les partenaires avec un abonnement actif sont affichés.",
  },
  {
    icon: BadgeCheck,
    title: "Photos réelles",
    description: "Chaque annonce est publiée directement depuis Séjoura.",
  },
  {
    icon: TrendingUp,
    title: "Prix affichés en FCFA",
    description: "Le tarif est clair, sans surprise — nuit, scolarité ou consultation.",
  },
];

export function CtaBand() {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
      {/* CTA card */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0d47a1] via-[#1565c0] to-[#1976d2] px-6 py-16 sm:px-12 text-center"
      >
        {/* Decorative blobs */}
        <div className="hero-blob h-64 w-64 bg-white/10 -right-16 -top-16" />
        <div className="hero-blob h-72 w-72 bg-accent/20 -left-16 -bottom-16" />

        {/* Floating pin */}
        <div className="absolute top-6 right-8 animate-float opacity-30">
          <svg viewBox="0 0 31 44" width="40" fill="none">
            <path
              d="M15.5 0C6.94 0 0 6.94 0 15.5C0 27.1 15.5 44 15.5 44S31 27.1 31 15.5C31 6.94 24.06 0 15.5 0Z"
              fill="#F9A825"
            />
            <circle cx="15.5" cy="13.5" r="6" fill="white" />
          </svg>
        </div>

        <div className="relative mx-auto max-w-2xl">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
            Prêt à trouver ce qu&apos;il vous faut ?
          </h2>
          <p className="mt-4 text-white/70">
            Parcourez les annonces publiées par nos établissements partenaires
            et comparez en un clin d&apos;œil.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/hotels"
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-accent px-6 text-sm font-bold text-accent-foreground shadow-lg shadow-accent/30 transition-all hover:scale-105 hover:shadow-xl hover:shadow-accent/40"
            >
              Voir les annonces
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/cliniques"
              className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/30 px-6 text-sm font-medium text-white transition-colors hover:bg-white/10"
            >
              Trouver une clinique
            </Link>
          </div>
        </div>
      </motion.div>

      {/* Trust points */}
      <div className="mt-14 grid gap-6 sm:grid-cols-3">
        {TRUST_POINTS.map((point, i) => {
          const Icon = point.icon;
          return (
            <motion.div
              key={point.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="flex items-start gap-4"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">{point.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                  {point.description}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
