"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Search, SlidersHorizontal } from "lucide-react";

export function Hero() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/ecoles?q=${encodeURIComponent(q)}` : "/ecoles");
  }

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-4">
      {/* Rectangular container — smaller than ad banner */}
      <div className="relative w-full h-[160px] sm:h-[180px] rounded-2xl overflow-hidden bg-[#0d47a1]">
        {/* Decorative blobs */}
        <div className="hero-blob h-64 w-64 bg-[#1976d2] top-0 -left-16 opacity-60" />
        <div className="hero-blob h-48 w-48 bg-[#42a5f5] top-4 right-0 opacity-30" />

        <div className="relative z-10 h-full flex flex-col items-center justify-center px-4">
          {/* Title — one line */}
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-2xl sm:text-4xl lg:text-[42px] font-extrabold tracking-tight text-white whitespace-nowrap"
          >
            Trouvez,{" "}
            <span className="text-accent">Comparez</span>,{" "}
            Réservez.
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="mt-1.5 sm:mt-2 text-sm sm:text-base text-white/60"
          >
            Tout simplement.
          </motion.p>

          {/* Search bar + Filtre */}
          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.16 }}
            className="mt-3 sm:mt-4 flex w-full max-w-[480px] items-stretch gap-0"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ville, nom de l'école, niveau…"
                className="h-[42px] sm:h-[46px] w-full rounded-l-lg border-0 bg-white pl-10 pr-3 text-xs sm:text-sm outline-none placeholder:text-slate-400"
              />
            </div>
            <button
              type="submit"
              className="inline-flex h-[42px] sm:h-[46px] items-center gap-1.5 rounded-r-lg bg-[#0a3a7d] border-2 border-white/30 px-4 sm:px-5 text-xs sm:text-sm font-semibold text-white hover:bg-[#1565c0] transition-colors"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filtre
            </button>
          </motion.form>
        </div>
      </div>
    </section>
  );
}
