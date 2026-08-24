"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { MapPin, Search } from "lucide-react";

const POPULAR_QUERIES = ["Abidjan", "Résidence", "Studio meublé"];

export function Hero() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/hotels?q=${encodeURIComponent(q)}` : "/hotels");
  }

  return (
    <section className="relative overflow-hidden bg-[#0d47a1]">
      {/* Decorative blobs */}
      <div className="hero-blob h-96 w-96 bg-[#1976d2] top-0 -left-20 opacity-60" />
      <div className="hero-blob h-80 w-80 bg-[#42a5f5] top-10 right-0 opacity-30" />
      <div className="hero-blob h-64 w-64 bg-accent/30 bottom-0 left-1/3" />

      {/* Floating decorative pin */}
      <div className="absolute top-16 right-10 sm:right-20 animate-float opacity-20">
        <svg viewBox="0 0 31 44" width="60" fill="none">
          <path
            d="M15.5 0C6.94 0 0 6.94 0 15.5C0 27.1 15.5 44 15.5 44S31 27.1 31 15.5C31 6.94 24.06 0 15.5 0Z"
            fill="#F9A825"
          />
          <circle cx="15.5" cy="13.5" r="6" fill="white" />
        </svg>
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-28 text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs sm:text-sm font-medium text-white backdrop-blur-sm">
            <MapPin className="h-3.5 w-3.5 text-accent" />
            Annonces vérifiées · Côte d&apos;Ivoire & Afrique de l&apos;Ouest
          </span>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08 }}
          className="mt-6 sm:mt-8 text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white"
        >
          Trouvez{" "}
          <span className="text-accent">tout</span>,{" "}
          <span className="text-accent">restez</span> serein.
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.16 }}
          className="mx-auto mt-4 sm:mt-6 max-w-2xl text-base sm:text-lg text-white/70"
        >
          Hôtels, résidences meublées, écoles et cliniques de confiance
          partout en Afrique de l&apos;Ouest. Comparez, contactez et réservez en
          quelques clics.
        </motion.p>

        {/* Search bar */}
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.24 }}
          className="mx-auto mt-8 sm:mt-10 flex max-w-2xl flex-col sm:flex-row items-stretch gap-3 rounded-2xl bg-white p-3 shadow-2xl shadow-black/20"
        >
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ville, nom de résidence, type de chambre…"
              className="h-12 w-full rounded-xl border-0 bg-muted/50 pl-12 pr-4 text-sm outline-none placeholder:text-muted-foreground focus:bg-muted transition-colors"
            />
          </div>
          <button
            type="submit"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-hover hover:shadow-md"
          >
            <Search className="h-4 w-4" />
            Rechercher
          </button>
        </motion.form>

        {/* Popular queries */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="mt-5 flex flex-wrap items-center justify-center gap-2 text-sm text-white/50"
        >
          <span>Populaire :</span>
          {POPULAR_QUERIES.map((q) => (
            <button
              key={q}
              onClick={() => router.push(`/hotels?q=${encodeURIComponent(q)}`)}
              className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs font-medium text-white/70 transition-colors hover:border-accent hover:text-accent hover:bg-accent/10"
            >
              {q}
            </button>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
